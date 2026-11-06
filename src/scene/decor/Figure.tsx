'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Group } from 'three';
import { useSceneStoreApi } from '../core/store-context';
import { hop, type FigureKind, type FigureSpec } from './layout';
import { withFinish, type Part } from './merge';
import { box, cyl, MergedParts, rodPart, sph, usePressTime, WOOD } from './shared';

// Les figurines (inventées : ni marque, ni personnage réel) : un robot,
// un renard et un voyageur au chapeau, qui sautent quand on clique dessus.

/** Le socle noir commun aux figurines. */
const figureBase = (): Part => ({
  geometry: cyl(0.2, 0.22, 0.06, 10),
  color: 0x1f1d1b,
  finish: 'satin',
  position: [0, 0.03, 0],
});

const FIGURE_PARTS: Record<FigureKind, () => Part[]> = {
  // Un petit robot : tête carrée, yeux turquoise, antenne.
  robot: () => [
    figureBase(),
    {
      geometry: cyl(0.13, 0.16, 0.32, 8),
      color: 0xe3b54a,
      finish: 'satin',
      position: [0, 0.22, 0],
    },
    { geometry: box(0.3, 0.24, 0.26), color: 0xf3e9d4, finish: 'satin', position: [0, 0.5, 0] },
    { geometry: sph(0.03, 1), color: 0x7fe0d2, finish: 'unlit', position: [-0.07, 0.52, 0.135] },
    { geometry: sph(0.03, 1), color: 0x7fe0d2, finish: 'unlit', position: [0.07, 0.52, 0.135] },
    rodPart([0, 0.62, 0], [0.05, 0.8, 0], 0.012, 0x1d1b19),
    { geometry: sph(0.035), color: 0xe3735a, position: [0.05, 0.82, 0] },
  ],
  // Un renard stylisé : corps en cône, oreilles pointues, queue.
  fox: () => [
    figureBase(),
    { geometry: cyl(0.02, 0.17, 0.36, 7), color: 0xf3e9d4, position: [0, 0.24, 0] },
    { geometry: sph(0.15), color: 0xe0703a, position: [0, 0.5, 0] },
    {
      geometry: cyl(0, 0.06, 0.16, 4),
      color: 0xe0703a,
      position: [-0.08, 0.66, 0],
      rotation: [0, 0, 0.3],
    },
    {
      geometry: cyl(0, 0.06, 0.16, 4),
      color: 0xe0703a,
      position: [0.08, 0.66, 0],
      rotation: [0, 0, -0.3],
    },
    {
      geometry: cyl(0, 0.09, 0.3, 5),
      color: 0xe0703a,
      position: [0, 0.2, -0.18],
      rotation: [-1.1, 0, 0],
    },
  ],
  // Un voyageur en cape, au grand chapeau.
  wanderer: () => [
    figureBase(),
    { geometry: cyl(0.04, 0.2, 0.44, 7), color: 0x2d5a5c, position: [0, 0.28, 0] },
    { geometry: sph(0.11), color: 0xd7d0c0, position: [0, 0.56, 0] },
    { geometry: cyl(0.02, 0.3, 0.18, 8), color: WOOD, position: [0, 0.7, 0] },
    { geometry: cyl(0.3, 0.3, 0.02, 8), color: WOOD, position: [0, 0.62, 0] },
  ],
};

/** Chaque figurine en un seul fini satiné (ses yeux mis à part) : un ou deux appels de dessin. */
const FIGURE_BUILDS: Record<FigureKind, () => Part[]> = {
  robot: () => withFinish(FIGURE_PARTS.robot(), 'satin'),
  fox: () => withFinish(FIGURE_PARTS.fox(), 'satin'),
  wanderer: () => withFinish(FIGURE_PARTS.wanderer(), 'satin'),
};

export function Figure({ spec }: { spec: FigureSpec }) {
  const store = useSceneStoreApi();
  const group = useRef<Group>(null);
  const { at: hopAt, handlers } = usePressTime();
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const { frame, settings } = store.getState();
    const { y, spin } = hop(frame.t, hopAt.current, settings.reducedMotion);
    node.position.y = spec.position[1] + y;
    node.rotation.y = spec.ry + spin;
  });
  return (
    <group
      ref={group}
      name={`decor-figure-${spec.kind}`}
      position={spec.position}
      rotation={[0, spec.ry, 0]}
      {...handlers}
    >
      <MergedParts build={FIGURE_BUILDS[spec.kind]} />
    </group>
  );
}
