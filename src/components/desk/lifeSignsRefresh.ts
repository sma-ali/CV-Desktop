import {
  FACTORY_GENRES,
  type FactoryGenreStats,
  type FactoryStats,
  type LifeSigns,
} from '@/lib/life-signs';

// Le rafraîchissement des signes de vie à l'ouverture de la fiche du coffret.
// La page est régénérée au plus toutes les 10 minutes, mais un visiteur peut
// la garder ouverte longtemps : si la mesure a plus de 10 minutes, le
// navigateur redemande /api/signes-de-vie, sans bloquer la fiche. En cas
// d'échec, il garde ce qu'il a. Ni zod ni contenu ici (JavaScript initial) :
// le serveur a déjà validé le JSON, on vérifie seulement sa forme.

/** La route qui sert les signes de vie. */
export const LIFE_SIGNS_ENDPOINT = '/api/signes-de-vie';
/** Au-delà de cet âge, la mesure est redemandée. */
export const LIFE_SIGNS_STALE_MS = 10 * 60_000;
/** Après un essai, échoué ou non, pas de nouvel essai avant ce délai. */
export const LIFE_SIGNS_RETRY_MS = 60_000;
/** Délai maximal de la requête du navigateur. */
export const LIFE_SIGNS_CLIENT_TIMEOUT_MS = 5000;

const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const optional = (value: unknown): number | undefined | null =>
  value === undefined ? undefined : isNumber(value) ? value : null;

function toGenre(value: unknown): FactoryGenreStats | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  const { views, activity } = data;
  if (!isCount(views) || !Array.isArray(activity) || !activity.every(isCount)) return null;
  const retention = optional(data.retention);
  const rejected = optional(data.rejected);
  const minutes = optional(data.minutes);
  if (retention === null || rejected === null || minutes === null) return null;
  const genre: FactoryGenreStats = { views, activity: [...activity] };
  if (retention !== undefined) genre.retention = retention;
  if (rejected !== undefined) genre.rejected = rejected;
  if (minutes !== undefined) genre.minutes = minutes;
  return genre;
}

/** Les chiffres de l'usine, ou null si leur forme est fausse (champ par champ, rien de plus). */
function toFactory(value: unknown): FactoryStats | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  const { channels, videos, perDay, views, likes, genres } = data;
  if (!isCount(channels) || !isCount(videos) || !isNumber(perDay)) return null;
  if (!isCount(views) || !isCount(likes)) return null;
  if (typeof genres !== 'object' || genres === null) return null;
  const parsed: Partial<FactoryStats['genres']> = {};
  for (const id of FACTORY_GENRES) {
    const genre = toGenre((genres as Record<string, unknown>)[id]);
    if (!genre) return null;
    parsed[id] = genre;
  }
  return {
    channels,
    videos,
    perDay,
    views,
    likes,
    genres: parsed as FactoryStats['genres'],
  };
}

/**
 * Les signes de vie reçus de la route, ou null si leur forme est fausse.
 * Seuls les champs connus sont gardés.
 */
export function toLifeSigns(value: unknown): LifeSigns | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  const { running, lastActivityAt, since, activity, measuredAt, sample } = data;
  if (!isCount(running) || !Array.isArray(activity) || !activity.every(isCount)) return null;
  if (!isInstant(lastActivityAt) || !isInstant(since) || !isInstant(measuredAt)) return null;
  if (typeof sample !== 'boolean') return null;
  const signs: LifeSigns = {
    running,
    lastActivityAt,
    since,
    activity: [...activity],
    measuredAt,
    sample,
  };
  // Les chiffres de l'usine sont facultatifs : mal formés, ils sont ignorés.
  const factory = data.factory === undefined ? null : toFactory(data.factory);
  if (factory) signs.factory = factory;
  return signs;
}

/** La mesure a-t-elle plus de LIFE_SIGNS_STALE_MS à l'instant now ? Illisible ou absente : oui. */
export function isStale(signs: LifeSigns | null, now: number): boolean {
  if (!signs) return true;
  const measured = Date.parse(signs.measuredAt);
  return !Number.isFinite(measured) || now - measured >= LIFE_SIGNS_STALE_MS;
}

export interface LifeSignsRefresher {
  /**
   * Redemande les signes de vie s'ils sont trop vieux. Renvoie ceux à
   * montrer (tels que reçus, avant recalage), ou null s'il n'y a rien à
   * changer : mesure récente, essai trop proche, déjà en cours, échec.
   */
  refresh(): Promise<LifeSigns | null>;
}

export interface LifeSignsRefresherDeps {
  fetch: typeof fetch;
  now: () => number;
  timeoutMs?: number;
}

/**
 * initial : les signes de vie de la page, tels que le serveur les a mesurés
 * (pas ceux recalés sur l'heure du visiteur, qui paraîtraient toujours
 * récents).
 */
export function createLifeSignsRefresher(
  initial: LifeSigns | null,
  deps: LifeSignsRefresherDeps,
): LifeSignsRefresher {
  let current = initial;
  let lastAttempt = Number.NEGATIVE_INFINITY;
  let pending = false;

  async function load(): Promise<LifeSigns | null> {
    try {
      const response = await deps.fetch(LIFE_SIGNS_ENDPOINT, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(deps.timeoutMs ?? LIFE_SIGNS_CLIENT_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return toLifeSigns(await response.json());
    } catch {
      return null;
    }
  }

  return {
    async refresh() {
      const now = deps.now();
      if (pending || now - lastAttempt < LIFE_SIGNS_RETRY_MS || !isStale(current, now)) {
        return null;
      }
      pending = true;
      lastAttempt = now;
      try {
        const fresh = await load();
        if (!fresh) return null;
        // De vraies données, même un peu vieilles, valent mieux que l'exemple.
        if (fresh.sample && current && !current.sample) return null;
        current = fresh;
        return fresh;
      } finally {
        pending = false;
      }
    },
  };
}
