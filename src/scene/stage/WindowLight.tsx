'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  ShaderMaterial,
  type Mesh,
} from 'three';
import { applyRgb } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import { createCanvasTexture, paintCanvasTexture } from '../core/textures';
import { patchOpacity, shaftOpacity } from './lighting';
import { drawPanes } from './paint';
import { STAGE_PRIORITY } from './priorities';
import { noRaycast } from './shaders';
import { PATCH_INDEX, PATCH_UV, SHAFT_INDEX, writePatch, writeShaft } from './windowLight';

const shaftVertex = /* glsl */ `
attribute float aTop;
varying float vTop;
void main() {
  vTop = aTop;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Plus dense près de la vitre, presque rien au pied.
const shaftFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vTop;
void main() {
  gl_FragColor = vec4(uColor * uOpacity * (0.15 + 0.85 * vTop), 1.0);
  #include <colorspace_fragment>
}`;

// La lumière du jour par la fenêtre : la tache des carreaux sur le plateau et
// les rais dans l'air, en mélange additif. Leur forme suit la direction du
// soleil de l'ambiance, leur intensité l'arrivée de la fenêtre.
export function WindowLight() {
  const store = useSceneStoreApi();
  const gl = useThree((state) => state.gl);
  const patchRef = useRef<Mesh<BufferGeometry, MeshBasicMaterial>>(null);
  const shaftRef = useRef<Mesh<BufferGeometry, ShaderMaterial>>(null);
  // Dernière direction posée : la géométrie ne se recalcule que si le soleil bouge.
  const lastDirRef = useRef({ x: Number.NaN, y: Number.NaN, z: Number.NaN });

  const parts = useMemo(() => {
    const panes = createCanvasTexture(gl, { width: 256, height: 256, draw: drawPanes });
    paintCanvasTexture(panes, drawPanes);

    const patchGeometry = new BufferGeometry();
    patchGeometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    patchGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(PATCH_UV), 2));
    patchGeometry.setIndex([...PATCH_INDEX]);
    const patchMaterial = new MeshBasicMaterial({
      map: panes,
      color: 0xffe2b0,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    const shaftGeometry = new BufferGeometry();
    shaftGeometry.setAttribute('position', new BufferAttribute(new Float32Array(24), 3));
    shaftGeometry.setAttribute(
      'aTop',
      new BufferAttribute(new Float32Array([1, 1, 1, 1, 0, 0, 0, 0]), 1),
    );
    shaftGeometry.setIndex([...SHAFT_INDEX]);
    const shaftMaterial = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(0xffe2b0) }, uOpacity: { value: 0 } },
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    return { panes, patchGeometry, patchMaterial, shaftGeometry, shaftMaterial };
  }, [gl]);

  useEffect(
    () => () => {
      parts.panes.dispose();
      parts.patchGeometry.dispose();
      parts.patchMaterial.dispose();
      parts.shaftGeometry.dispose();
      parts.shaftMaterial.dispose();
    },
    [parts],
  );

  useFrame(() => {
    const patch = patchRef.current;
    const shaft = shaftRef.current;
    const shaftColor = shaft?.material.uniforms.uColor;
    const shaftLevel = shaft?.material.uniforms.uOpacity;
    if (!patch || !shaft || !shaftColor || !shaftLevel) return;
    const { frame } = store.getState();
    const { mood } = frame;
    const { dir } = mood;
    const last = lastDirRef.current;
    if (dir.x !== last.x || dir.y !== last.y || dir.z !== last.z) {
      last.x = dir.x;
      last.y = dir.y;
      last.z = dir.z;
      const patchPositions = patch.geometry.getAttribute('position') as BufferAttribute;
      writePatch(dir, patchPositions.array as Float32Array);
      patchPositions.needsUpdate = true;
      const shaftPositions = shaft.geometry.getAttribute('position') as BufferAttribute;
      writeShaft(dir, shaftPositions.array as Float32Array);
      shaftPositions.needsUpdate = true;
    }
    applyRgb(patch.material.color, mood.patch);
    patch.material.opacity = patchOpacity(frame.window, mood.patchOpacity);
    applyRgb(shaftColor.value as Color, mood.patch);
    shaftLevel.value = shaftOpacity(frame.window, mood.shaft);
  }, STAGE_PRIORITY.lights);

  return (
    <>
      <mesh
        ref={patchRef}
        geometry={parts.patchGeometry}
        material={parts.patchMaterial}
        renderOrder={2}
        frustumCulled={false}
        raycast={noRaycast}
      />
      <mesh
        ref={shaftRef}
        geometry={parts.shaftGeometry}
        material={parts.shaftMaterial}
        renderOrder={4}
        frustumCulled={false}
        raycast={noRaycast}
      />
    </>
  );
}
