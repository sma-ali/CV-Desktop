'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAMP, type Vec3 } from '../core/constants';
import { brass, standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import { addScaled, normalize, springPoints } from './layout';
import type { Part } from './merge';
import { DecorPiece } from './DecorPiece';
import { alignY, box, cyl, MergedParts, rodPart, sph, tube, usePressable } from './shared';

// La lampe d'architecte : pied lesté, bras en deux tiges, rotules en laiton,
// ressorts de rappel, abat-jour vert. La lumière, son cône et la poussière
// appartiennent à la mise en scène ; ici, l'ampoule et l'intérieur de
// l'abat-jour suivent le niveau de la lampe (frame.lamp, frame.lampFlash).
// Un clic sur la lampe l'éteint ou la rallume (toggleLamp).

const IRON = 0x1d1b19;
const BRASS = 0xc9973f;
const SHADE = 0x2d4a3f;

const [bx, , bz] = LAMP.base;
const AIM_DIR = normalize([
  LAMP.aim[0] - LAMP.head[0],
  LAMP.aim[1] - LAMP.head[1],
  LAMP.aim[2] - LAMP.head[2],
]);

/** Profil de l'abat-jour (tourné autour de y, ouverture vers -y). */
function shadeProfile(start: number, flare: number, depth: number, top = 0): Vector2[] {
  return Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return new Vector2(start + Math.pow(t, 1.5) * flare, top - t * depth);
  });
}

function armParts(): Part[] {
  const elbow = LAMP.elbow as Vec3;
  const head = LAMP.head as Vec3;
  const foot: Vec3 = [bx, 0.12, bz];
  // Les ressorts courent le long des bras, un peu décalés vers l'extérieur.
  const lowerSpring = springPoints(
    [bx + 0.11, 0.42, bz + 0.02],
    [elbow[0] + 0.1, elbow[1] - 0.45, elbow[2] + 0.05],
    0.03,
    16,
  );
  const upperSpring = springPoints(
    addScaled(elbow, [0.02, 0.12, 0.05], 1),
    addScaled(head, [-0.32, 0.06, -0.4], 1),
    0.026,
    13,
  );
  return [
    // Le pied lesté, et son interrupteur.
    { geometry: cyl(0.42, 0.48, 0.14, 9), color: IRON, finish: 'metal', position: [bx, 0.07, bz] },
    {
      geometry: cyl(0.3, 0.36, 0.05, 9),
      color: 0x2a2724,
      finish: 'metal',
      position: [bx, 0.16, bz],
    },
    {
      geometry: cyl(0.07, 0.07, 0.12, 6),
      color: BRASS,
      finish: 'brass',
      position: [bx + 0.22, 0.2, bz + 0.14],
    },
    // Les bras et leurs rotules.
    rodPart(foot, elbow, 0.045, IRON),
    rodPart(elbow, head, 0.04, IRON),
    { geometry: sph(0.09), color: BRASS, finish: 'brass', position: elbow },
    { geometry: sph(0.06), color: BRASS, finish: 'brass', position: [bx, 0.22, bz] },
    // Les ressorts.
    { geometry: tube(lowerSpring, 0.009, 200, 4), color: 0xb9a88a, finish: 'brass' },
    { geometry: tube(upperSpring, 0.008, 160, 4), color: 0xb9a88a, finish: 'brass' },
    // L'attache de la tête, et le petit bouton de réglage.
    {
      geometry: box(0.12, 0.12, 0.12),
      color: IRON,
      finish: 'metal',
      position: addScaled(head, AIM_DIR, -0.22),
    },
  ];
}

/** L'abat-jour et sa calotte, d'un seul tenant (même matériau, un appel de dessin). */
function shadeGeometry(): BufferGeometry {
  const shade = new LatheGeometry(shadeProfile(0.12, 0.5, 0.62), 10);
  const cap = new CylinderGeometry(0.13, 0.13, 0.16, 8).translate(0, 0.06, 0);
  const merged = mergeGeometries([shade, cap]);
  shade.dispose();
  cap.dispose();
  return merged;
}

export function Lamp() {
  const store = useSceneStoreApi();
  const handlers = usePressable((_, state) => state.toggleLamp());

  const headQuaternion = useMemo(() => alignY([-AIM_DIR[0], -AIM_DIR[1], -AIM_DIR[2]]), []);
  const geometries = useMemo(
    () => ({
      shade: shadeGeometry(),
      inner: new LatheGeometry(shadeProfile(0.112, 0.485, 0.6, -0.008), 10),
      bulb: new IcosahedronGeometry(0.16, 1),
    }),
    [],
  );
  const glow = useMemo(
    () => ({
      bulb: new MeshBasicMaterial({ color: 0x2a1c10 }),
      inner: new MeshBasicMaterial({ color: 0x000000, side: DoubleSide }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      Object.values(glow).forEach((material) => material.dispose());
    },
    [geometries, glow],
  );

  useFrame(() => {
    const { lamp: k, lampFlash: flash } = store.getState().frame;
    glow.bulb.color.setRGB(
      0.17 + k * 1.6 + flash,
      0.12 + k * 1.2 + flash * 0.7,
      0.06 + k * 0.7 + flash * 0.35,
      SRGBColorSpace,
    );
    glow.inner.color.setRGB(k * 0.9, k * 0.62, k * 0.3, SRGBColorSpace);
  });

  const shadeMaterial = standardMaterial(SHADE, {
    side: DoubleSide,
    roughness: 0.5,
    metalness: 0.3,
  });

  return (
    <DecorPiece id="lamp">
      <group name="decor-lamp" {...handlers}>
        <MergedParts build={armParts} />
        <group position={LAMP.head} quaternion={headQuaternion}>
          <mesh geometry={geometries.shade} material={shadeMaterial} castShadow />
          <mesh geometry={geometries.inner} material={glow.inner} scale={[0.985, 1, 0.985]} />
          <mesh position={[0, 0.17, 0]} material={brass()}>
            <cylinderGeometry args={[0.05, 0.07, 0.08, 6]} />
          </mesh>
          <mesh geometry={geometries.bulb} material={glow.bulb} position={[0, -0.3, 0]} />
        </group>
      </group>
    </DecorPiece>
  );
}
