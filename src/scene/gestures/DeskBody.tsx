'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { DecorBodyId } from '../core/ids';
import { useSceneStoreApi } from '../core/store-context';
import { claimBody } from './pointer';

// Un objet du décor qui glisse (la tasse, la manette) : un groupe posé
// chaque image à sa place du plateau (store.desk[id]), soulevé, incliné et
// écrasé comme les objets du CV. Ses enfants gardent leurs propres
// réactions au clic (vapeur, vibration).
//
// Un appui sur l'objet le désigne au glisser (claimBody) ; le glisser ne
// commence qu'au-delà du seuil (Gestures), et un glisser n'est pas un clic :
// la vapeur de la tasse ou la vibration de la manette ne partent qu'au clic.
export function DeskBody({ id, children }: { id: DecorBodyId; children: ReactNode }) {
  const store = useSceneStoreApi();
  const ref = useRef<Group>(null);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const body = store.getState().desk[id];
    group.position.set(body.x, body.lift, body.z);
    group.rotation.set(body.tiltX, body.ry, body.tiltZ);
    const squash = 1 + Math.sin(body.squash * Math.PI) * 0.06;
    group.scale.set(squash, 1 / squash, squash);
  });

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => claimBody(store, event, id),
    [id, store],
  );

  return (
    <group ref={ref} name={`body-${id}`} onPointerDown={onPointerDown}>
      {children}
    </group>
  );
}
