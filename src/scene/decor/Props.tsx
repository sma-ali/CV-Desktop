'use client';

import { DeskBody } from './DeskBody';
import { FIGURES, ROPE, ropeCoil } from './layout';
import { DecorPiece } from './DecorPiece';
import type { Part } from './merge';
import { box, cyl, MergedParts, tube, WOOD } from './shared';
import { Plant } from './Plant';
import { MangaStack } from './MangaStack';
import { Figure } from './Figure';
import { Mug } from './Mug';
import { Gamepad } from './Gamepad';

// Les petites choses de la vie : corde à sauter, bandes de boxe, plante,
// pile de mangas et figurines (inventés : ni titre, ni marque, ni
// personnage réel), tasse fumante, manette. Tasse et manette glissent sur
// le plateau (DeskBody) ; un clic les fait réagir. Chaque objet animé a son
// fichier ; la corde et les bandes, de simples pièces fusionnées, restent ici.

// ------------------------------------------------------------------
// Corde à sauter et bandes de boxe
// ------------------------------------------------------------------

/** La corde à sauter et ses poignées (repère du monde). */
function ropeParts(): Part[] {
  const [rx, , rz] = ROPE.center;
  return [
    { geometry: tube(ropeCoil(), 0.03, 170, 5), color: 0xd9a441, finish: 'satin' },
    {
      geometry: cyl(0.06, 0.07, 0.5, 7),
      color: WOOD,
      finish: 'satin',
      position: [rx + 0.55, 0.07, rz + 0.5],
      rotation: [Math.PI / 2, 0, 0.8],
    },
    {
      geometry: cyl(0.06, 0.07, 0.5, 7),
      color: WOOD,
      finish: 'satin',
      position: [rx - 0.5, 0.07, rz - 0.6],
      rotation: [Math.PI / 2, 0, -0.5],
    },
  ];
}

/** Les bandes roulées, et le bout d'une qui dépasse (repère du monde). */
function wrapsParts(): Part[] {
  return [
    {
      geometry: cyl(0.17, 0.17, 0.24, 10),
      color: 0x2b2b2e,
      position: [5.55, 0.17, 0.55],
      rotation: [0, 0.4, Math.PI / 2],
    },
    {
      geometry: cyl(0.16, 0.16, 0.24, 10),
      color: 0x8f2a22,
      position: [5.9, 0.16, 0.95],
      rotation: [0, -0.3, Math.PI / 2],
    },
    {
      geometry: box(0.5, 0.02, 0.12),
      color: 0x2b2b2e,
      position: [5.1, 0.02, 0.75],
      rotation: [0, 0.5, 0],
    },
  ];
}

export function Props() {
  return (
    <>
      <DecorPiece id="rope">
        <MergedParts build={ropeParts} />
      </DecorPiece>
      <DecorPiece id="wraps">
        <MergedParts build={wrapsParts} />
      </DecorPiece>
      <DecorPiece id="plant">
        <Plant />
      </DecorPiece>
      {/* Le robot est debout sur les mangas : il bouge avec eux. */}
      <DecorPiece id="manga">
        <MangaStack />
        {FIGURES.filter((spec) => spec.kind === 'robot').map((spec) => (
          <Figure key={spec.kind} spec={spec} />
        ))}
      </DecorPiece>
      {FIGURES.filter((spec) => spec.kind !== 'robot').map((spec) => (
        <DecorPiece key={spec.kind} id={spec.kind === 'fox' ? 'fox' : 'wanderer'}>
          <Figure spec={spec} />
        </DecorPiece>
      ))}
      <DeskBody id="mug">
        <Mug />
      </DeskBody>
      <DeskBody id="pad">
        <Gamepad />
      </DeskBody>
    </>
  );
}
