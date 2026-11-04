// Les signes de vie du coffret scellé : des chiffres d'activité, jamais ce
// que sont les projets. Aucune dépendance (ni zod ni contenu) : le serveur,
// le HUD et la scène partagent ces types et ces fonctions pures. Le schéma
// zod du JSON public, côté serveur seulement, est dans schema.ts.

/** Nombre de jours du graphique d'activité. */
export const LIFE_SIGNS_DAYS = 14;

/**
 * Ce que /api/signes-de-vie renvoie et ce que la page passe au navigateur,
 * en props. Horodatages en ISO 8601 (UTC).
 */
export interface LifeSigns {
  /** Projets en marche. */
  running: number;
  /** Instant de la dernière activité. */
  lastActivityAt: string;
  /** Instant du premier jour (« en route depuis »). */
  since: string;
  /** Activité de chacun des LIFE_SIGNS_DAYS derniers jours, du plus ancien au jour de la mesure. */
  activity: readonly number[];
  /** Instant de la mesure : le dernier jour d'activity est celui-ci. */
  measuredAt: string;
  /** Données d'exemple, affichées comme telles. */
  sample: boolean;
  /** Les chiffres de l'usine (fiche à onglets), absents d'un ancien JSON. */
  factory?: FactoryStats | undefined;
}

/**
 * Les genres montrés en exemple dans la fiche de l'usine. Jamais de nom de
 * chaîne, de compte ni de lien : un genre seulement.
 */
export const FACTORY_GENRES = ['fantasy', 'philosophy', 'marbles', 'quiz'] as const;

export type FactoryGenreId = (typeof FACTORY_GENRES)[number];

/** Les chiffres d'un genre. Les champs facultatifs ne s'affichent que s'ils sont là. */
export interface FactoryGenreStats {
  /** Vues depuis le début (affichées en « plus de N », arrondi vers le bas). */
  views: number;
  /** Rétention moyenne, en pourcentage (0 à 100). */
  retention?: number | undefined;
  /** Part des vidéos refusées par les relecteurs ou le contrôle, en pourcentage. */
  rejected?: number | undefined;
  /** Durée moyenne de production d'une vidéo, en minutes. */
  minutes?: number | undefined;
  /** Vidéos produites chacun des LIFE_SIGNS_DAYS derniers jours, du plus ancien au jour de la mesure. */
  activity: readonly number[];
}

/** Les chiffres globaux de l'usine, et ceux de chaque genre montré. */
export interface FactoryStats {
  /** Chaînes produites par l'usine (recomptées : publication automatique ou validée à la main). */
  channels: number;
  /** Vidéos produites depuis le début. */
  videos: number;
  /** Vidéos par jour, en moyenne (une décimale au plus). */
  perDay: number;
  /** Vues depuis le début, toutes chaînes. */
  views: number;
  /** J'aime depuis le début, toutes chaînes. */
  likes: number;
  genres: Record<FactoryGenreId, FactoryGenreStats>;
}

const MINUTE = 60_000;

/**
 * Recale des données d'exemple sur l'heure du visiteur : la page est rendue
 * au build, et « il y a 2 h 14 » y vieillirait. Les vraies données (sample à
 * false) ne bougent pas.
 */
export function rebaseLifeSigns(signs: LifeSigns, now: number): LifeSigns {
  if (!signs.sample) return signs;
  const shift = now - Date.parse(signs.measuredAt);
  const move = (iso: string) => new Date(Date.parse(iso) + shift).toISOString();
  return {
    ...signs,
    lastActivityAt: move(signs.lastActivityAt),
    since: move(signs.since),
    measuredAt: new Date(now).toISOString(),
  };
}

/**
 * Le battement de la LED et du liseré du coffret, d'après l'activité : plus
 * les derniers jours sont actifs, plus le cœur bat vite et fort. period en
 * secondes entre deux battements, strength de 0.35 à 1.
 */
export function activityPulse(signs: LifeSigns | null): { period: number; strength: number } {
  const values = signs?.activity ?? [];
  const max = Math.max(0, ...values);
  if (!signs || max <= 0 || signs.running <= 0) return { period: 3.4, strength: 0.35 };
  // Les trois derniers jours, rapportés au jour le plus actif.
  const recent = values.slice(-3);
  const level = recent.reduce((sum, value) => sum + value, 0) / (recent.length * max);
  const k = Math.min(1, Math.max(0, level));
  return { period: 3.4 - k * 1.8, strength: 0.35 + k * 0.65 };
}

/** Minutes entières entre deux instants (jamais négatives). */
export function minutesBetween(from: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(from)) / MINUTE));
}
