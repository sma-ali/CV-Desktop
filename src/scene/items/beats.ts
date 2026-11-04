// Les rythmes des objets vivants, en fonctions pures du temps T de l'horloge
// (figés sous ?fige, testés dans beats.test.ts) : le cœur du coffret scellé,
// qui bat au rythme de ses signes de vie, et la lueur du cerveau de
// Netherbrain, qui respire.

/** Le battement du coffret : période (secondes) et force (0 à 1), d'après activityPulse. */
export interface Pulse {
  period: number;
  strength: number;
}

const bump = (x: number, center: number, width: number) => Math.exp(-(((x - center) / width) ** 2));

/**
 * Un battement de cœur à l'instant t (0 à 1, multiplié par la force) : un
 * premier coup, puis un second plus faible, une fois par période.
 */
export function heartbeat(t: number, { period, strength }: Pulse): number {
  const phase = (((t / period) % 1) + 1) % 1;
  const beat = bump(phase, 0.08, 0.045) + 0.55 * bump(phase, 0.24, 0.05);
  return Math.min(1, beat) * strength;
}

/** La lueur du cerveau qui respire : de 0 à 1, une respiration toutes les period secondes. */
export function breath(t: number, period = 4.4): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
}
