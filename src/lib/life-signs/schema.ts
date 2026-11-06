import { z } from 'zod';
import { FACTORY_GENRES, LIFE_SIGNS_DAYS, type LifeSigns } from './types';

// Le format du JSON public des signes de vie, validé par zod côté serveur
// seulement (source.ts) : ce fichier n'est pas exporté par index.ts, pour que
// zod n'entre jamais dans le JavaScript du navigateur.
//
// Liste blanche : z.object ignore les champs inconnus, donc seuls ceux-ci
// ressortent, même si le JSON source en contient d'autres. Pour élargir le
// format plus tard, ajouter un champ ici et dans LifeSigns (types.ts).

/** Marge tolérée sur une mesure datée dans le futur (horloges décalées). */
export const LIFE_SIGNS_FUTURE_MARGIN_MS = 5 * 60_000;

/** Un instant ISO 8601 avec fuseau (Z ou décalage), ramené en UTC. */
const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

const count = z.int().nonnegative();
const percent = z.number().min(0).max(100);

const genreSchema = z.object({
  views: count,
  retention: percent.optional(),
  rejected: percent.optional(),
  minutes: z
    .number()
    .positive()
    .max(24 * 60)
    .optional(),
  activity: z.array(count).length(LIFE_SIGNS_DAYS),
});

/** Les chiffres de l'usine : facultatifs (un ancien JSON n'en a pas), complets s'ils sont là. */
const factorySchema = z.object({
  channels: count,
  videos: count,
  perDay: z.number().nonnegative(),
  views: count,
  likes: count,
  genres: z.object(
    Object.fromEntries(FACTORY_GENRES.map((id) => [id, genreSchema])) as Record<
      (typeof FACTORY_GENRES)[number],
      typeof genreSchema
    >,
  ),
});

/** Le JSON public, champ par champ (sans sample, que le serveur pose lui-même). */
const publicLifeSignsSchema = z.object({
  running: count,
  lastActivityAt: instant,
  since: instant,
  activity: z.array(count).length(LIFE_SIGNS_DAYS),
  measuredAt: instant,
  factory: factorySchema.optional(),
});

/**
 * Le JSON public validé à l'instant now (ms) : format, puis cohérence des
 * dates (since <= lastActivityAt <= measuredAt, mesure pas dans le futur au
 * delà de la marge). Renvoie les vrais signes de vie (sample à false), ou
 * les chemins des champs fautifs (jamais leurs valeurs).
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
  return { ok: true, signs: { ...result.data, sample: false } };
}
