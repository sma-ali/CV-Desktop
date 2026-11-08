'use client';

import { useEffect, useMemo } from 'react';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import { ITEM_POSES } from '../core/constants';
import { Box } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { CASD_TOP_TEXTURE, paintCasdTop } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le boîtier d'accès au CASD (DARES) : les échanges de données sensibles
// passent par ses bulles cloisonnées. Comme le vrai boîtier, il porte le
// capteur d'empreinte sur le dessus, à gauche, et la fente de la carte en
// façade, à droite ; le clavier du code complète les trois facteurs.
// Présenté, il tourne sur lui-même.

/** Le corps du boîtier : largeur, hauteur, profondeur. */
const W = 0.84;
const H = 0.26;
const D = 0.6;
/** Le dessus peint, en retrait du bord. */
const TOP = { w: 0.78, d: 0.52 } as const;

export function Casd({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const top = usePaintedMaterial(
    useMemo(() => paintCasdTop(content), [content]),
    { ...CASD_TOP_TEXTURE, redrawKey: locale, roughness: 0.6 },
  );
  const topGeometry = useMemo(() => new PlaneGeometry(TOP.w, TOP.d), []);
  const led = useMemo(() => new MeshBasicMaterial({ color: 0x5fd18a }), []);
  useEffect(
    () => () => {
      topGeometry.dispose();
      led.dispose();
    },
    [topGeometry, led],
  );

  const rest = useMemo(() => deskRestPose(ITEM_POSES.casd), []);
  const glow = useMemo(() => [top], [top]);
  const { ref, handlers } = usePresentation({ id: 'casd', rest, seed: 0.63, glow });

  return (
    <group ref={ref} {...handlers}>
      {/* Le corps graphite, posé sur un socle un peu plus étroit. */}
      <Box
        size={[W - 0.06, 0.03, D - 0.06]}
        position={[0, 0.015, 0]}
        material={standardMaterial(0x1d1f22, { roughness: 0.8 })}
      />
      <Box
        size={[W, H - 0.03, D]}
        position={[0, 0.03 + (H - 0.03) / 2, 0]}
        material={standardMaterial(0x2f3236, { roughness: 0.55, metalness: 0.2 })}
      />
      <mesh
        geometry={topGeometry}
        material={top}
        position={[0, H + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
      {/* La fente de la carte, en façade à droite, et la carte insérée. */}
      <Box
        size={[0.34, 0.03, 0.02]}
        position={[0.2, 0.13, D / 2 + 0.002]}
        material={standardMaterial(0x0c0d0e, { roughness: 0.9 })}
      />
      <Box
        size={[0.3, 0.012, 0.14]}
        position={[0.2, 0.13, D / 2 + 0.03]}
        material={standardMaterial(0xe8e4da, { roughness: 0.5 })}
      />
      <Box
        size={[0.06, 0.013, 0.05]}
        position={[0.12, 0.131, D / 2 + 0.06]}
        material={standardMaterial(0xc9a54a, { roughness: 0.3, metalness: 0.7 })}
      />
      {/* Le voyant, en façade à gauche : la session est ouverte. */}
      <Box size={[0.05, 0.03, 0.01]} position={[-0.3, 0.15, D / 2 + 0.004]} material={led} />
    </group>
  );
}
