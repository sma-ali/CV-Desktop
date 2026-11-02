'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { loadSceneFonts } from '../core/fonts';
import { useSceneStoreApi } from '../core/store-context';

// L'avancement réel du chargement, vu de l'intérieur de la scène (étape 6,
// écran de chargement : core/loading.ts). Le code de la scène est signalé
// par DeskShell à l'arrivée du module, la dernière étape par markReady.
// Ici :
//
// - assets : à moitié quand la scène est montée (les textures peintes en
//   code le sont au montage), en entier quand les polices des textures sont
//   chargées (elles se redessinent alors) ;
// - shaders : à la deuxième image demandée, la première a compilé tous les
//   matériaux (three compile au premier rendu) ;
// - frame : la moitié à la première image demandée.
//
// Monté dans le décor, qui appartient à la partie C de l'étape 6 : Scene.tsx
// (socle) ne change pas.
export function LoadProbe() {
  const store = useSceneStoreApi();
  const frames = useRef(0);

  useEffect(() => {
    let alive = true;
    store.getState().setLoad('assets', 0.5);
    void loadSceneFonts().then(() => {
      if (alive) store.getState().setLoad('assets', 1);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  useFrame(() => {
    if (frames.current > 1) return;
    frames.current += 1;
    const state = store.getState();
    if (frames.current === 1) state.setLoad('frame', 0.5);
    else state.setLoad('shaders', 1);
  });

  return null;
}
