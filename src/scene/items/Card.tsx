'use client';

import { useEffect, useMemo } from 'react';
import { ITEM_POSES } from '../core/constants';
import { Box, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { TagAnchor } from './TagLayer';
import { MergedBoxes, type BoxPiece } from './merged';
import { CARD_TEXTURE, paintCardBack, paintCardFront } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// La carte de visite (contact) posée sur une petite pile : nom, titre et
// localisation au recto ; disponibilité, e-mail et LinkedIn au verso.
// Présentée, elle se retourne.

const W = 1.7;
const D = 1.0;

// La pile sous la carte : deux cartes fixes, fusionnées.
const PILE: BoxPiece[] = [0, 1].map((i) => ({
  size: [W, 0.022, D],
  position: [0.52 + i * 0.05, 0.011 + i * 0.022, 2.12 - i * 0.03],
  rotationY: 0.08 - i * 0.12,
  color: 0xe9e0cf,
}));

export function Card({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const front = usePaintedMaterial(
    useMemo(() => paintCardFront(content), [content]),
    { ...CARD_TEXTURE, redrawKey: locale },
  );
  const back = usePaintedMaterial(
    useMemo(() => paintCardBack(content), [content]),
    { ...CARD_TEXTURE, redrawKey: locale, back: true },
  );
  const face = useMemo(() => flatPlaneGeometry(W, D), []);
  useEffect(() => () => face.dispose(), [face]);

  const rest = useMemo(() => deskRestPose(ITEM_POSES.card), []);
  const glow = useMemo(() => [front, back], [front, back]);
  const { ref, handlers } = usePresentation({ id: 'card', rest, seed: 0.95, glow });

  return (
    <>
      <MergedBoxes pieces={PILE} roughness={0.8} />
      <group ref={ref} {...handlers}>
        <Box
          size={[W, 0.024, D]}
          position={[0, 0.012, 0]}
          material={standardMaterial(0xe2d6bf, { roughness: 0.8 })}
        />
        <mesh geometry={face} material={front} position={[0, 0.0255, 0]} receiveShadow />
        <mesh geometry={face} material={back} position={[0, -0.0015, 0]} />
        <TagAnchor id="card" />
      </group>
    </>
  );
}
