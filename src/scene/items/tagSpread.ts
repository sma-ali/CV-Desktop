// Les étiquettes ne se chevauchent pas : sur
// téléphone, le bureau est petit et deux étiquettes voisines se couvraient
// (Homelab et DEFI-METIERS, Netherbrain et Compétences). Chaque étiquette
// part de son point d'accroche ; celles qui se touchent s'écartent du moins
// qu'il faut, le plus souvent en hauteur (elles sont larges et basses). Pur
// et déterministe, sans allocation : appelé à chaque image.

import { clamp } from '../core/math';

/** Une étiquette à l'écran, en pixels : x au centre, y en bas (son point d'accroche). */
export interface TagBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Écart gardé entre deux étiquettes, et marge au bord de la fenêtre (pixels). */
const TAG_GAP = 4;
export const TAG_EDGE = 6;
const ITERATIONS = 40;

/** Garde une étiquette dans la largeur de la fenêtre. */
function clampX(box: TagBox, width: number): void {
  const half = box.w / 2 + TAG_EDGE;
  box.x = clamp(box.x, half, Math.max(half, width - half));
}

/**
 * Écarte les étiquettes qui se chevauchent (boxes est modifié en place).
 * À égalité, la première du tableau monte et la suivante descend.
 */
export function spreadTags(boxes: readonly TagBox[], width: number): void {
  for (const box of boxes) clampX(box, width);
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!;
        const dx = b.x - a.x;
        // Centres en hauteur : y est le bas de l'étiquette.
        const dy = b.y - b.h / 2 - (a.y - a.h / 2);
        const overlapX = (a.w + b.w) / 2 + TAG_GAP - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + TAG_GAP - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapY <= overlapX) {
          const sign = dy > 0 ? 1 : dy < 0 ? -1 : 1;
          a.y -= (sign * overlapY) / 2;
          b.y += (sign * overlapY) / 2;
        } else {
          const sign = dx > 0 ? 1 : dx < 0 ? -1 : 1;
          a.x -= (sign * overlapX) / 2;
          b.x += (sign * overlapX) / 2;
          clampX(a, width);
          clampX(b, width);
        }
      }
    }
    if (!moved) return;
  }
}

/** Le plus grand chevauchement restant entre deux étiquettes (0 : aucun), pour les tests. */
export function worstOverlap(boxes: readonly TagBox[]): number {
  let worst = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlapX = (a.w + b.w) / 2 - Math.abs(b.x - a.x);
      const overlapY = (a.h + b.h) / 2 - Math.abs(b.y - b.h / 2 - (a.y - a.h / 2));
      if (overlapX > 0 && overlapY > 0) worst = Math.max(worst, Math.min(overlapX, overlapY));
    }
  }
  return worst;
}
