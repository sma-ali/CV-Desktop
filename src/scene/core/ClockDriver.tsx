'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { smooth } from './arrival';
import { MOOD_TRANSITION, PORTRAIT_MAX_ASPECT } from './constants';
import type { MoodId } from './ids';
import { blendMoodValues, copyMoodValues, moodValues, type MoodValues } from './mood-values';
import { useSceneStoreApi } from './store-context';
import { updateFrame } from './store';

/** Priorité du useFrame du socle : avant tous les autres (négative, elle garde le rendu automatique). */
export const CLOCK_PRIORITY = -100;

/** Images dessinées avant d'annoncer la scène prête. */
const READY_AFTER_FRAMES = 2;

interface MoodBlend {
  mood: MoodId;
  from: MoodValues;
  to: MoodValues;
  k: number;
}

// Le cœur du socle : à chaque image, avance l'horloge, recalcule frame
// (niveaux de l'arrivée, ambiance interpolée, portrait) et met à jour phase
// et hud dans le store quand ils changent. Suspend l'horloge quand l'onglet
// est caché.
export function ClockDriver({ onReady }: { onReady?: () => void }) {
  const store = useSceneStoreApi();
  const frames = useRef(0);
  const blend = useRef<MoodBlend | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      const now = performance.now() / 1000;
      const { clock } = store.getState();
      if (document.hidden) clock.pause(now);
      else clock.resume(now);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [store]);

  useFrame((state) => {
    const scene = store.getState();
    scene.clock.tick(performance.now() / 1000);
    const frame = updateFrame(scene, state.size.width / state.size.height < PORTRAIT_MAX_ASPECT);

    // L'ambiance : instantanée au départ et en mouvement réduit, sinon en 1.4 s.
    let current = blend.current;
    if (!current) {
      current = {
        mood: scene.mood,
        from: moodValues(scene.mood),
        to: moodValues(scene.mood),
        k: 1,
      };
      blend.current = current;
    } else if (current.mood !== scene.mood) {
      copyMoodValues(frame.mood, current.from);
      current.to = moodValues(scene.mood);
      current.mood = scene.mood;
      current.k = scene.settings.reducedMotion ? 1 : 0;
    }
    if (current.k < 1) current.k = Math.min(1, current.k + frame.dt / MOOD_TRANSITION);
    blendMoodValues(current.from, current.to, smooth(current.k), frame.mood);

    scene.syncArrival(frame.t);

    frames.current += 1;
    if (frames.current === READY_AFTER_FRAMES) {
      scene.markReady();
      onReady?.();
    }
  }, CLOCK_PRIORITY);

  return null;
}
