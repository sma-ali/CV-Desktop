import type { Locale } from '@/content/locales';

// Une borne de période : la valeur machine pour <time dateTime> et le texte affiché.
export type DateLabel = { dateTime: string; label: string };

// Séparateur entre le début et la fin. Jamais Intl.DateTimeFormat#formatRange :
// il produit un demi-cadratin.
export const RANGE_SEPARATOR = ' - ';

const monthFormatters: Record<Locale, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
};

// « 2024-01 » devient « janv. 2024 » en français et « Jan 2024 » en anglais.
export function formatYearMonth(value: string, locale: Locale): DateLabel {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new Error(`mois attendu au format AAAA-MM : ${value}`);
  const [, year, month] = match;
  const date = Date.UTC(Number(year), Number(month) - 1, 1);
  return { dateTime: value, label: monthFormatters[locale].format(date) };
}

// Période d'une expérience : début et fin, au mois près.
export function formatMonthPeriod(
  period: { start: string; end: string },
  locale: Locale,
): DateLabel[] {
  return [formatYearMonth(period.start, locale), formatYearMonth(period.end, locale)];
}

// Période d'une formation : une seule année si elle commence et finit la même année.
export function formatYearPeriod(from: number, to: number): DateLabel[] {
  const years = from === to ? [from] : [from, to];
  return years.map((year) => ({ dateTime: String(year), label: String(year) }));
}

// La période en une ligne de texte (« janv. 2024 - juin 2026 »).
export function periodText(bounds: DateLabel[]): string {
  return bounds.map((bound) => bound.label).join(RANGE_SEPARATOR);
}
