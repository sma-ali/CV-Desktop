'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
} from 'three';
import { useSceneStoreApi } from '../core/store-context';
import { PLANT, leafLayout, shake, sway } from './layout';
import type { Part } from './merge';
import { cyl, MergedParts, usePressTime } from './shared';

// La plante en pot : des feuilles instanciées qui se balancent, et
// tremblent quand on clique dessus.

const LEAVES = leafLayout();
const LEAF_COLORS = [0x5f8650, 0x46703f] as const;

function potParts(): Part[] {
  return [
    { geometry: cyl(0.34, 0.26, 0.5, 9), color: 0xb5623e, position: [0, 0.25, 0] },
    { geometry: cyl(0.36, 0.36, 0.08, 9), color: 0xa6583a, position: [0, 0.5, 0] },
    { geometry: cyl(0.31, 0.31, 0.02, 9), color: 0x3a2618, position: [0, 0.52, 0] },
  ];
}

function leafGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.16, 0.25, 0, 0.7);
  shape.quadraticCurveTo(-0.16, 0.25, 0, 0);
  return new ShapeGeometry(shape, 3);
}

export function Plant() {
  const store = useSceneStoreApi();
  const leaves = useRef<InstancedMesh>(null);
  const { at: shakeAt, handlers } = usePressTime();
  const geometry = useMemo(() => leafGeometry(), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        flatShading: true,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const dummy = useMemo(() => new Object3D(), []);
  const last = useRef(Number.NaN);

  useLayoutEffect(() => {
    const mesh = leaves.current;
    if (!mesh) return;
    const color = new Color();
    LEAVES.forEach((leaf, i) => mesh.setColorAt(i, color.setHex(LEAF_COLORS[leaf.shade])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    last.current = Number.NaN;
  }, []);

  useFrame(() => {
    const mesh = leaves.current;
    if (!mesh) return;
    const { frame, settings } = store.getState();
    const { t } = frame;
    const reduced = settings.reducedMotion;
    const shook = shake(t, shakeAt.current, reduced);
    // Rien ne bouge (horloge figée, mouvement réduit au repos) : rien à envoyer.
    const key = reduced && shook === 0 ? 0 : t + shook;
    if (key === last.current) return;
    last.current = key;
    LEAVES.forEach((leaf, i) => {
      dummy.position.set(0, 0.52, 0);
      dummy.rotation.set(0, leaf.ry, 0);
      dummy.rotateX(leaf.rx + sway(t, 0.8, leaf.phase, 0.03, reduced) + shook);
      dummy.scale.setScalar(leaf.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="decor-plant" position={PLANT.position} {...handlers}>
      <MergedParts build={potParts} />
      <instancedMesh ref={leaves} args={[geometry, material, LEAVES.length]} castShadow />
    </group>
  );
}
