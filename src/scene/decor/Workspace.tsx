'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../core/constants';
import { useSceneStoreApi } from '../core/store-context';
import { useCanvasTexture } from '../core/textures';
import { KEY_COUNT, KEY_TRAVEL, KEY_Y, KEYBOARD_POSITION, keyDips, keyLayout } from './layout';
import type { Part } from './merge';
import { paintFelt } from './paint';
import { box, cyl, MergedParts, sph, tube } from './shared';

// Le poste de travail : tapis de feutre, clavier mécanique (touches qui
// s'enfoncent quand le code se tape à l'écran, rétroéclairage et voyants
// qui s'allument à l'arrivée), souris, câbles.

const [kx, , kz] = KEYBOARD_POSITION;
const KEYS = keyLayout();

/** Le corps du clavier, la souris et les câbles, fusionnés (repère du monde). */
function staticParts(): Part[] {
  return [
    // Le boîtier du clavier, et sa molette de volume en laiton.
    {
      geometry: box(4.2, 0.13, 1.5),
      color: 0x3a2a1f,
      finish: 'satin',
      position: [kx, 0.065, kz - 0.06],
    },
    {
      geometry: box(4.08, 0.02, 1.32),
      color: 0x241a13,
      position: [kx, 0.135, kz - 0.02],
    },
    {
      geometry: cyl(0.06, 0.06, 0.07, 10),
      color: 0xa87a32,
      finish: 'brass',
      position: [kx - 1.78, 0.17, kz - 0.73],
    },
    // La souris et sa molette.
    {
      geometry: sph(0.3, 1),
      color: 0xe9dcc2,
      finish: 'satin',
      position: [3.35, 0.11, -0.48],
      scale: [0.72, 0.42, 1.05],
    },
    { geometry: box(0.03, 0.04, 0.12), color: 0x3a2a1f, position: [3.35, 0.24, -0.66] },
    // Le câble de l'écran et celui de la souris.
    {
      geometry: tube(
        [
          [0.3, 0.1, -1.27],
          [0.2, 0.03, -1.6],
          [-0.3, 0.03, -2.0],
          [-0.2, 0.03, -2.55],
          [0.2, 0.4, -2.9],
        ] as Vec3[],
        0.035,
      ),
      color: 0x241d18,
      finish: 'satin',
    },
    {
      geometry: tube(
        [
          [3.35, 0.08, -0.95],
          [3.3, 0.03, -1.5],
          [2.6, 0.03, -2.0],
          [1.4, 0.03, -2.4],
          [0.9, 0.3, -2.9],
        ] as Vec3[],
        0.025,
      ),
      color: 0xd8ccb5,
      finish: 'satin',
    },
  ];
}

/** Les trois voyants du clavier, fusionnés : ils s'allument ensemble. */
function ledGeometry() {
  const parts = [0, 1, 2].map((i) => {
    const geometry = new BoxGeometry(0.1, 0.025, 0.05);
    geometry.translate(kx + 1.42 + i * 0.2, 0.142, kz - 0.74);
    return geometry;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((geometry) => geometry.dispose());
  return merged;
}

export function Workspace() {
  const store = useSceneStoreApi();
  const felt = useCanvasTexture({ width: 512, height: 256, draw: paintFelt, usesFonts: false });
  const keys = useRef<InstancedMesh>(null);

  const geometries = useMemo(
    () => ({
      key: new BoxGeometry(0.235, 0.1, 0.22),
      mat: new BoxGeometry(6.6, 0.025, 2.05),
      backlight: new PlaneGeometry(4.04, 1.3).rotateX(-Math.PI / 2),
      leds: ledGeometry(),
    }),
    [],
  );
  const materials = useMemo(
    () => ({
      key: new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: true }),
      mat: new MeshStandardMaterial({ map: felt, roughness: 0.95 }),
      backlight: new MeshBasicMaterial({ color: 0x000000 }),
      leds: new MeshBasicMaterial({ color: 0x1b1916 }),
    }),
    [felt],
  );
  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((material) => material.dispose());
    },
    [geometries, materials],
  );

  // État des touches, hors de React : enfoncement courant et dernier envoyé.
  const keyState = useRef({
    dips: new Float32Array(KEY_COUNT),
    shown: new Float32Array(KEY_COUNT).fill(-1),
    dummy: new Object3D(),
  });

  useLayoutEffect(() => {
    const mesh = keys.current;
    if (!mesh) return;
    const color = new Color();
    KEYS.forEach((key, i) => mesh.setColorAt(i, color.setHex(key.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    keyState.current.shown.fill(-1);
  }, []);

  useFrame(() => {
    const { frame } = store.getState();
    const mesh = keys.current;
    if (mesh) {
      const { dips, shown, dummy } = keyState.current;
      keyDips(frame.t, dips, frame.typingEnd);
      let changed = false;
      for (let i = 0; i < KEY_COUNT; i++) {
        const key = KEYS[i];
        const dip = dips[i] ?? 0;
        if (!key || dip === shown[i]) continue;
        shown[i] = dip;
        dummy.position.set(key.x, KEY_Y - dip * KEY_TRAVEL, key.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        changed = true;
      }
      if (changed) mesh.instanceMatrix.needsUpdate = true;
    }
    // Le rétroéclairage, chaud et discret, et les voyants.
    const led = frame.keyboardLed;
    materials.backlight.color.setRGB(led * 0.3, led * 0.16, led * 0.05, SRGBColorSpace);
    materials.leds.color.setRGB(
      0.1 + led * 1.1,
      0.09 + led * 0.65,
      0.08 + led * 0.2,
      SRGBColorSpace,
    );
  });

  return (
    <group name="decor-workspace">
      {/* Le tapis de feutre : il reçoit les ombres, n'en porte pas. */}
      <mesh
        geometry={geometries.mat}
        material={materials.mat}
        position={[0.9, 0.0125, -0.55]}
        receiveShadow
      />
      <MergedParts build={staticParts} />
      <group position={KEYBOARD_POSITION}>
        <mesh
          geometry={geometries.backlight}
          material={materials.backlight}
          position={[0, 0.147, -0.02]}
        />
        <instancedMesh
          ref={keys}
          args={[geometries.key, materials.key, KEY_COUNT]}
          castShadow
          receiveShadow
        />
      </group>
      <mesh geometry={geometries.leds} material={materials.leds} />
    </group>
  );
}
