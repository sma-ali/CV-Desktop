'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo } from 'react';
import { ITEM_POSES } from '../core/constants';
import { Box, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { useBodyPose } from '../core/useBodyPose';
import { claimBody } from '../gestures/pointer';
import { TagAnchor } from './TagLayer';
import { CARD_PILE, CARD_SIZE } from './cardPile';
import { MergedBoxes } from './merged';
import { CARD_TEXTURE, paintCardBack, paintCardFront } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// La carte de visite (contact) posée sur une petite pile : nom, titre et
// localisation au recto ; disponibilité, e-mail et LinkedIn au verso.
// Présentée, elle se retourne.

const W = CARD_SIZE.w;
const D = CARD_SIZE.d;

/**
 * La pile sous la carte : elle suit la pose de la carte sur le bureau
 * (store.desk.card, renversée ou tombée comprise), mais reste sur le bureau
 * quand la carte est présentée. Sa forme de collision fait partie de celle
 * de la carte (physics/shapes.ts).
 */
function CardPile() {
  const store = useSceneStoreApi();
  // Toujours visible : la pile est déjà posée quand la carte tombe dessus.
  const ref = useBodyPose('card', false);

  // Prendre la pile, c'est prendre la carte, sauf quand elle est tenue.
  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (store.getState().presented === 'card') return;
      claimBody(store, event, 'card');
    },
    [store],
  );

  return (
    <group ref={ref} onPointerDown={onPointerDown}>
      {/* L'origine de la carte est sur la pile : la pile descend d'autant. */}
      <group position={[0, -ITEM_POSES.card.y, 0]}>
        <MergedBoxes pieces={CARD_PILE} roughness={0.8} />
      </group>
    </group>
  );
}

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
      <CardPile />
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
