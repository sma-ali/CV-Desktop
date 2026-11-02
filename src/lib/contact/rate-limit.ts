// Limite de débit du formulaire de contact.
//
// L'implémentation en mémoire vit dans une instance du serveur : sur Vercel,
// plusieurs instances peuvent tourner en même temps, et chacune compte de son
// côté (une instance froide repart de zéro). Elle freine un visiteur trop
// pressé ou un robot naïf et protège le quota d'envoi, sans plus. La vraie
// barrière est une règle de limite de débit du pare-feu Vercel sur
// /api/contact, posée à la mise en ligne. Le plafond de l'instance protège le
// quota d'envoi, au prix d'un risque : des envois venus de nombreuses
// adresses peuvent l'atteindre et couper le formulaire pour tous jusqu'à ce
// que la fenêtre glisse (le visiteur garde alors le lien vers l'e-mail).
// L'interface RateLimiter permet de brancher plus tard un stockage partagé
// sans toucher à la route.

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Compte une tentative pour cette clé (l'IP) ; refuse si une limite est atteinte. */
  hit(key: string, now: number): RateLimitResult;
}

export interface Window {
  max: number;
  windowMs: number;
}

export interface MemoryRateLimiterOptions {
  /** Par clé (IP) : une ou plusieurs fenêtres, toutes respectées. */
  perKey?: Window | Window[];
  /** Pour toute l'instance : une ou plusieurs fenêtres, toutes respectées. */
  global?: Window | Window[];
  /** Nombre maximal de clés gardées en mémoire. */
  maxKeys?: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// Les limites par défaut. Par IP : 5 envois par 10 minutes, et 10 par heure,
// pour qu'une seule adresse ne vide pas à elle seule le plafond de l'instance.
// Pour l'instance : 30 par heure et 100 par jour, sous le quota quotidien de
// l'offre gratuite de Mailjet.
export const DEFAULT_PER_KEY: Window = { max: 5, windowMs: 10 * MINUTE };
export const DEFAULT_PER_KEY_HOURLY: Window = { max: 10, windowMs: HOUR };
export const DEFAULT_GLOBAL: Window = { max: 30, windowMs: HOUR };
export const DEFAULT_GLOBAL_DAILY: Window = { max: 100, windowMs: 24 * HOUR };
export const DEFAULT_MAX_KEYS = 10_000;

/**
 * Les fenêtres par défaut, avec un maximum par IP éventuellement relevé
 * (CONTACT_RATE_LIMIT_MAX, pour les tests de bout en bout où tout vient de
 * localhost) : toutes les limites suivent alors ce maximum.
 */
export function defaultWindows(perKeyMax: number = DEFAULT_PER_KEY.max): {
  perKey: Window[];
  global: Window[];
} {
  const raise = (window: Window): Window => ({ ...window, max: Math.max(window.max, perKeyMax) });
  return {
    perKey: [{ ...DEFAULT_PER_KEY, max: perKeyMax }, raise(DEFAULT_PER_KEY_HOURLY)],
    global: [raise(DEFAULT_GLOBAL), raise(DEFAULT_GLOBAL_DAILY)],
  };
}

export interface MemoryRateLimiter extends RateLimiter {
  /** Nombre de clés en mémoire (pour les tests). */
  size(): number;
}

const asList = (value: Window | Window[]): Window[] => (Array.isArray(value) ? value : [value]);
const longest = (windows: Window[]) => Math.max(0, ...windows.map((window) => window.windowMs));

/** Les instants encore dans la fenêtre, du plus ancien au plus récent. */
function recent(stamps: number[], now: number, windowMs: number): number[] {
  return stamps.filter((stamp) => now - stamp < windowMs);
}

/** La première fenêtre pleine : dans combien de secondes elle libère une place ; null sinon. */
function blocked(stamps: number[], now: number, windows: Window[]): number | null {
  for (const window of windows) {
    const inside = recent(stamps, now, window.windowMs);
    if (inside.length >= window.max) {
      // La place se libère quand sort l'envoi qui fait dépasser le maximum.
      const freeing = inside[inside.length - window.max] ?? now;
      return Math.max(1, Math.ceil((freeing + window.windowMs - now) / 1000));
    }
  }
  return null;
}

/** Fenêtres glissantes en mémoire, par clé et pour toute l'instance. */
export function createMemoryRateLimiter(options: MemoryRateLimiterOptions = {}): MemoryRateLimiter {
  const defaults = defaultWindows();
  const perKey = asList(options.perKey ?? defaults.perKey);
  const global = asList(options.global ?? defaults.global);
  const keepPerKey = longest(perKey);
  const keepGlobal = longest(global);
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const byKey = new Map<string, number[]>();
  let all: number[] = [];

  // Retire les clés expirées ; si la table reste trop grande, les plus
  // anciennes (ordre d'insertion de la Map) partent.
  const purge = (now: number) => {
    for (const [key, stamps] of byKey) {
      if (recent(stamps, now, keepPerKey).length === 0) byKey.delete(key);
    }
    for (const key of byKey.keys()) {
      if (byKey.size < maxKeys) break;
      byKey.delete(key);
    }
  };

  return {
    hit(key, now) {
      if (byKey.size >= maxKeys) purge(now);

      all = recent(all, now, keepGlobal);
      const globalWait = blocked(all, now, global);
      if (globalWait !== null) return { ok: false, retryAfterSeconds: globalWait };

      const stamps = recent(byKey.get(key) ?? [], now, keepPerKey);
      const keyWait = blocked(stamps, now, perKey);
      if (keyWait !== null) {
        byKey.set(key, stamps);
        return { ok: false, retryAfterSeconds: keyWait };
      }

      stamps.push(now);
      // Réinsérée en fin de Map : la clé la plus récemment vue part en dernier.
      byKey.delete(key);
      byKey.set(key, stamps);
      all.push(now);
      return { ok: true };
    },
    size: () => byKey.size,
  };
}

/**
 * La clé du visiteur : son IP, prise dans le premier élément de
 * x-forwarded-for (posé par Vercel), sinon x-real-ip, sinon « inconnu »
 * (tous les inconnus partagent la même limite). Une IPv6 est ramenée à son
 * préfixe /64 : un seul abonné dispose d'ordinaire d'un /64 entier, et en
 * changeant d'adresse dedans, il aurait sinon une limite neuve à chaque envoi.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim();
  return ip ? normalizeIp(ip) : 'inconnu';
}

const HEX_GROUP = /^[0-9a-f]{1,4}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Une IPv4 telle quelle ; une IPv6 réduite à son /64 (« 2001:db8:0:1::/64 »). */
export function normalizeIp(raw: string): string {
  const ip = raw
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');
  if (!ip.includes(':')) return ip;

  const halves = ip.split('::');
  if (halves.length > 2) return ip;
  const split = (part: string | undefined) => (part ? part.split(':') : []);
  const head = split(halves[0]);
  const tail = split(halves[1]);
  // Une IPv4 en fin d'adresse (« ::ffff:192.0.2.1 ») occupe deux groupes.
  const last = tail.at(-1) ?? head.at(-1);
  const embedded = last !== undefined && IPV4.test(last);
  if (embedded) (tail.length > 0 ? tail : head).pop();
  const groups = [...head, ...tail];
  if (!groups.every((group) => HEX_GROUP.test(group))) return ip;
  const total = groups.length + (embedded ? 2 : 0);
  if (halves.length === 1 ? total !== 8 : total > 7) return ip;

  // Une IPv4 transcrite en IPv6 (::ffff:a.b.c.d) reste cette IPv4.
  const full = [...head, ...Array<string>(8 - total).fill('0'), ...tail];
  if (embedded && full.slice(0, 5).every((group) => Number.parseInt(group, 16) === 0)) {
    if (Number.parseInt(full[5] ?? '', 16) === 0xffff) return last!;
  }
  const prefix = full.slice(0, 4).map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(':')}::/64`;
}
