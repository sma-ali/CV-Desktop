'use client';

import { BoxGeometry, Euler, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '../core/constants';
import { DecorPiece } from './DecorPiece';
import { kimonoBlocks } from './kimono';
import { KIMONO } from './layout';
import type { Part } from './merge';
import { MergedParts } from './shared';

// Le kimono de grappling plié, bleu marine, et sa ceinture blanche nouée
// posée dessus : aucune marque, aucun écusson (pièces dans kimono.ts). Un
// morceau du décor comme les autres : il se glisse, se lance, se renverse.

/** Les pièces, dans le repère du monde à sa place en paysage (le morceau du décor les place). */
function kimonoParts(): Part[] {
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), KIMONO.ry);
  const [ax, , az] = KIMONO.position;
  return kimonoBlocks().map((block) => {
    const at = new Vector3(...block.at).applyQuaternion(turn);
    const own = new Quaternion().setFromEuler(new Euler(...(block.rotation ?? [0, 0, 0])));
    return {
      geometry: new BoxGeometry(...block.size),
      color: block.color,
      finish: block.finish,
      position: [ax + at.x, at.y, az + at.z] as Vec3,
      quaternion: turn.clone().multiply(own),
    };
  });
}

export function Kimono() {
  return (
    <DecorPiece id="kimono">
      <group name="decor-kimono">
        <MergedParts build={kimonoParts} />
      </group>
    </DecorPiece>
  );
}
