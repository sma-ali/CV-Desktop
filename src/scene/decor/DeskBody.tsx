'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, type ReactNode } from 'react';
import { useSceneStoreApi } from '../core/store-context';
import { useBodyPose } from '../core/useBodyPose';
import { claimBody } from '../gestures/pointer';

// Un objet du décor dessiné dans son propre repère (la tasse, la manette) :
// un groupe posé chaque image sur la pose de son corps (store.desk[id],
// écrite par le moteur physique). Ses enfants gardent leurs propres
// réactions au clic (vapeur, vibration). Un appui le désigne au glisser
// (claimBody) ; un glisser n'est pas un clic.
export function DeskBody({ id, children }: { id: 'mug' | 'pad'; children: ReactNode }) {
  const store = useSceneStoreApi();
  const ref = useBodyPose(id);

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
