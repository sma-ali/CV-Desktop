'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { usePortrait } from '../core/portrait';
import { useSceneStoreApi } from '../core/store-context';
import { claimBody } from '../gestures/pointer';
import { DECOR_ANCHORS, decorPlacement, type DecorPieceId } from '../core/decorPlaces';

// Un morceau du décor, corps du moteur physique : ses enfants,
// dessinés à leur place en paysage (repère du monde), sont décalés de moins
// son ancre, et le groupe suit chaque image la pose du corps
// (store.desk[id] : position et orientation complètes, écrites par le
// moteur physique ; sa place d'origine du format tant que rien ne l'a
// touché). Un morceau caché en portrait n'est pas rendu du tout. Un appui
// le désigne au glisser (claimBody) ; ses enfants gardent leurs réactions
// au clic.
export function DecorPiece({ id, children }: { id: DecorPieceId; children: ReactNode }) {
  const store = useSceneStoreApi();
  const portrait = usePortrait();
  const ref = useRef<Group>(null);
  const [ax, az] = DECOR_ANCHORS[id];

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const body = store.getState().desk[id];
    group.position.set(body.x, body.y, body.z);
    group.quaternion.set(body.qx, body.qy, body.qz, body.qw);
    group.visible = !body.waiting;
  });

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => claimBody(store, event, id),
    [id, store],
  );

  if (decorPlacement(id, portrait).hidden) return null;
  return (
    <group ref={ref} name={`piece-${id}`} onPointerDown={onPointerDown}>
      <group position={[-ax, 0, -az]}>{children}</group>
    </group>
  );
}
