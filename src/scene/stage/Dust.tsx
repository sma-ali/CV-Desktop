'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  type Points,
} from 'three';
import { rng } from '../core/rng';
import { useSceneStoreApi } from '../core/store-context';
import { dustOpacity } from './lighting';
import { STAGE_PRIORITY } from './priorities';
import { noRaycast } from './shaders';

/** Nombre de grains, et leur taille (unités du monde, comme size de PointsMaterial). */
const DUST_COUNT = 260;
const DUST_SIZE = 0.06;
const DUST_COLOR = 0xffd49a;

// Chaque grain flotte autour de sa place de départ ; tout le mouvement est
// calculé par la carte graphique d'après uTime (le prototype recalculait les
// 260 positions à chaque image sur le processeur).
const vertexShader = /* glsl */ `
attribute vec2 aDrift;
uniform float uTime;
uniform float uSize;
uniform float uScale;
void main() {
  float phase = aDrift.x;
  float speed = aDrift.y;
  vec3 p = position + vec3(
    sin(uTime * 0.11 * speed + phase) * 0.5,
    sin(uTime * 0.07 + phase * 2.0) * 0.35,
    cos(uTime * 0.09 * speed + phase) * 0.5
  );
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

// Un point doux : plein au centre, nul au bord (le softDot du prototype).
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = d < 0.35 ? mix(1.0, 0.55, d / 0.35) : mix(0.55, 0.0, clamp((d - 0.35) / 0.65, 0.0, 1.0));
  gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
  #include <colorspace_fragment>
}`;

// La poussière qui danse dans le faisceau de la lampe et la lumière du jour.
// Immobile en mouvement réduit.
export function Dust() {
  const store = useSceneStoreApi();
  const pointsRef = useRef<Points<BufferGeometry, ShaderMaterial>>(null);
  const { geometry, material } = useMemo(() => {
    const random = rng(5);
    const positions = new Float32Array(DUST_COUNT * 3);
    const drift = new Float32Array(DUST_COUNT * 2);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = random() * 10 - 7;
      positions[i * 3 + 1] = random() * 3.6 + 0.2;
      positions[i * 3 + 2] = random() * 5.5 - 3.2;
      drift[i * 2] = random() * 6.28;
      drift[i * 2 + 1] = 0.2 + random() * 0.6;
    }
    const cloud = new BufferGeometry();
    cloud.setAttribute('position', new BufferAttribute(positions, 3));
    cloud.setAttribute('aDrift', new BufferAttribute(drift, 2));
    const shader = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: DUST_SIZE },
        uScale: { value: 450 },
        uColor: { value: new Color(DUST_COLOR) },
        uOpacity: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geometry: cloud, material: shader };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const uniforms = pointsRef.current?.material.uniforms;
    if (!uniforms?.uTime || !uniforms.uScale || !uniforms.uOpacity) return;
    const { frame, settings } = store.getState();
    uniforms.uTime.value = settings.reducedMotion ? 0 : frame.t;
    // Comme sizeAttenuation de three : la moitié de la hauteur du tampon de dessin.
    uniforms.uScale.value = (state.size.height * state.viewport.dpr) / 2;
    uniforms.uOpacity.value = dustOpacity(frame.lamp, frame.window, frame.mood.dust);
  }, STAGE_PRIORITY.lights);

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={5}
      raycast={noRaycast}
    />
  );
}
