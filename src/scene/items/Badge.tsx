'use client';

import { useEffect, useMemo } from 'react';
import { ITEM_POSES, type Vec3 } from '../core/constants';
import { Box, Cable, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { BADGE_TEXTURE, paintBadgeBack, paintBadgeFront } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le badge d'alternant chez DEFI-METIERS (2020), dans sa pochette, avec sa
// lanière. Présenté, il se retourne pour montrer son dos.

const W = 0.86;
const D = 1.24;

// La lanière, une boucle aplatie posée sur le bureau.
const LANYARD: Vec3[] = [
  [0, 0.03, -D / 2 - 0.1],
  [0.32, 0.025, -1.05],
  [0.48, 0.02, -1.6],
  [0.22, 0.02, -2.15],
  [-0.25, 0.02, -2.1],
  [-0.46, 0.02, -1.55],
  [-0.3, 0.025, -1.02],
];

export function Badge({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const front = usePaintedMaterial(
    useMemo(() => paintBadgeFront(content), [content]),
    // La pochette plastique ternit un peu le recto.
    { ...BADGE_TEXTURE, redrawKey: locale, roughness: 0.9, color: 0xc4baa6 },
  );
  const back = usePaintedMaterial(
    useMemo(() => paintBadgeBack(content), [content]),
    { ...BADGE_TEXTURE, redrawKey: locale, back: true },
  );
  const face = useMemo(() => flatPlaneGeometry(W, D), []);
  useEffect(() => () => face.dispose(), [face]);

  const rest = useMemo(() => deskRestPose(ITEM_POSES.badge), []);
  const glow = useMemo(() => [front, back], [front, back]);
  const { ref, handlers } = usePresentation({ id: 'badge', rest, seed: 0.72, glow });

  return (
    <group ref={ref} {...handlers}>
      {/* La pochette (de 0.003 à 0.033) laisse le verso dessous : à l'intérieur,
          sa face du dessous le cachait quand le badge se retourne. */}
      <Box
        size={[W + 0.07, 0.03, D + 0.07]}
        position={[0, 0.018, 0]}
        material={standardMaterial(0x9aa6aa, { roughness: 0.5 })}
      />
      <mesh geometry={face} material={front} position={[0, 0.039, 0]} receiveShadow />
      <mesh geometry={face} material={back} position={[0, 0.001, 0]} />
      <Box
        size={[0.16, 0.04, 0.12]}
        position={[0, 0.03, -D / 2 - 0.06]}
        material={standardMaterial(0x9aa0a4, { roughness: 0.3, metalness: 0.8 })}
      />
      <Cable
        points={LANYARD}
        radius={0.05}
        closed
        tubularSegments={60}
        radialSegments={4}
        scale={[1, 0.4, 1]}
        material={standardMaterial(0x2d5a5c, { roughness: 0.8 })}
        receiveShadow={false}
      />
    </group>
  );
}
