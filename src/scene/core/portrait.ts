'use client';

import { useThree } from '@react-three/fiber';
import { PORTRAIT_MAX_ASPECT } from './views';

/**
 * La fenêtre est-elle en portrait ? Réactif : le composant se redessine
 * quand on tourne le téléphone (même règle que frame.portrait, recalculé
 * par ClockDriver à chaque image).
 */
export function usePortrait(): boolean {
  return useThree((state) => state.size.width / state.size.height < PORTRAIT_MAX_ASPECT);
}
