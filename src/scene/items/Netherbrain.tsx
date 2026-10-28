'use client';

import { useMemo } from 'react';
import { ITEM_POSES } from '../core/constants';
import { Box } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { deskRestPose } from './presentation';
import { TagAnchor } from './TagLayer';
import { usePresentation } from './usePresentation';

// Netherbrain (projet 2026) : un bocal low poly où luit doucement un
// cerveau. Retourné (mode spin), il montre son étiquette et sa pile
// (content.scene.netherbrain).
//
// SQUELETTE du socle : une boîte de verre et une boîte rose, à sa place,
// qui se présente et porte son étiquette. La partie « objets » le remplace
// (même nom, mêmes props), dans les limites de BODY_FOOTPRINTS.netherbrain.

export function Netherbrain({ texts }: { texts: SceneTexts }) {
  const rest = useMemo(() => deskRestPose(ITEM_POSES.netherbrain), []);
  const { ref, handlers } = usePresentation({ id: 'netherbrain', rest, seed: 0.33 });

  return (
    <group ref={ref} {...handlers} name={`netherbrain-${texts.locale}`}>
      <Box
        size={[0.8, 0.95, 0.8]}
        position={[0, 0.475, 0]}
        material={standardMaterial(0x9fb8b4, { roughness: 0.2, metalness: 0.1 })}
      />
      <Box
        size={[0.5, 0.42, 0.5]}
        position={[0, 0.5, 0]}
        material={standardMaterial(0xd98c8c, { roughness: 0.7 })}
      />
      <TagAnchor id="netherbrain" />
    </group>
  );
}
