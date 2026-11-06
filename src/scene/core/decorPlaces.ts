import { KEYBOARD, LAMP, type Vec3 } from './constants';
import type { DecorBodyId } from './ids';

// Où se pose chaque morceau du décor, en paysage et dans le bureau resserré
// du portrait. Le noyau en a besoin pour la place d'origine des corps
// (bodies.ts) ; le décor y lit les ancres de ses morceaux (decor/layout.ts)
// et la mise en scène y cadre le portrait. Données pures, sans three.

/**
 * Les morceaux du décor qui changent de place en portrait (voir
 * BOUNDS_PORTRAIT). Chacun bouge d'un bloc : il tourne de ry autour de son
 * ancre (DECOR_ANCHORS, sa place en paysage), puis l'ancre va en (x, z). Le
 * tapis et la pièce ne bougent pas ; la tasse et la manette, dessinées dans
 * leur propre repère, ont leur place à part (DECOR_BODY_HOMES).
 */
export type DecorPieceId = Exclude<DecorBodyId, 'mug' | 'pad'>;

export const DECOR_PIECE_IDS = [
  'lamp',
  'keyboard',
  'kimono',
  'mouse',
  'rope',
  'wraps',
  'plant',
  'manga',
  'fox',
  'wanderer',
] as const satisfies readonly DecorPieceId[];

/** L'ancre de chaque morceau : sa place en paysage, vue de dessus (x, z). */
export const DECOR_ANCHORS: Readonly<Record<DecorPieceId, readonly [number, number]>> = {
  lamp: [LAMP.base[0], LAMP.base[2]],
  keyboard: [KEYBOARD[0], KEYBOARD[2]],
  kimono: [-2.72, -0.78],
  mouse: [3.35, -0.48],
  rope: [-5.6, 2.35],
  wraps: [5.7, 0.75],
  plant: [3.45, -3.0],
  manga: [4.55, -2.2],
  fox: [5.55, -1.55],
  wanderer: [5.68, -2.55],
};

/** L'ancre d'un morceau, au ras du plateau. */
export function anchorPoint(id: DecorPieceId): Vec3 {
  const [x, z] = DECOR_ANCHORS[id];
  return [x, 0, z];
}

/**
 * Places de repos de la tasse et de la manette (dessinées dans leur propre
 * repère, contrairement aux autres morceaux du décor).
 */
export const DECOR_BODY_HOMES = {
  mug: { x: 4.55, z: -0.62, ry: 0 },
  pad: { x: 5.1, z: 1.95, ry: 0.45 },
} as const;

/** Où va un morceau : son ancre en (x, z), tournée de ry ; caché s'il ne trouve pas sa place. */
export interface DecorPlacement {
  x: number;
  z: number;
  ry: number;
  hidden: boolean;
}

/**
 * Les places du décor en portrait. La lampe passe derrière le bord gauche
 * de l'écran, sa tête vers l'avant gauche (elle éclaire le livre et le
 * coffret ; elle peut sortir en partie du cadre) ; le kimono plié se pose
 * derrière le clavier, à droite, entre le pied de l'écran et le casque
 * (HEADSET_PORTRAIT) ; le clavier avance un peu (le coffret passe derrière
 * lui, à gauche) et la souris le suit ; la plante se pose devant le
 * clavier, à gauche, derrière le livre. La corde, les bandes, les mangas
 * avec leur robot et deux figurines ne trouvent pas de place sans élargir
 * le bureau (la caméra reculerait et tous les objets rapetisseraient) ou
 * cacher un objet du CV : cachés en portrait.
 */
export const PORTRAIT_DECOR: Readonly<
  Record<DecorPieceId, { x: number; z: number; ry?: number; hidden?: boolean }>
> = {
  lamp: { x: -2.4, z: -3.0, ry: -0.75 },
  keyboard: { x: KEYBOARD[0], z: KEYBOARD[2] + 0.13 },
  kimono: { x: 1.95, z: -1.9, ry: -0.1 },
  mouse: { x: 2.85, z: -0.4 },
  rope: { ...pointXZ(DECOR_ANCHORS.rope), hidden: true },
  wraps: { ...pointXZ(DECOR_ANCHORS.wraps), hidden: true },
  plant: { x: -2.3, z: 0.95 },
  manga: { ...pointXZ(DECOR_ANCHORS.manga), hidden: true },
  fox: { ...pointXZ(DECOR_ANCHORS.fox), hidden: true },
  wanderer: { ...pointXZ(DECOR_ANCHORS.wanderer), hidden: true },
};

function pointXZ([x, z]: readonly [number, number]) {
  return { x, z };
}

/** La place d'un morceau du décor pour un format (en paysage, son ancre, sans rotation). */
export function decorPlacement(id: DecorPieceId, portrait: boolean): DecorPlacement {
  if (!portrait) {
    const [x, z] = DECOR_ANCHORS[id];
    return { x, z, ry: 0, hidden: false };
  }
  const place = PORTRAIT_DECOR[id];
  return { x: place.x, z: place.z, ry: place.ry ?? 0, hidden: place.hidden ?? false };
}

/**
 * Ce que DecorPiece pose dans la scène : un groupe placé sur la nouvelle
 * ancre et tourné de ry, qui porte un groupe décalé de moins l'ancre (les
 * enfants sont dessinés à leur place en paysage). En paysage, l'identité.
 */
export function decorPieceTransform(id: DecorPieceId, portrait: boolean) {
  const place = decorPlacement(id, portrait);
  const [ax, az] = DECOR_ANCHORS[id];
  return {
    position: [place.x, 0, place.z] as Vec3,
    ry: place.ry,
    offset: [-ax, 0, -az] as Vec3,
    hidden: place.hidden,
  };
}

/**
 * Un point du morceau (repère du monde, à sa place en paysage) vu à sa place
 * du format : tourné de ry autour de l'ancre (sens de three, comme
 * rotation.y), puis posé sur la nouvelle ancre.
 */
export function placeDecorPoint(id: DecorPieceId, portrait: boolean, [x, y, z]: Vec3): Vec3 {
  if (!portrait) return [x, y, z];
  const [ax, az] = DECOR_ANCHORS[id];
  const place = decorPlacement(id, true);
  const lx = x - ax;
  const lz = z - az;
  const cos = Math.cos(place.ry);
  const sin = Math.sin(place.ry);
  return [place.x + lx * cos + lz * sin, y, place.z - lx * sin + lz * cos];
}
