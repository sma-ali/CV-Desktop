import { homePose, type DeskBodies, type DeskBodyState } from '../core/bodies';
import { BODY_IDS, type BodyId } from '../core/ids';

// Le score de désordre du bureau (partie B de l'étape 6), de 0 (rangé) à 1
// (tout cassé). Chaque corps visible compte d'après son écart à sa place
// d'origine : la distance parcourue sur le plateau, le fait d'être renversé,
// le fait d'être tombé. Les points s'additionnent, puis se ramènent à 0..1
// (DISORDER.full points font un bureau « tout cassé »). Données pures.
//
// Proposition à valider avec Ali : pousser deux ou trois objets ne fait pas
// apparaître le bouton ; renverser la moitié du bureau, ou en vider un coin
// par terre, oui.

export const DISORDER = {
  /** En deçà (unités du plateau, environ 10 cm chacune), un corps déplacé ne compte pas. */
  near: 0.4,
  /** Distance qui vaut tous les points de déplacement. */
  far: 3,
  /** Points d'un corps déplacé loin de sa place (au prorata de la distance, jusqu'à far). */
  moved: 0.5,
  /** Inclinaison (radians) au-delà de laquelle un corps est renversé (35 degrés). */
  tipAngle: 0.61,
  /** Points d'un corps renversé (en plus de son déplacement). */
  tipped: 0.6,
  /** Points d'un corps tombé du plateau (il ne compte pas son déplacement en plus). */
  fallen: 1,
  /** Points qui font un bureau « tout cassé » (score 1). */
  full: 6,
  /** Le bouton « Je range pour vous ? » apparaît à partir de ce score. */
  offer: 0.5,
  /** Il disparaît sous ce score (un peu plus bas : il ne clignote pas au seuil). */
  withdraw: 0.4,
} as const;

/** L'inclinaison d'un corps (radians) : l'angle entre son axe vertical et la verticale. */
export function tiltOf(body: Pick<DeskBodyState, 'qx' | 'qz'>): number {
  // Composante verticale de l'axe y local tourné par le quaternion.
  const up = 1 - 2 * (body.qx * body.qx + body.qz * body.qz);
  return Math.acos(Math.min(1, Math.max(-1, up)));
}

/** Les points de désordre d'un corps (0 s'il est à sa place). */
export function bodyDisorder(id: BodyId, body: DeskBodyState, portrait: boolean): number {
  if (body.hidden || !body.moved) return 0;
  if (body.fallen) return DISORDER.fallen;
  const home = homePose(id, portrait);
  const distance = Math.hypot(body.x - home.x, body.z - home.z);
  const moved =
    distance <= DISORDER.near
      ? 0
      : (DISORDER.moved * Math.min(distance - DISORDER.near, DISORDER.far - DISORDER.near)) /
        (DISORDER.far - DISORDER.near);
  const tipped = tiltOf(body) > DISORDER.tipAngle ? DISORDER.tipped : 0;
  return moved + tipped;
}

/** Le score de désordre du bureau, de 0 à 1. */
export function disorderScore(desk: DeskBodies, portrait: boolean): number {
  let points = 0;
  for (const id of BODY_IDS) points += bodyDisorder(id, desk[id], portrait);
  return Math.min(1, points / DISORDER.full);
}

/**
 * Le bouton doit-il se montrer ? Hystérésis : il apparaît à DISORDER.offer
 * et ne disparaît que sous DISORDER.withdraw.
 */
export function offerShown(score: number, shownBefore: boolean): boolean {
  return shownBefore ? score >= DISORDER.withdraw : score >= DISORDER.offer;
}
