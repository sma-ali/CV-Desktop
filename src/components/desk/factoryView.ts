import {
  FACTORY_GENRES,
  type FactoryGenreId,
  type LifeSigns,
  type LifeSignsTexts,
} from '@/lib/life-signs';
import type { SheetsContent } from '@/content/sheets/schema';
import { chestLiveView, normalizeActivity, type ActivityBar } from './lifeSignsView';

// Ce que la fiche de l'usine affiche : le circuit, les chiffres globaux, et
// un onglet par genre. Les chiffres viennent des signes de vie (JSON public
// filtré, ou l'exemple) ; les vues et les j'aime s'affichent en « plus de
// N », arrondi vers le bas, jamais au-dessus du vrai chiffre. Fonction pure :
// la fiche l'appelle avec Date.now(), les tests avec un instant fixe.

export type FactoryTexts = SheetsContent['ui']['factory'];

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
  rows: { term: string; value: string }[];
  bars: ActivityBar[];
  /** Le texte équivalent du graphique (aria-label). */
  chartLabel: string;
  legend: string;
}

export interface FactoryView {
  sample: boolean;
  /** « En marche | dernière vidéo il y a 2 h 14 », ou « En marche » seul. */
  status: string;
  figures: FactoryFigure[];
  genres: FactoryGenreView[];
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

const clean = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

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

const plain = (n: number, locale: string, digits = 0) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(clean(n));

export function factoryView(
  signs: LifeSigns | null,
  now: number,
  texts: FactoryTexts,
  live: LifeSignsTexts,
  locale: string,
): FactoryView | null {
  const stats = signs?.factory;
  if (!signs || !stats) return null;
  const more = (n: number) => fill(texts.more, { n: floorCompact(n, locale) });
  const plural = (forms: { one: string; other: string }, n: number) =>
    new Intl.PluralRules(locale).select(n) === 'one' ? forms.one : forms.other;

  const liveView = chestLiveView(signs, now, live, locale);
  const status = liveView
    ? `${texts.status} | ${fill(texts.last, { ago: liveView.lastActivity })}`
    : texts.status;

  const channels = Math.round(clean(stats.channels));
  const videos = Math.round(clean(stats.videos));
  const figures: FactoryFigure[] = [
    {
      value: plain(channels, locale),
      label: plural(texts.figures.channels, channels),
      wide: false,
    },
    { value: plain(videos, locale), label: plural(texts.figures.videos, videos), wide: false },
    { value: plain(stats.perDay, locale, 1), label: texts.figures.perDay, wide: false },
    { value: more(stats.views), label: texts.figures.views, wide: true },
    { value: more(stats.likes), label: texts.figures.likes, wide: true },
  ];

  const genres = FACTORY_GENRES.map((id): FactoryGenreView => {
    const copy = texts.genres[id];
    const genre = stats.genres[id];
    const rows = [...copy.rows, { term: texts.stats.views, value: more(genre.views) }];
    const percent = (n: number) => plain(n, locale);
    if (genre.retention !== undefined) {
      rows.push({
        term: texts.stats.retention,
        value: fill(texts.stats.retentionValue, { n: percent(genre.retention) }),
      });
    }
    if (genre.rejected !== undefined) {
      rows.push({
        term: texts.stats.rejected,
        value: fill(texts.stats.rejectedValue, { n: percent(genre.rejected) }),
      });
    }
    if (genre.minutes !== undefined) {
      rows.push({
        term: texts.stats.production,
        value: fill(texts.stats.productionValue, { n: plain(genre.minutes, locale) }),
      });
    }
    const activity = normalizeActivity(genre.activity);
    const max = Math.max(1, ...activity);
    return {
      id,
      tab: copy.tab,
      title: copy.title,
      body: copy.body,
      rows,
      bars: activity.map((value) => ({ value, level: value / max })),
      chartLabel: fill(texts.chart, { days: activity.length, values: activity.join(', ') }),
      legend: fill(texts.legend, { days: activity.length }),
    };
  });

  return { sample: signs.sample, status, figures, genres };
}
