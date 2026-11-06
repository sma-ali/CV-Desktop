// Les signes de vie de l'usine (projets perso) : des chiffres d'activité
// globaux et arrondis, jamais ce que sont les chaînes. Aucune dépendance (ni
// zod ni contenu) : le serveur, le HUD et la scène partagent ces types et ces
// fonctions pures. Le schéma zod du JSON public et l'arrondi, côté serveur
// seulement, sont dans schema.ts.

/** Nombre de jours du graphique d'activité. */
export const LIFE_SIGNS_DAYS = 14;

/**
 * Ce que /api/signes-de-vie renvoie et ce que la page passe au navigateur,
 * en props. Horodatages en ISO 8601 (UTC), déjà arrondis par le serveur.
 */
export interface LifeSigns {
  /** Début du jour (UTC) de la dernière vidéo publiée. */
  lastActivityAt: string;
  /** Premier jour du mois (UTC) où l'usine a démarré. */
  since: string;
  /**
   * Vidéos publiées chacun des LIFE_SIGNS_DAYS derniers jours, toutes
   * chaînes mêlées, du plus ancien au jour de la mesure.
   */
  activity: readonly number[];
  /** Instant de la mesure, à l'heure pleine (UTC) : le dernier jour d'activity est celui-ci. */
  measuredAt: string;
  /** Données d'exemple, affichées comme telles. */
  sample: boolean;
  factory: FactoryStats;
}

/**
 * Les genres montrés en exemple dans la fiche de l'usine. Jamais de nom de
 * chaîne, de compte ni de lien, et aucun chiffre par genre : un genre peut
 * n'être qu'une chaîne, ses chiffres permettraient de la retrouver.
 */
export const FACTORY_GENRES = ['fantasy', 'philosophy', 'marbles', 'quiz'] as const;

export type FactoryGenreId = (typeof FACTORY_GENRES)[number];

/** Les chiffres globaux de l'usine, toutes chaînes mêlées, arrondis par le serveur. */
export interface FactoryStats {
  /** Chaînes produites par l'usine (recomptées : publication automatique ou validée à la main). */
  channels: number;
  /** Vidéos publiées depuis le début (deux chiffres significatifs, arrondi vers le bas). */
  videos: number;
  /** Vidéos par jour, en moyenne (entier). */
  perDay: number;
  /** Vues depuis le début (deux chiffres significatifs, arrondi vers le bas). */
  views: number;
  /** J'aime depuis le début (deux chiffres significatifs, arrondi vers le bas). */
  likes: number;
}

/**
 * Le battement de la LED et du liseré de l'usine, d'après l'activité : plus
 * les derniers jours sont actifs, plus le cœur bat vite et fort. period en
 * secondes entre deux battements, strength de 0.35 à 1.
 */
export function activityPulse(signs: LifeSigns | null): { period: number; strength: number } {
  const values = signs?.activity ?? [];
  const max = Math.max(0, ...values);
  if (!signs || max <= 0) return { period: 3.4, strength: 0.35 };
  // Les trois derniers jours, rapportés au jour le plus actif.
  const recent = values.slice(-3);
  const level = recent.reduce((sum, value) => sum + value, 0) / (recent.length * max);
  const k = Math.min(1, Math.max(0, level));
  return { period: 3.4 - k * 1.8, strength: 0.35 + k * 0.65 };
}
