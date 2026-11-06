'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Group } from 'three';
import type { BodyId } from './ids';
import { useSceneStoreApi } from './store-context';

/**
 * Un groupe posé à chaque image sur la pose de son corps (store.desk[id] :
 * position et orientation complètes, écrites par le moteur physique, ou sa
 * place d'origine du format tant que rien ne l'a touché). hideWaiting : le
 * groupe reste caché tant que le corps attend sa chute de l'arrivée.
 */
export function useBodyPose(id: BodyId, hideWaiting = true): RefObject<Group | null> {
  const store = useSceneStoreApi();
  const ref = useRef<Group>(null);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const body = store.getState().desk[id];
    group.position.set(body.x, body.y, body.z);
    group.quaternion.set(body.qx, body.qy, body.qz, body.qw);
    if (hideWaiting) group.visible = !body.waiting;
  });
  return ref;
}
