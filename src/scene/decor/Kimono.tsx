'use client';

import { DecorPiece } from './DecorPiece';
import { KIMONO } from './layout';
import type { Part } from './merge';
import { box, MergedParts } from './shared';

// Le kimono de grappling plié, bleu marine, et sa ceinture blanche nouée
// posée dessus : aucune marque, aucun écusson. Version provisoire du socle
// de l'étape 6 (des pavés), que la partie décor remplace : forme, plis,
// nœud, lisibilité vue de dessus (voir docs/bureau-vivant.md).

const NAVY = 0x1f2a44;
const WHITE = 0xe9e4d8;

const [x, , z] = KIMONO.position;

/** Les pièces, dans le repère du monde (le morceau du décor les place). */
function kimonoParts(): Part[] {
  return [
    { geometry: box(1.28, 0.16, 0.88), color: NAVY, finish: 'satin', position: [x, 0.08, z] },
    { geometry: box(1.2, 0.06, 0.8), color: 0x26324f, position: [x, 0.19, z - 0.02] },
    // La ceinture, en travers, et son nœud.
    { geometry: box(0.16, 0.03, 0.9), color: WHITE, position: [x + 0.18, 0.235, z] },
    { geometry: box(0.24, 0.06, 0.2), color: WHITE, position: [x + 0.18, 0.25, z + 0.05] },
  ];
}

export function Kimono() {
  return (
    <DecorPiece id="kimono">
      <group name="decor-kimono" rotation={[0, KIMONO.ry, 0]}>
        <MergedParts build={kimonoParts} />
      </group>
    </DecorPiece>
  );
}
