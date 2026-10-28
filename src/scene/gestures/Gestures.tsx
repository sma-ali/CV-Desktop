'use client';

import { useFrame } from '@react-three/fiber';
import { useSceneStoreApi } from '../core/store-context';
import { GESTURES_PRIORITY } from './priorities';

// Les gestes du visiteur sur le plateau (partie « gestes ») : glisser un
// corps (BODY_IDS) à la souris ou au doigt, collisions entre rectangles
// orientés (objets, décor, bords du plateau), rebond au lâcher, ?glisse=.
// Chaque image, avant les objets, ce composant fait avancer le solveur et
// écrit store.desk ; les objets et le décor s'y posent.
//
// SQUELETTE du socle : il ne fait rien. Les corps restent à leur place de
// repos (le socle les y cale, syncDeskBodies) et ?glisse= est ignoré.
export function Gestures() {
  const store = useSceneStoreApi();

  useFrame(() => {
    // La partie « gestes » fait avancer ici le glisser en cours et le
    // solveur (store.getState().desk, settings.initialDrag).
    void store;
  }, GESTURES_PRIORITY);

  return null;
}
