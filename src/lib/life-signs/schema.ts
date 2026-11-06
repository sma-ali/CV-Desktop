import { z } from 'zod';
import { LIFE_SIGNS_DAYS, type FactoryStats, type LifeSigns } from './types';

// Le format du JSON public des signes de vie (version 2), validé par zod
// côté serveur seulement (source.ts) : ce fichier n'est pas exporté par
// index.ts, pour que zod n'entre jamais dans le JavaScript du navigateur.
//
// Liste blanche : z.object ignore les champs inconnus, donc seuls ceux-ci
// ressortent, même si le JSON source en contient d'autres (un ancien champ
// par genre, par exemple). Pour élargir le format plus tard, ajouter un champ
// ici et dans LifeSigns (types.ts).
//
// Arrondi (défense en profondeur) : même si la source envoyait des chiffres
// exacts, rien de précis ne sort. Un chiffre exact ou une heure exacte
// permettrait de recouper avec les compteurs publics d'une chaîne.

/** Marge tolérée sur une mesure datée dans le futur (horloges décalées). */
export const LIFE_SIGNS_FUTURE_MARGIN_MS = 5 * 60_000;

/** Chiffres significatifs gardés sur les vidéos, les vues et les j'aime. */
const SIGNIFICANT_DIGITS = 2;

const HOUR = 3_600_000;

/** Un instant ISO 8601 avec fuseau (Z ou décalage), ramené en UTC. */
const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

const count = z.int().nonnegative();

const factorySchema = z.object({
  channels: count,
  videos: count,
  perDay: z.number().nonnegative(),
  views: count,
  likes: count,
});

/** Le JSON public, champ par champ (sans sample, que le serveur pose lui-même). */
const publicLifeSignsSchema = z.object({
  version: z.literal(2),
  measuredAt: instant,
  lastActivityAt: instant,
  since: instant,
  activity: z.array(count).length(LIFE_SIGNS_DAYS),
  factory: factorySchema,
});

/**
 * n arrondi VERS LE BAS à digits chiffres significatifs (303 174 donne
 * 300 000 avec 2 chiffres ; 353 donne 350). Jamais au-dessus du vrai chiffre.
 * Un nombre négatif ou faux donne 0.
 */
export function floorSignificant(n: number, digits: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const whole = Math.floor(n);
  const length = String(whole).length;
  if (length <= digits) return whole;
  const step = 10 ** (length - digits);
  return Math.floor(whole / step) * step;
}

const iso = (time: number) => new Date(time).toISOString();

/** L'heure pleine (UTC) d'un instant, vers le bas. */
const floorHour = (value: string) => iso(Math.floor(Date.parse(value) / HOUR) * HOUR);

/** Le début du jour (UTC) d'un instant. */
function floorDay(value: string): string {
  const date = new Date(value);
  return iso(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Le premier jour du mois (UTC) d'un instant, à 00:00. */
function floorMonth(value: string): string {
  const date = new Date(value);
  return iso(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function roundFactory(stats: FactoryStats): FactoryStats {
  return {
    channels: stats.channels,
    videos: floorSignificant(stats.videos, SIGNIFICANT_DIGITS),
    perDay: Math.round(stats.perDay),
    views: floorSignificant(stats.views, SIGNIFICANT_DIGITS),
    likes: floorSignificant(stats.likes, SIGNIFICANT_DIGITS),
  };
}

/**
 * Le JSON public validé à l'instant now (ms) : format, puis cohérence des
 * dates (since <= lastActivityAt <= measuredAt, mesure pas dans le futur au
 * delà de la marge), puis arrondi. La cohérence se vérifie sur les dates
 * reçues : arrondir chacune vers le bas (mois, jour, heure) garde leur ordre,
 * donc un JSON valide n'est jamais refusé à cause de l'arrondi. Renvoie les
 * vrais signes de vie arrondis (sample à false), ou les chemins des champs
 * fautifs (jamais leurs valeurs).
 */
export function parsePublicLifeSigns(
  data: unknown,
  now: number,
): { ok: true; signs: LifeSigns } | { ok: false; issues: string[] } {
  const schema = publicLifeSignsSchema.superRefine((signs, ctx) => {
    const since = Date.parse(signs.since);
    const last = Date.parse(signs.lastActivityAt);
    const measured = Date.parse(signs.measuredAt);
    if (since > last) {
      ctx.addIssue({ code: 'custom', path: ['since'], message: 'après la dernière activité' });
    }
    if (last > measured) {
      ctx.addIssue({ code: 'custom', path: ['lastActivityAt'], message: 'après la mesure' });
    }
    if (measured > now + LIFE_SIGNS_FUTURE_MARGIN_MS) {
      ctx.addIssue({ code: 'custom', path: ['measuredAt'], message: 'dans le futur' });
    }
  });
  const result = schema.safeParse(data);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.') || '(racine)');
    return { ok: false, issues: [...new Set(paths)] };
  }
  const signs = result.data;
  // Champ par champ : rien d'autre que ce qui est nommé ici ne sort.
  return {
    ok: true,
    signs: {
      lastActivityAt: floorDay(signs.lastActivityAt),
      since: floorMonth(signs.since),
      activity: signs.activity,
      measuredAt: floorHour(signs.measuredAt),
      sample: false,
      factory: roundFactory(signs.factory),
    },
  };
}
