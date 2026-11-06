import { LIFE_SIGNS_DAYS, type FactoryStats, type LifeSigns } from './types';

// DONNÉES D'EXEMPLE. Le site les affiche avec la mention « Données
// d'exemple » quand le JSON public n'est pas lisible (LIFE_SIGNS_URL absente,
// réseau, format faux : source.ts). Ce ne sont PAS des chiffres réels, et ils
// ne leur ressemblent pas exprès. Ils sont déjà arrondis comme le serveur
// arrondit les vrais (schema.ts) : heure pleine, jour, mois.

const HOUR = 3_600_000;

/** Les chiffres d'exemple de l'usine. */
const SAMPLE_FACTORY: FactoryStats = {
  channels: 6,
  videos: 200,
  perDay: 8,
  views: 120_000,
  likes: 5000,
};

/** Vidéos publiées par jour, du plus ancien au jour de la mesure. */
const SAMPLE_ACTIVITY = [6, 9, 7, 8, 5, 10, 8, 7, 9, 6, 8, 11, 7, 8];

/** En route depuis le premier jour du mois, tant de mois avant la mesure. */
const SAMPLE_MONTHS = 2;

/** Les signes de vie d'exemple, mesurés à l'instant now (ms) : dernière vidéo le jour même. */
export function sampleLifeSigns(now: number): LifeSigns {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    lastActivityAt: new Date(Date.UTC(year, month, date.getUTCDate())).toISOString(),
    since: new Date(Date.UTC(year, month - SAMPLE_MONTHS, 1)).toISOString(),
    activity: SAMPLE_ACTIVITY.slice(-LIFE_SIGNS_DAYS),
    measuredAt: new Date(Math.floor(now / HOUR) * HOUR).toISOString(),
    sample: true,
    factory: SAMPLE_FACTORY,
  };
}

/**
 * Recale des données d'exemple sur l'heure du visiteur : la page est rendue
 * au build, et « dernière vidéo aujourd'hui » y vieillirait. Les vraies
 * données (sample à false) ne bougent pas.
 */
export function rebaseLifeSigns(signs: LifeSigns, now: number): LifeSigns {
  if (!signs.sample) return signs;
  const { lastActivityAt, since, measuredAt } = sampleLifeSigns(now);
  return { ...signs, lastActivityAt, since, measuredAt };
}
