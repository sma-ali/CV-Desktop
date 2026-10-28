'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
  Color,
  type DirectionalLight,
  type HemisphereLight,
  type Object3D,
  type PerspectiveCamera,
  type SpotLight,
} from 'three';
import { lerp } from '../core/arrival';
import { LAMP, LAMP_COLOR, legacyIntensity } from '../core/constants';
import { applyRgb } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import { cameraPosition, fitRestView } from './framing';

// PROVISOIRE : un éclairage proche de l'ambiance de l'après-midi et une
// caméra fixe en vue de repos, pour que le décor et les objets se voient
// correctement. Il suit déjà l'ambiance et la lampe (frame), sans arrivée ni
// post-traitement. La partie « mise en scène » remplace ce dossier (lumières,
// cône et poussière, ciel, ambiances, arrivée, caméra, mode auto, Rejouer,
// post-traitement, qualité adaptative).
export function Stage() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const spot = useRef<SpotLight>(null);
  const spotTarget = useRef<Object3D>(null);
  const sunTarget = useRef<Object3D>(null);

  useLayoutEffect(() => {
    // Les objets de three se lisent avec get() pour les modifier (règle
    // react-hooks/immutability : jamais la valeur renvoyée par un hook).
    const camera = get().camera as PerspectiveCamera;
    const view = fitRestView(width / height);
    camera.fov = view.fov;
    camera.aspect = width / height;
    cameraPosition(view.target, view.elev, view.az, view.dist, camera.position);
    camera.lookAt(...view.target);
    camera.updateProjectionMatrix();
  }, [get, width, height]);

  useLayoutEffect(() => {
    if (spot.current && spotTarget.current) spot.current.target = spotTarget.current;
    if (sun.current && sunTarget.current) sun.current.target = sunTarget.current;
  }, []);

  useFrame(({ scene }) => {
    const { frame } = store.getState();
    const { mood } = frame;
    if (scene.background instanceof Color) applyRgb(scene.background, mood.background);
    if (hemi.current) {
      applyRgb(hemi.current.color, mood.hemiSky);
      applyRgb(hemi.current.groundColor, mood.hemiGround);
      hemi.current.intensity = legacyIntensity(lerp(0.06, mood.hemi, frame.ambient));
    }
    if (sun.current) {
      applyRgb(sun.current.color, mood.sunColor);
      sun.current.intensity = legacyIntensity(frame.window * mood.sun);
      sun.current.position.set(-mood.dir.x * 12 - 2, -mood.dir.y * 12, -mood.dir.z * 12);
    }
    if (spot.current) {
      spot.current.intensity = legacyIntensity(frame.lamp * 0.98 * mood.lamp) + frame.lampFlash;
    }
  });

  const [hx, hy, hz] = LAMP.head;
  return (
    <>
      <hemisphereLight ref={hemi} args={[0xc8d2de, 0x3e2a1a, 1]} />
      <directionalLight ref={sun} args={[0xfff2dc, 1]} position={[-3, 8, -9]} />
      <spotLight
        ref={spot}
        args={[LAMP_COLOR, 0, 0, 0.66, 0.72, 0]}
        position={[hx, hy - 0.18, hz + 0.1]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />
      <object3D ref={spotTarget} position={LAMP.aim} />
      <object3D ref={sunTarget} position={[-2, 0, 0]} />
    </>
  );
}
