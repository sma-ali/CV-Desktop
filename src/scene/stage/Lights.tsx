'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  type DirectionalLight,
  type HemisphereLight,
  type Object3D,
  type PointLight,
  type SpotLight,
  Vector3,
} from 'three';
import { LAMP, LAMP_COLOR, POINT_DECAY } from '../core/constants';
import { applyRgb } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import {
  POINT_LIGHT_DISTANCE,
  handIntensity,
  hemiIntensity,
  monitorIntensity,
  spotIntensity,
  sunIntensity,
} from './lighting';
import { DecorPiece } from '../decor/DecorPiece';
import { STAGE_PRIORITY } from './priorities';

/** Où le soleil vise : un peu à gauche du centre, sous la fenêtre. */
const SUN_TARGET = [-2, 0, 0] as const;
/** Les ombres du soleil restent légères : le prototype n'en avait pas, la lumière du jour est diffuse. */
const SUN_SHADOW = 0.45;
/** Distance du soleil au point visé. */
const SUN_DISTANCE = 12;
/** La lumière de l'écran, devant la dalle. */
const MONITOR_LIGHT = [0.3, 2.0, -1.6] as const;
/** La lumière de l'objet tenu, dans le repère de la caméra (en haut à gauche). */
const HAND_OFFSET = new Vector3(-1.2, 1.6, 0.4);

// Les lumières de la pièce : hémisphère (ciel et sol), soleil par la fenêtre
// (avec ombres), projecteur de la lampe (avec ombres), lueur de l'écran, et
// la lumière qui accompagne l'objet présenté. Le fond de la scène (posé par
// SceneCanvas) suit l'ambiance. Tout se règle à chaque image d'après frame
// (lighting.ts), sans jamais allumer ni éteindre une lumière : changer leur
// nombre recompilerait les shaders.
export function Lights({ shadows }: { shadows: boolean }) {
  const store = useSceneStoreApi();
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const spot = useRef<SpotLight>(null);
  const monitor = useRef<PointLight>(null);
  const hand = useRef<PointLight>(null);
  const spotTarget = useRef<Object3D>(null);
  const sunTarget = useRef<Object3D>(null);
  const handPosition = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    if (spot.current && spotTarget.current) spot.current.target = spotTarget.current;
    if (sun.current && sunTarget.current) sun.current.target = sunTarget.current;
  }, []);

  useFrame((state) => {
    const { frame } = store.getState();
    const { mood } = frame;
    if (state.scene.background instanceof Color) applyRgb(state.scene.background, mood.background);

    const light = hemi.current;
    if (light) {
      applyRgb(light.color, mood.hemiSky);
      applyRgb(light.groundColor, mood.hemiGround);
      light.intensity = hemiIntensity(frame.ambient, mood.hemi);
    }
    const sunLight = sun.current;
    if (sunLight) {
      applyRgb(sunLight.color, mood.sunColor);
      sunLight.intensity = sunIntensity(frame.window, mood.sun);
      sunLight.position.set(
        SUN_TARGET[0] - mood.dir.x * SUN_DISTANCE,
        SUN_TARGET[1] - mood.dir.y * SUN_DISTANCE,
        SUN_TARGET[2] - mood.dir.z * SUN_DISTANCE,
      );
    }
    if (spot.current) {
      spot.current.intensity = spotIntensity(frame.lamp, frame.lampFlash, frame.window, mood.lamp);
    }
    if (monitor.current) monitor.current.intensity = monitorIntensity(frame.screen);
    const handLight = hand.current;
    if (handLight) {
      handLight.intensity = handIntensity(frame.presentLevel);
      handPosition.copy(HAND_OFFSET);
      state.camera.localToWorld(handPosition);
      handLight.position.copy(handPosition);
    }
  }, STAGE_PRIORITY.lights);

  const [hx, hy, hz] = LAMP.head;
  return (
    <>
      <hemisphereLight ref={hemi} args={[0xc8d2de, 0x3e2a1a, 0]} />
      <directionalLight
        ref={sun}
        args={[0xfff2dc, 0]}
        position={[-3, 8, -9]}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-radius={2}
        shadow-intensity={SUN_SHADOW}
      />
      {/* La lampe change de place en portrait (bureau resserré) : sa lumière la suit. */}
      <DecorPiece id="lamp">
        <spotLight
          ref={spot}
          args={[LAMP_COLOR, 0, 0, 0.66, 0.72, 0]}
          position={[hx, hy - 0.18, hz + 0.1]}
          castShadow={shadows}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.5}
          shadow-camera-far={14}
          shadow-bias={-0.0012}
          shadow-normalBias={0.02}
        />
        <object3D ref={spotTarget} position={LAMP.aim} />
      </DecorPiece>
      <pointLight
        ref={monitor}
        args={[0xffd7a8, 0, POINT_LIGHT_DISTANCE, POINT_DECAY]}
        position={MONITOR_LIGHT}
      />
      <pointLight ref={hand} args={[0xfff0dc, 0, POINT_LIGHT_DISTANCE, POINT_DECAY]} />
      <object3D ref={sunTarget} position={SUN_TARGET} />
    </>
  );
}
