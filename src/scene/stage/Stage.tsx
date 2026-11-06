'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { AutoTour } from './AutoTour';
import { CameraRig } from './CameraRig';
import { Dust } from './Dust';
import { Effects } from './Effects';
import { LampCone } from './LampCone';
import { Lights } from './Lights';
import { OffscreenProbe } from './OffscreenProbe';
import { STAGE_PRIORITY } from './priorities';
import { createQualityMonitor, qualitySettings, sampleQuality, type QualityLevel } from './quality';
import { createStageShared } from './shared';
import { Sky } from './Sky';
import { WindowLight } from './WindowLight';

// La mise en scène du bureau : lumières (hémisphère, soleil par la fenêtre,
// projecteur de la lampe et son cône, lueur de l'écran), lumière du jour sur
// le plateau, poussière, ciel derrière la fenêtre, caméra (arrivée, cadrage,
// gros plan sur l'écran), visite automatique, post-traitement et qualité
// adaptative. Les niveaux de l'arrivée et l'ambiance viennent de
// store.frame ; « Rejouer » passe par le store (replays).
export function Stage() {
  const noPost = useSceneStore((state) => state.settings.noPost);
  const noShadow = useSceneStore((state) => state.settings.noShadow);
  const sharedRef = useRef(createStageShared());
  const [level, setLevel] = useState<QualityLevel>(0);
  const quality = qualitySettings(level);

  return (
    <>
      <Lights shadows={!noShadow && quality.shadows} />
      <LampCone />
      <WindowLight />
      <Dust />
      <Sky />
      <CameraRig sharedRef={sharedRef} />
      <AutoTour />
      <OffscreenProbe />
      <AdaptiveQuality onChange={setLevel} />
      {noPost ? null : <Effects sharedRef={sharedRef} bloom={quality.bloom} />}
    </>
  );
}

// Mesure la durée des images ; si elles sont lentes, baisse la densité de
// pixels puis coupe les ombres, puis le bloom (perf() du prototype). Les
// changements se font hors de la boucle d'images, deux fois au plus.
function AdaptiveQuality({ onChange }: { onChange: (level: QualityLevel) => void }) {
  const store = useSceneStoreApi();
  const setDpr = useThree((state) => state.setDpr);
  const monitor = useRef(createQualityMonitor());
  const [pending, setPending] = useState<QualityLevel | null>(null);

  useEffect(() => {
    if (pending === null) return;
    const { dpr } = qualitySettings(pending);
    if (dpr !== null) setDpr(dpr);
    onChange(pending);
  }, [pending, onChange, setDpr]);

  useFrame(() => {
    const { clock } = store.getState();
    const next = sampleQuality(monitor.current, clock.dt, clock.t, clock.frozen);
    // Deux fois au plus dans la vie de la page : jamais à chaque image.
    if (next !== null) setPending(next);
  }, STAGE_PRIORITY.effects);

  return null;
}
