'use client';

import { useMemo } from 'react';
import { ITEM_POSES } from '../core/constants';
import { Box } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { deskRestPose } from './presentation';
import { TagAnchor } from './TagLayer';
import { usePresentation } from './usePresentation';

// Homelab (projet 2026) : une mini baie de 10 pouces (serveur, pare-feu,
// switch) aux LED qui clignotent. Retournée (mode spin), elle montre son dos.
// Textes peints : content.scene.homelab.
//
// SQUELETTE du socle : trois boîtes empilées, à sa place, qui se présentent
// et portent leur étiquette. La partie « objets » le remplace (même nom,
// mêmes props), dans les limites de BODY_FOOTPRINTS.homelab.

const UNITS = [0x3a3d42, 0x2c2f33, 0x45484d] as const;

export function Homelab({ texts }: { texts: SceneTexts }) {
  const rest = useMemo(() => deskRestPose(ITEM_POSES.homelab), []);
  const { ref, handlers } = usePresentation({ id: 'homelab', rest, seed: 1.12 });

  return (
    <group ref={ref} {...handlers} name={`homelab-${texts.locale}`}>
      {UNITS.map((color, i) => (
        <Box
          key={color}
          size={[0.96, 0.26, 0.76]}
          position={[0, 0.14 + i * 0.28, 0]}
          material={standardMaterial(color, { roughness: 0.5, metalness: 0.4 })}
        />
      ))}
      <TagAnchor id="homelab" />
    </group>
  );
}
