'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { createAutoTour, resetAutoTour, stepAutoTour } from './auto';
import { STAGE_PRIORITY } from './priorities';

/** Touches qui ne comptent pas comme une action (modificateurs seuls). */
const PASSIVE_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

// La visite automatique : à partir de AUTO_START, présente tour à tour les
// objets de AUTO_SEQ par le store ; s'arrête à la première action du
// visiteur (appui sur la scène, molette, touche du clavier) et reprend après
// IDLE_DELAY secondes sans action. ?auto=0 et le mouvement réduit la coupent
// (settings.autoAllowed).
export function AutoTour() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const replays = useSceneStore((state) => state.replays);
  const tour = useRef(createAutoTour());

  // Rejouer : la visite repart du premier objet.
  useEffect(() => {
    resetAutoTour(tour.current);
  }, [replays]);

  // Une action du visiteur sur la scène coupe la visite (les boutons du HUD
  // et les objets appellent déjà markUser ou present).
  useEffect(() => {
    const canvas = get().gl.domElement;
    const onAction = () => store.getState().markUser();
    const onKey = (event: KeyboardEvent) => {
      if (!PASSIVE_KEYS.has(event.key)) onAction();
    };
    canvas.addEventListener('pointerdown', onAction);
    canvas.addEventListener('wheel', onAction, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('pointerdown', onAction);
      canvas.removeEventListener('wheel', onAction);
      window.removeEventListener('keydown', onKey);
    };
  }, [get, store]);

  useFrame(() => {
    const state = store.getState();
    const command = stepAutoTour(tour.current, {
      t: state.frame.t,
      allowed: state.settings.autoAllowed,
      lastUserAt: state.lastUserAt,
      presented: state.presented,
      presentedBy: state.presentedBy,
    });
    if (!command) return;
    switch (command.type) {
      case 'start':
        state.setAutoOn(true);
        break;
      case 'stop':
        state.setAutoOn(false);
        if (state.presentedBy === 'auto') state.putBack();
        break;
      case 'present':
        state.present(command.item, 'auto');
        break;
      case 'putBack':
        if (state.presentedBy === 'auto') state.putBack();
        break;
    }
  }, STAGE_PRIORITY.auto);

  return null;
}
