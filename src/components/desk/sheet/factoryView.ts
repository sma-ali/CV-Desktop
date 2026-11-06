import {
  FACTORY_GENRES,
  LIFE_SIGNS_DAYS,
  type FactoryGenreId,
  type LifeSigns,
} from '@/lib/life-signs';
import type { SheetsContent } from '@/content/sheets/schema';

// Ce que la fiche de l'usine affiche : le circuit, les chiffres globaux, un
// graphique global sur 14 jours, et un onglet par genre. Les chiffres
// viennent des signes de vie (JSON public filtré et arrondi par le serveur,
// ou l'exemple) ; vidéos, vues et j'aime s'affichent en « plus de N »,
// arrondi vers le bas, jamais au-dessus du vrai chiffre. Aucun chiffre par
// genre, jamais d'heure : rien qui permette de recouper avec une chaîne.
// Fonction pure : la fiche l'appelle avec Date.now(), les tests avec un
// instant fixe. Les données viennent d'un JSON public : elles sont
// relues avec méfiance (nombres faux, dates illisibles).

export type FactoryTexts = SheetsContent['ui']['factory'];

const DAY = 86_400_000;

/** Une barre du graphique : la valeur du jour et sa hauteur, de 0 à 1. */
interface ActivityBar {
  value: number;
  level: number;
}

interface FactoryFigure {
  value: string;
  label: string;
  /** Les vues et les j'aime prennent toute la largeur. */
  wide: boolean;
}

interface FactoryGenreView {
  id: FactoryGenreId;
  tab: string;
  title: string;
  body: string;
  rows: readonly { term: string; value: string }[];
}

export interface FactoryView {
  sample: boolean;
  /** « En marche | dernière vidéo hier », ou « En marche » seul. */
  status: string;
  figures: FactoryFigure[];
  /** « depuis octobre 2026 », ou rien si la date est illisible. */
  since: string | null;
  /** Les LIFE_SIGNS_DAYS barres, du plus ancien jour au jour de la mesure. */
  bars: ActivityBar[];
  /** Le texte équivalent du graphique (aria-label). */
  chartLabel: string;
  axisStart: string;
  axisEnd: string;
  genres: FactoryGenreView[];
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

const clean = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

/** Un nombre de vidéos propre : entier, jamais négatif ni absent. */
const cleanCount = (value: unknown): number => Math.round(clean(value));

/**
 * Les 14 derniers jours, quel que soit ce qu'on reçoit : trop court, on
 * complète par des jours vides au début ; trop long, on garde la fin.
 */
export function normalizeActivity(activity: readonly unknown[] | undefined): number[] {
  const values = (Array.isArray(activity) ? activity : []).map(cleanCount);
  const recent = values.slice(-LIFE_SIGNS_DAYS);
  return [...Array<number>(LIFE_SIGNS_DAYS - recent.length).fill(0), ...recent];
}

/**
 * Un grand nombre arrondi VERS LE BAS à deux chiffres significatifs, en
 * notation courte (2 431 000 : « 2,4 M » ; 38 412 : « 38 k »). Jamais
 * au-dessus du vrai chiffre : il se lit « plus de ».
 */
export function floorCompact(n: number, locale: string): string {
  const options = {
    notation: 'compact',
    maximumSignificantDigits: 2,
    roundingMode: 'floor',
  } as Intl.NumberFormatOptions;
  return new Intl.NumberFormat(locale, options).format(Math.floor(clean(n)));
}

const plain = (n: number, locale: string) => new Intl.NumberFormat(locale).format(cleanCount(n));

/** Jours UTC entiers entre deux instants (jamais négatifs), ou null si l'un est illisible. */
function daysBetween(from: string, now: number): number | null {
  const start = Date.parse(from);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor(now / DAY) - Math.floor(start / DAY));
}

/** « octobre 2026 », « October 2026 » : le mois et l'année (UTC), ou null. */
function monthYear(iso: string, locale: string): string | null {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(time);
}

export function factoryView(
  signs: LifeSigns | null,
  now: number,
  texts: FactoryTexts,
  locale: string,
): FactoryView | null {
  const stats = signs?.factory;
  if (!signs || !stats) return null;
  const more = (n: number) => fill(texts.more, { n: floorCompact(n, locale) });
  const plural = (forms: { one: string; other: string }, n: number) =>
    new Intl.PluralRules(locale).select(n) === 'one' ? forms.one : forms.other;

  const days = daysBetween(signs.lastActivityAt, now);
  const ago =
    days === null
      ? null
      : days === 0
        ? texts.ago.today
        : days === 1
          ? texts.ago.yesterday
          : fill(plural(texts.ago.days, days), { n: days });
  const status = ago ? `${texts.status} | ${fill(texts.last, { ago })}` : texts.status;

  const channels = cleanCount(stats.channels);
  const videos = cleanCount(stats.videos);
  const figures: FactoryFigure[] = [
    {
      value: plain(channels, locale),
      label: plural(texts.figures.channels, channels),
      wide: false,
    },
    { value: more(videos), label: plural(texts.figures.videos, videos), wide: false },
    { value: plain(stats.perDay, locale), label: texts.figures.perDay, wide: false },
    { value: more(stats.views), label: texts.figures.views, wide: true },
    { value: more(stats.likes), label: texts.figures.likes, wide: true },
  ];

  const date = monthYear(signs.since, locale);
  const activity = normalizeActivity(signs.activity);
  const max = Math.max(1, ...activity);

  const genres = FACTORY_GENRES.map((id): FactoryGenreView => {
    const { tab, title, body, rows } = texts.genres[id];
    return { id, tab, title, body, rows };
  });

  return {
    sample: signs.sample,
    status,
    figures,
    since: date ? fill(texts.since, { date }) : null,
    bars: activity.map((value) => ({ value, level: value / max })),
    chartLabel: fill(texts.chart, { days: LIFE_SIGNS_DAYS, values: activity.join(', ') }),
    axisStart: fill(texts.axisStart, { days: LIFE_SIGNS_DAYS }),
    axisEnd: texts.axisEnd,
    genres,
  };
}
