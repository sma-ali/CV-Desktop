import { DROP } from './constants';
import type { BodyId } from './ids';

// La chute de l'arrivée : dans la pénombre, les objets tombent un à un à leur
// place, puis la lampe, posée en dernier, s'allume (ARRIVAL.lampOn). Chaque
// corps part de DROP.height au-dessus de sa place, tombe en accélérant,
// rebondit une fois et se pose, légèrement penché pendant la chute. Données
// pures, sans three : updateFrame (frame.ts) applique la pose aux corps que
// rien n'a encore touchés. Le casque, pendu à son support, ne tombe pas.

/** L'ordre de la chute : les gros objets du CV, les petits, le décor, la lampe en dernier. */
export const DROP_ORDER = [
  'book',
  'laptop',
  'homelab',
  'chest',
  'netherbrain',
  'casd',
  'card',
  'badge',
  'keyboard',
  'mouse',
  'mug',
  'pad',
  'manga',
  'plant',
  'fox',
  'wanderer',
  'rope',
  'wraps',
  'kimono',
  'lamp',
] as const satisfies readonly BodyId[];

/** Instant où le i-ème corps de DROP_ORDER commence sa chute. */
export function dropStart(index: number): number {
  return DROP.start + index * DROP.step;
}

/** Instant où le dernier corps est posé. */
export const DROP_END = dropStart(DROP_ORDER.length - 1) + DROP.fall + DROP.bounce;

/** Hauteur au-dessus de la place (0 posé) et inclinaison (radians) du corps à l'instant t. */
export interface DropOffset {
  dy: number;
  tilt: number;
}

const RESTING: DropOffset = { dy: 0, tilt: 0 };

/**
 * Où en est le i-ème corps de la chute à l'instant t : null avant son
 * départ (il n'est pas encore là), RESTING une fois posé.
 */
export function dropOffset(t: number, index: number): DropOffset | null {
  const s = t - dropStart(index);
  if (s < 0) return null;
  if (s < DROP.fall) {
    const k = s / DROP.fall;
    // Chute libre : la hauteur décroît comme le carré du temps.
    return { dy: DROP.height * (1 - k * k), tilt: DROP.tilt * (1 - k) };
  }
  const b = s - DROP.fall;
  if (b < DROP.bounce) {
    const k = b / DROP.bounce;
    // Un petit rebond, une parabole.
    return { dy: DROP.rebound * 4 * k * (1 - k), tilt: 0 };
  }
  return RESTING;
}

/** Les corps qui touchent le plateau entre prev (exclu) et t (inclus), pour le bruit du choc. */
export function landingsBetween(prev: number, t: number): number[] {
  const hits: number[] = [];
  if (t <= prev) return hits;
  for (let i = 0; i < DROP_ORDER.length; i++) {
    const at = dropStart(i) + DROP.fall;
    if (at > prev && at <= t) hits.push(i);
  }
  return hits;
}
