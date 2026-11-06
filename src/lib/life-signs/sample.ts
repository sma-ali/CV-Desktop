import { LIFE_SIGNS_DAYS, type FactoryStats, type LifeSigns } from './types';

// DONNÉES D'EXEMPLE. Le site les affiche avec la mention « Données
// d'exemple » quand le JSON public n'est pas lisible (LIFE_SIGNS_URL absente,
// réseau, format faux : source.ts). Les valeurs reprennent celles du
// prototype et de la maquette de l'usine (04/11/2026) : ce ne sont PAS des
// chiffres réels, ils seront recomptés avant la mise en ligne.

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

/** Les chiffres d'exemple de l'usine (maquette du 04/11/2026). */
const SAMPLE_FACTORY: FactoryStats = {
  channels: 7,
  videos: 412,
  perDay: 5,
  views: 2_431_000,
  likes: 38_412,
  genres: {
    fantasy: {
      views: 312_400,
      retention: 41,
      rejected: 14,
      minutes: 22,
      activity: [2, 3, 3, 4, 3, 5, 4, 4, 6, 5, 4, 5, 6, 5],
    },
    philosophy: {
      views: 517_300,
      retention: 38,
      rejected: 19,
      minutes: 35,
      activity: [4, 4, 5, 3, 5, 6, 5, 4, 5, 6, 6, 5, 7, 6],
    },
    marbles: {
      views: 1_048_000,
      retention: 63,
      rejected: 6,
      minutes: 18,
      activity: [6, 7, 6, 8, 7, 7, 8, 6, 7, 8, 8, 7, 8, 8],
    },
    quiz: {
      views: 402_900,
      retention: 55,
      rejected: 3,
      minutes: 9,
      activity: [5, 6, 6, 5, 7, 6, 6, 7, 5, 6, 7, 7, 6, 7],
    },
  },
};

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
    factory: SAMPLE_FACTORY,
  };
}
