import type { Locale } from '@/content/locales';
import type { MoodId } from './ids';

// L'heure du visiteur et l'ambiance qui en découle. Sans three : ce module
// sert aussi au HUD.

/** L'ambiance d'une heure de la journée (0 à 23). */
export function moodOfHour(hour: number): MoodId {
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Écart (ms) entre l'horloge du visiteur et l'heure demandée par ?heure=,
 * pour que visitorNow() donne cette heure-là aujourd'hui.
 */
export function hourOffset(hour: number | null, now: Date): number {
  if (hour === null) return 0;
  const wanted = new Date(now);
  wanted.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return wanted.getTime() - now.getTime();
}

/** L'heure du visiteur, décalée par ?heure= s'il y a lieu. */
export function visitorNow(offsetMs: number, now: number = Date.now()): Date {
  return new Date(now + offsetMs);
}

/** « 15 h », « 15 h 05 » en français ; « 3 pm », « 3:05 pm » en anglais. */
export function formatVisitorTime(date: Date, locale: Locale): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const mm = String(minutes).padStart(2, '0');
  if (locale === 'fr') return minutes ? `${hours} h ${mm}` : `${hours} h`;
  const suffix = hours < 12 ? 'am' : 'pm';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes ? `${h12}:${mm} ${suffix}` : `${h12} ${suffix}`;
}
