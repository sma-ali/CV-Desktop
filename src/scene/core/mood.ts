import type { MoodId } from './ids';

// L'heure du visiteur et l'ambiance qui en découle. Sans three.

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
