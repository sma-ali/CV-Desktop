'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useSceneStoreApi } from '../core/store-context';
import { claimBody } from '../gestures/pointer';

// Un objet du décor dessiné dans son propre repère (la tasse, la manette) :
// un groupe posé chaque image sur la pose de son corps (store.desk[id],
// écrite par le moteur physique). Ses enfants gardent leurs propres
// réactions au clic (vapeur, vibration). Un appui le désigne au glisser
// (claimBody) ; un glisser n'est pas un clic.
export function DeskBody({ id, children }: { id: 'mug' | 'pad'; children: ReactNode }) {
  const store = useSceneStoreApi();
  const ref = useRef<Group>(null);

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

  return (
    <group ref={ref} name={`body-${id}`} onPointerDown={onPointerDown}>
      {children}
    </group>
  );
}
