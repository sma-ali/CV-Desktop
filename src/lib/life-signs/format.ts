import { LIFE_SIGNS_DAYS, minutesBetween, type LifeSigns } from './types';

// Les signes de vie mis en mots, dans la langue de la page et par rapport à
// l'heure du visiteur. Fonctions pures : le HUD les appelle avec Date.now(),
// les tests avec un instant fixe. Les gabarits viennent du contenu
// (sheets.ui.live) ; {n}, {h}, {mm}, {days}, {values} y sont remplacés.

/** Une forme au singulier et une au pluriel (règles d'Intl.PluralRules). */
export interface PluralTexts {
  one: string;
  other: string;
}

/** Les textes des signes de vie (content.sheets.ui.live). */
export interface LifeSignsTexts {
  title: string;
  /** La mention des données d'exemple. */
  sample: string;
  running: string;
  last: string;
  since: string;
  /** Libellé du graphique (role="img") : {days} et {values}. */
  chart: string;
  /** Bornes de l'axe : {days}. */
  axisStart: string;
  axisEnd: string;
  /** « il y a ... » : à l'instant, minutes ({n}), heures ({h}, {mm} sur deux chiffres), jours ({n}). */
  ago: {
    now: string;
    minutes: string;
    hours: string;
    hoursMinutes: string;
    days: PluralTexts;
  };
  /** Durée depuis le premier jour ({n}). */
  age: PluralTexts;
}

/** Ce que la fiche du coffret affiche. */
export interface LifeSignsView {
  running: string;
  lastActivity: string;
  since: string;
  activity: readonly number[];
  /** Le jour le plus actif (pour l'échelle du graphique), au moins 1. */
  max: number;
  /** Le texte équivalent du graphique (aria-label). */
  chartLabel: string;
  axisStart: string;
  axisEnd: string;
  sample: boolean;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

function plural(texts: PluralTexts, n: number, locale: string): string {
  const form = new Intl.PluralRules(locale).select(n) === 'one' ? texts.one : texts.other;
  return fill(form, { n });
}

/** « il y a 2 h 14 », « 3 min ago »... d'après les minutes écoulées. */
export function agoText(minutes: number, texts: LifeSignsTexts['ago'], locale: string): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return texts.now;
  if (m < 60) return fill(texts.minutes, { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) {
    const rest = m % 60;
    return rest === 0
      ? fill(texts.hours, { h })
      : fill(texts.hoursMinutes, { h, mm: String(rest).padStart(2, '0') });
  }
  return plural(texts.days, Math.floor(h / 24), locale);
}

/** Les signes de vie mis en mots à l'instant now (ms), dans la langue locale. */
export function formatLifeSigns(
  signs: LifeSigns,
  now: number,
  texts: LifeSignsTexts,
  locale: string,
): LifeSignsView {
  const days = Math.floor(minutesBetween(signs.since, now) / (60 * 24));
  return {
    running: new Intl.NumberFormat(locale).format(signs.running),
    lastActivity: agoText(minutesBetween(signs.lastActivityAt, now), texts.ago, locale),
    since: plural(texts.age, days, locale),
    activity: signs.activity,
    max: Math.max(1, ...signs.activity),
    chartLabel: fill(texts.chart, { days: LIFE_SIGNS_DAYS, values: signs.activity.join(', ') }),
    axisStart: fill(texts.axisStart, { days: LIFE_SIGNS_DAYS }),
    axisEnd: texts.axisEnd,
    sample: signs.sample,
  };
}
