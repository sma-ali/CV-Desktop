'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { DecorBodyId } from '../core/ids';
import { useSceneStoreApi } from '../core/store-context';

// Un objet du décor qui glisse (la tasse, la manette) : un groupe posé
// chaque image à sa place du plateau (store.desk[id]), soulevé, incliné et
// écrasé comme les objets du CV. Ses enfants gardent leurs propres
// réactions au clic (vapeur, vibration).
//
// SQUELETTE du socle : il suit store.desk sans gestionnaire de glisser ; la
// partie « gestes » y ajoute la prise au pointeur (et peut changer ce
// fichier tant que les props restent id et children).
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

  return (
    <group ref={ref} name={`body-${id}`}>
      {children}
    </group>
  );
}
