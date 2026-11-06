'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { BloomEffect } from 'postprocessing';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useSceneStoreApi } from '../core/store-context';
import { GradeEffect } from './gradeEffect';
import { focusPoint, isPortrait } from './framing';
import { bloomStrength, dimLevel, fadeLevel } from './lighting';
import { RENDER_PRIORITY, STAGE_PRIORITY } from './priorities';
import type { StageShared } from './shared';

/** Seuil du bloom (luminance linéaire) : seuls les émissifs (ampoule, écran, LED) le passent. */
const BLOOM_THRESHOLD = 0.82;
/**
 * Échantillons de l'anticrénelage (le canvas n'a plus le sien une fois le
 * post-traitement branché). Inutile sur un écran dense, où il coûte cher.
 */
const MULTISAMPLING = 4;
const DENSE_DPR = 1.5;

// Le post-traitement : bloom sur les émissifs (son intensité suit la lampe),
// puis l'étalonnage chaud (GradeEffect : courbe, vignette, assombrissement
// autour de l'objet présenté, fondu de l'arrivée). Le grain est un calque
// CSS de la page. bloom à false : la qualité
// adaptative l'a coupé.
export function Effects({
  sharedRef,
  bloom,
}: {
  sharedRef: RefObject<StageShared>;
  bloom: boolean;
}) {
  const store = useSceneStoreApi();
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);
  const portrait = isPortrait(width / Math.max(1, height));
  const grade = useMemo(() => new GradeEffect(), []);
  const bloomRef = useRef<BloomEffect>(null);
  const gradeRef = useRef<GradeEffect>(null);

  useEffect(() => () => grade.dispose(), [grade]);

  useFrame(() => {
    const effect = gradeRef.current;
    if (!effect) return;
    const shared = sharedRef.current;
    const { frame, settings, presented } = store.getState();
    const screen = presented === 'monitor' || shared.screenFocus > 0.01;
    const [fx, fy] = focusPoint(screen, portrait);
    effect.setFocus(fx, fy);
    effect.dim = dimLevel(frame.presentLevel, shared.screenFocus);
    effect.fade = fadeLevel(frame.t, frame.lamp, frame.window, settings.reducedMotion);
    if (bloomRef.current) {
      bloomRef.current.intensity = bloomStrength(frame.lamp, frame.lampFlash, frame.window);
    }
  }, STAGE_PRIORITY.effects);

  return (
    <EffectComposer
      multisampling={dpr >= DENSE_DPR ? 0 : MULTISAMPLING}
      renderPriority={RENDER_PRIORITY}
      enableNormalPass={false}
    >
      {bloom ? (
        <Bloom
          ref={bloomRef}
          mipmapBlur
          luminanceThreshold={BLOOM_THRESHOLD}
          luminanceSmoothing={0.12}
          intensity={0.55}
          radius={0.6}
        />
      ) : null}
      <primitive ref={gradeRef} object={grade} />
    </EffectComposer>
  );
}
