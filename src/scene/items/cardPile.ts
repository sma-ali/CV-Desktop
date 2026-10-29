import type { Vec3 } from '../core/constants';

// La petite pile de cartes sous la carte de visite, dans le repère de la
// carte posée sur le bureau (étape 4) : elle suit la carte quand on la fait
// glisser, et son encombrement (BODY_FOOTPRINTS.card) la contient, pour
// qu'aucun corps ne s'enfonce dedans. Données pures, sans three : testées
// dans cardPile.test.ts.

/** La carte elle-même : largeur, profondeur, et hauteur où elle se pose sur la pile. */
export const CARD_SIZE = { w: 1.7, d: 1.0 } as const;

/** Une carte de la pile : taille, centre et rotation dans le repère de la carte. */
export interface PileCard {
  size: Vec3;
  position: Vec3;
  rotationY: number;
  color: number;
}

/** Deux cartes un peu décalées, la plus basse d'abord ; leur dessus est à 0.044. */
export const CARD_PILE: readonly PileCard[] = [
  {
    size: [CARD_SIZE.w, 0.022, CARD_SIZE.d],
    position: [0, 0.011, 0.02],
    rotationY: 0.06,
    color: 0xe9e0cf,
  },
  {
    size: [CARD_SIZE.w, 0.022, CARD_SIZE.d],
    position: [0.05, 0.033, -0.01],
    rotationY: 0.01,
    color: 0xe9e0cf,
  },
];

/** Les quatre coins d'une carte de la pile, vus de dessus (x, z), dans le repère de la carte. */
export function pileCorners({ size, position, rotationY }: PileCard): [number, number][] {
  const hw = size[0] / 2;
  const hd = size[2] / 2;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return (
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ] as const
  ).map(([lx, lz]): [number, number] => [
    position[0] + lx * cos + lz * sin,
    position[2] - lx * sin + lz * cos,
  ]);
}
