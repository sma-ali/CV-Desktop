// Limite de débit du formulaire de contact.
//
// L'implémentation en mémoire vit dans une instance du serveur : sur Vercel,
// plusieurs instances peuvent tourner en même temps, et chacune compte de son
// côté (une instance froide repart de zéro). Elle freine un visiteur trop
// pressé ou un robot naïf et protège le quota d'envoi, sans plus. La vraie
// barrière est une règle de limite de débit du pare-feu Vercel sur
// /api/contact, posée à la mise en ligne. L'interface RateLimiter permet de
// brancher plus tard un stockage partagé sans toucher à la route.

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
  /** Par clé (IP) : 5 envois par 10 minutes par défaut. */
  perKey?: Window;
  /** Pour toute l'instance : 30 envois par heure par défaut. */
  global?: Window;
  /** Nombre maximal de clés gardées en mémoire. */
  maxKeys?: number;
}

export const DEFAULT_PER_KEY: Window = { max: 5, windowMs: 10 * 60_000 };
export const DEFAULT_GLOBAL: Window = { max: 30, windowMs: 60 * 60_000 };
export const DEFAULT_MAX_KEYS = 10_000;

export interface MemoryRateLimiter extends RateLimiter {
  /** Nombre de clés en mémoire (pour les tests). */
  size(): number;
}

/** Les instants encore dans la fenêtre, du plus ancien au plus récent. */
function recent(stamps: number[], now: number, windowMs: number): number[] {
  return stamps.filter((stamp) => now - stamp < windowMs);
}

function retryAfter(stamps: number[], now: number, windowMs: number): number {
  const oldest = stamps[0] ?? now;
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

/** Fenêtre glissante en mémoire, par clé et pour toute l'instance. */
export function createMemoryRateLimiter(options: MemoryRateLimiterOptions = {}): MemoryRateLimiter {
  const perKey = options.perKey ?? DEFAULT_PER_KEY;
  const global = options.global ?? DEFAULT_GLOBAL;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const byKey = new Map<string, number[]>();
  let all: number[] = [];

  // Retire les clés expirées ; si la table reste trop grande, les plus
  // anciennes (ordre d'insertion de la Map) partent.
  const purge = (now: number) => {
    for (const [key, stamps] of byKey) {
      if (recent(stamps, now, perKey.windowMs).length === 0) byKey.delete(key);
    }
    for (const key of byKey.keys()) {
      if (byKey.size < maxKeys) break;
      byKey.delete(key);
    }
  };

  return {
    hit(key, now) {
      if (byKey.size >= maxKeys) purge(now);

      all = recent(all, now, global.windowMs);
      if (all.length >= global.max) {
        return { ok: false, retryAfterSeconds: retryAfter(all, now, global.windowMs) };
      }

      const stamps = recent(byKey.get(key) ?? [], now, perKey.windowMs);
      if (stamps.length >= perKey.max) {
        byKey.set(key, stamps);
        return { ok: false, retryAfterSeconds: retryAfter(stamps, now, perKey.windowMs) };
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
 * L'IP du visiteur : le premier élément de x-forwarded-for (posé par Vercel),
 * sinon x-real-ip, sinon « inconnu » (tous les inconnus partagent la même limite).
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get('x-real-ip')?.trim();
  return real || 'inconnu';
}
