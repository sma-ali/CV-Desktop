import { LIFE_SIGNS_DAYS, type LifeSigns } from './types';

// DONNÉES D'EXEMPLE. Le site les affiche avec la mention « Données
// d'exemple » tant que /api/signes-de-vie (étape 5) ne lit pas le vrai JSON
// public, qui ne contiendra que ces chiffres. Les valeurs reprennent celles
// du prototype ; Ali valide ce qui s'affiche.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** L'exemple, relatif à l'instant de la mesure. */
export const SAMPLE_LIFE_SIGNS = {
  running: 3,
  /** Dernière activité : 2 h 14 avant la mesure. */
  lastActivityAgoMs: 2 * HOUR + 14 * MINUTE,
  /** En route depuis 47 jours et 3 heures. */
  sinceAgoMs: 47 * DAY + 3 * HOUR,
  activity: [3, 5, 2, 0, 4, 6, 3, 7, 5, 2, 6, 4, 8, 5],
} as const;

/** Les signes de vie d'exemple, mesurés à l'instant now (ms). */
export function sampleLifeSigns(now: number): LifeSigns {
  const activity = SAMPLE_LIFE_SIGNS.activity.slice(-LIFE_SIGNS_DAYS);
  return {
    running: SAMPLE_LIFE_SIGNS.running,
    lastActivityAt: new Date(now - SAMPLE_LIFE_SIGNS.lastActivityAgoMs).toISOString(),
    since: new Date(now - SAMPLE_LIFE_SIGNS.sinceAgoMs).toISOString(),
    activity,
    measuredAt: new Date(now).toISOString(),
    sample: true,
  };
}
