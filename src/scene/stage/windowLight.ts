import { WIN } from '../core/constants';

// La lumière de la fenêtre posée sur le plateau (layWindowLight() du
// prototype) : les quatre coins de la vitre, projetés le long de la direction
// du soleil jusqu'au plan y = 0, donnent la tache ; les rais relient la vitre
// à la tache. Sans three, sans allocation : tout s'écrit dans des tableaux.

/** Hauteur de la tache au-dessus du plateau, et des pieds des rais. */
export const PATCH_Y = 0.006;
export const SHAFT_FOOT_Y = 0.01;

/** Les coins de la vitre, un peu en retrait du cadre : haut gauche, haut droit, bas droit, bas gauche. */
export const WINDOW_CORNERS = new Float32Array([
  WIN.x0 + 0.1,
  WIN.y1 - 0.05,
  WIN.z,
  WIN.x1 - 0.1,
  WIN.y1 - 0.05,
  WIN.z,
  WIN.x1 - 0.1,
  WIN.y0 + 0.05,
  WIN.z,
  WIN.x0 + 0.1,
  WIN.y0 + 0.05,
  WIN.z,
]);

/** Lecture d'un tableau typé, sûre pour noUncheckedIndexedAccess. */
const at = (array: Float32Array, index: number) => array[index] ?? 0;

export interface Direction {
  x: number;
  y: number;
  z: number;
}

/**
 * Projette les coins de la vitre sur le plateau le long de dir (normalisée,
 * dir.y < 0). Écrit 4 points (x, z) dans out : haut gauche, haut droit, bas
 * droit, bas gauche, dans l'ordre de WINDOW_CORNERS.
 */
export function projectWindow(dir: Direction, out: Float32Array): Float32Array {
  const down = Math.min(-1e-3, dir.y);
  for (let i = 0; i < 4; i++) {
    const x = at(WINDOW_CORNERS, i * 3);
    const y = at(WINDOW_CORNERS, i * 3 + 1);
    const z = at(WINDOW_CORNERS, i * 3 + 2);
    const t = y / -down;
    out[i * 2] = x + dir.x * t;
    out[i * 2 + 1] = z + dir.z * t;
  }
  return out;
}

const scratch = new Float32Array(8);

/**
 * Remplit les positions de la tache (4 sommets), dans l'ordre inverse des
 * coins (bas gauche, bas droit, haut droit, haut gauche) : le bas de la vitre
 * donne le bord proche du mur, le haut le bord le plus loin, avec les UV du
 * prototype (0,1) (1,1) (1,0) (0,0).
 */
export function writePatch(dir: Direction, positions: Float32Array): void {
  projectWindow(dir, scratch);
  for (let i = 0; i < 4; i++) {
    const corner = 3 - i;
    positions[i * 3] = at(scratch, corner * 2);
    positions[i * 3 + 1] = PATCH_Y;
    positions[i * 3 + 2] = at(scratch, corner * 2 + 1);
  }
}

/** Remplit les positions des rais : 4 sommets sur la vitre, puis 4 sur le plateau. */
export function writeShaft(dir: Direction, positions: Float32Array): void {
  projectWindow(dir, scratch);
  for (let i = 0; i < 4; i++) {
    positions[i * 3] = at(WINDOW_CORNERS, i * 3);
    positions[i * 3 + 1] = at(WINDOW_CORNERS, i * 3 + 1);
    positions[i * 3 + 2] = at(WINDOW_CORNERS, i * 3 + 2) + 0.02;
    positions[(4 + i) * 3] = at(scratch, i * 2);
    positions[(4 + i) * 3 + 1] = SHAFT_FOOT_Y;
    positions[(4 + i) * 3 + 2] = at(scratch, i * 2 + 1);
  }
}

/** Les triangles des rais : les quatre faces du tronc entre la vitre et la tache. */
export const SHAFT_INDEX = [
  0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
] as const;

/** Les triangles de la tache, et ses UV (0,1) (1,1) (1,0) (0,0). */
export const PATCH_INDEX = [0, 3, 1, 1, 3, 2] as const;
export const PATCH_UV = [0, 1, 1, 1, 1, 0, 0, 0] as const;
