import { KEYBOARD, LAMP, type Vec3 } from '../core/constants';
import type { DeskObstacle } from '../core/bodies';
import { decorPlacement, placeDecorPoint, type DecorPieceId } from '../core/decorPlaces';
import {
  FIGURES,
  KIMONO,
  KIMONO_FOOTPRINT,
  MANGA,
  MANGA_SIZE,
  MANGA_TOP,
  PLANT,
  CRADLE,
} from './layout';

// Ce que le décor occupe sur le plateau, vu de dessus : un rectangle orienté
// par morceau, en paysage et dans le bureau resserré du portrait, et leurs
// coins en hauteur pour le cadrage du portrait (stage/framing.ts).

const square = (id: string, [x, , z]: Vec3, half: number): DeskObstacle => ({
  id,
  x,
  z,
  ry: 0,
  hw: half,
  hd: half,
});

/**
 * Ce que le décor occupe sur le plateau au repos, en rectangles orientés :
 * le cadrage portrait et les tests de disposition s'en servent. La tasse et
 * la manette ont leur encombrement avec les objets (BODY_FOOTPRINTS dans
 * core/bodies.ts). Les objets plats (tapis, câbles) ne comptent pas.
 */
export const DECOR_OBSTACLES: readonly DeskObstacle[] = [
  // Le clavier (boîtier de la rangée de touches).
  { id: 'keyboard', x: KEYBOARD[0], z: KEYBOARD[2], ry: 0, hw: 2.15, hd: 0.72 },
  // Le kimono plié et sa ceinture.
  {
    id: 'kimono',
    x: KIMONO.position[0],
    z: KIMONO.position[2],
    ry: KIMONO.ry,
    hw: KIMONO_FOOTPRINT.hw,
    hd: KIMONO_FOOTPRINT.hd,
  },
  { id: 'mouse', x: 3.35, z: -0.48, ry: 0, hw: 0.24, hd: 0.34 },
  square('lamp', LAMP.base, 0.48),
  { id: 'cradle', x: CRADLE.center[0], z: CRADLE.center[2], ry: 0, hw: CRADLE.hw, hd: CRADLE.hd },
  { id: 'wraps', x: 5.7, z: 0.75, ry: 0, hw: 0.4, hd: 0.4 },
  square('plant', PLANT.position, 0.36),
  {
    id: 'manga',
    x: MANGA.position[0],
    z: MANGA.position[2],
    ry: MANGA.ry,
    hw: MANGA_SIZE.w / 2,
    hd: MANGA_SIZE.d / 2,
  },
  ...FIGURES.filter((figure) => figure.position[1] === 0).map((figure) =>
    square(`figure-${figure.kind}`, figure.position, 0.22),
  ),
];

/** Le morceau qui porte chaque obstacle du décor (le clavier ne bouge pas). */
const OBSTACLE_PIECES: Readonly<Record<string, DecorPieceId | null>> = {
  keyboard: 'keyboard',
  kimono: 'kimono',
  mouse: 'mouse',
  lamp: 'lamp',
  cradle: 'cradle',
  wraps: 'wraps',
  plant: 'plant',
  manga: 'manga',
  'figure-fox': 'fox',
  'figure-wanderer': 'wanderer',
};

/** Le morceau du décor d'un obstacle, ou null s'il ne bouge jamais. */
export const obstaclePiece = (id: string): DecorPieceId | null => OBSTACLE_PIECES[id] ?? null;

/**
 * Les obstacles ronds (pied de la lampe, pot de la plante, socle des
 * figurines) : leur carré ne tourne pas avec le morceau, il reste le même
 * autour du centre (tourné, il dépasserait du plateau sans raison).
 */
const ROUND_OBSTACLES: ReadonlySet<string> = new Set([
  'lamp',
  'plant',
  'figure-fox',
  'figure-wanderer',
]);

/** La rotation qu'un obstacle prend avec son morceau (0 pour un obstacle rond). */
export const obstacleTurn = (id: string, pieceRy: number): number =>
  ROUND_OBSTACLES.has(id) ? 0 : pieceRy;

/** Les obstacles du décor en portrait : à la place de leur morceau, sans les morceaux cachés. */
export const DECOR_OBSTACLES_PORTRAIT: readonly DeskObstacle[] = DECOR_OBSTACLES.flatMap(
  (obstacle) => {
    const piece = obstaclePiece(obstacle.id);
    if (!piece) return [obstacle];
    const place = decorPlacement(piece, true);
    if (place.hidden) return [];
    const [x, , z] = placeDecorPoint(piece, true, [obstacle.x, 0, obstacle.z]);
    return [{ ...obstacle, x, z, ry: obstacle.ry + obstacleTurn(obstacle.id, place.ry) }];
  },
);

/** Les obstacles du décor du format. */
export const decorObstacles = (portrait: boolean): readonly DeskObstacle[] =>
  portrait ? DECOR_OBSTACLES_PORTRAIT : DECOR_OBSTACLES;

/**
 * Hauteur de chaque obstacle du décor (le robot debout sur les mangas, les
 * feuilles de la plante) : le cadrage portrait fait tenir le décor entier,
 * pas seulement son pied. La lampe a ses propres points (FIXED_EXTENT,
 * stage/framing.ts).
 */
const DECOR_HEIGHTS: Readonly<Record<string, number>> = {
  keyboard: 0.25,
  kimono: KIMONO_FOOTPRINT.height,
  mouse: 0.25,
  lamp: 0.3,
  cradle: CRADLE.top,
  wraps: 0.35,
  plant: 1.45,
  manga: MANGA_TOP + 0.55,
  'figure-fox': 0.5,
  'figure-wanderer': 0.6,
};

/**
 * Les coins du décor posé en portrait (au ras du plateau et à sa hauteur) :
 * le cadrage portrait les fait tenir à l'écran, en plus du bureau utile.
 */
export function decorExtentPortrait(): Vec3[] {
  const points: Vec3[] = [];
  for (const obstacle of DECOR_OBSTACLES_PORTRAIT) {
    const height = DECOR_HEIGHTS[obstacle.id] ?? 0.3;
    const cos = Math.cos(obstacle.ry);
    const sin = Math.sin(obstacle.ry);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const lx = sx * obstacle.hw;
      const lz = sz * obstacle.hd;
      const x = obstacle.x + lx * cos + lz * sin;
      const z = obstacle.z - lx * sin + lz * cos;
      points.push([x, 0, z], [x, height, z]);
    }
  }
  return points;
}
