'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PlaneGeometry, ShaderMaterial, type CanvasTexture, type Mesh } from 'three';
import { smooth } from '../core/arrival';
import { MOOD_TRANSITION, WINDOW_SKY } from '../core/constants';
import type { MoodId } from '../core/ids';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { createCanvasTexture, paintCanvasTexture } from '../core/textures';
import { skyLevel } from './lighting';
import { drawSky } from './paint';
import { STAGE_PRIORITY } from './priorities';
import { noRaycast } from './shaders';

const SKY_SIZE = 512;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Fondu entre le ciel de l'ambiance quittée et celui de la nouvelle.
const fragmentShader = /* glsl */ `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uMix;
uniform float uLevel;
varying vec2 vUv;
void main() {
  vec3 color = mix(texture2D(uFrom, vUv).rgb, texture2D(uTo, vUv).rgb, uMix);
  gl_FragColor = vec4(color * uLevel, 1.0);
  #include <colorspace_fragment>
}`;

interface SkyBlend {
  /** Fondu en cours entre deux ciels (0 à 1). */
  k: number;
  /** L'ambiance affichée (null avant le premier ciel). */
  mood: MoodId | null;
}

/** Avance le fondu entre deux ciels et règle la luminosité du ciel. */
function advanceSky(material: ShaderMaterial, blend: SkyBlend, dt: number, window: number) {
  if (blend.k < 1) blend.k = Math.min(1, blend.k + dt / MOOD_TRANSITION);
  const { uMix, uLevel } = material.uniforms;
  if (uMix) uMix.value = smooth(blend.k);
  if (uLevel) uLevel.value = skyLevel(window);
}

// Le ciel derrière la fenêtre : une texture peinte par ambiance (dessinée la
// première fois qu'on en a besoin), en fondu d'une ambiance à l'autre, sombre
// tant que la lumière du jour n'est pas arrivée.
export function Sky() {
  const store = useSceneStoreApi();
  const gl = useThree((state) => state.gl);
  const mood = useSceneStore((state) => state.mood);
  const meshRef = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null);
  const blend = useRef<SkyBlend>({ k: 1, mood: null });

  const sky = useMemo(() => {
    const textures = new Map<MoodId, CanvasTexture>();
    const material = new ShaderMaterial({
      uniforms: {
        uFrom: { value: null },
        uTo: { value: null },
        uMix: { value: 1 },
        uLevel: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });
    const geometry = new PlaneGeometry(...WINDOW_SKY.size);
    const texture = (id: MoodId): CanvasTexture => {
      let found = textures.get(id);
      if (!found) {
        const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) =>
          drawSky(ctx, w, h, id);
        found = createCanvasTexture(gl, { width: SKY_SIZE, height: SKY_SIZE, draw });
        paintCanvasTexture(found, draw);
        textures.set(id, found);
      }
      return found;
    };
    return { textures, material, geometry, texture };
  }, [gl]);

  useEffect(
    () => () => {
      sky.textures.forEach((texture) => texture.dispose());
      sky.textures.clear();
      sky.material.dispose();
      sky.geometry.dispose();
    },
    [sky],
  );

  // Nouvelle ambiance : le ciel courant devient celui qu'on quitte.
  useLayoutEffect(() => {
    const uniforms = meshRef.current?.material.uniforms;
    if (!uniforms?.uFrom || !uniforms.uTo) return;
    const next = sky.texture(mood);
    const { settings } = store.getState();
    const instant = blend.current.mood === null || settings.reducedMotion;
    uniforms.uFrom.value = instant ? next : uniforms.uTo.value;
    uniforms.uTo.value = next;
    blend.current.k = instant ? 1 : 0;
    blend.current.mood = mood;
  }, [sky, mood, store]);

  useFrame(() => {
    const material = meshRef.current?.material;
    if (!material) return;
    const { frame } = store.getState();
    advanceSky(material, blend.current, frame.dt, frame.window);
  }, STAGE_PRIORITY.lights);

  return (
    <mesh
      ref={meshRef}
      geometry={sky.geometry}
      material={sky.material}
      position={WINDOW_SKY.position}
      raycast={noRaycast}
    />
  );
}
