'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { ARRIVAL } from '../core/constants';
import { useSceneStoreApi } from '../core/store-context';
import { rumble } from './layout';
import { withFinish, type Part } from './merge';
import { box, cyl, MergedParts, usePressTime } from './shared';

// La manette (générique, inventée), qui vibre quand on clique dessus.

function padParts(): Part[] {
  const shell = 0xd9cfbd;
  const dark = 0x2b2927;
  return [
    { geometry: box(1.05, 0.16, 0.5), color: shell, finish: 'satin', position: [0, 0.12, -0.02] },
    ...[-1, 1].map((s): Part => ({
      geometry: cyl(0.2, 0.17, 0.55, 8),
      color: shell,
      finish: 'satin',
      position: [s * 0.46, 0.12, 0.16],
      rotation: [Math.PI / 2 - 0.2, 0, s * 0.35],
      scale: [1, 1, 0.8],
    })),
    { geometry: cyl(0.08, 0.09, 0.08, 8), color: dark, position: [-0.2, 0.24, 0.1] },
    { geometry: cyl(0.08, 0.09, 0.08, 8), color: dark, position: [0.2, 0.24, 0.1] },
    { geometry: box(0.2, 0.04, 0.06), color: dark, position: [-0.42, 0.21, -0.06] },
    { geometry: box(0.06, 0.04, 0.2), color: dark, position: [-0.42, 0.21, -0.06] },
    // Quatre boutons en deux teintes du bureau : aucun code de couleurs connu.
    ...(
      [
        [0, -0.08],
        [0.08, 0],
        [-0.08, 0],
        [0, 0.08],
      ] as const
    ).map(([x, z], i): Part => ({
      geometry: cyl(0.035, 0.035, 0.05, 6),
      color: i % 2 ? 0x86a07d : 0xc0574a,
      finish: 'gloss',
      position: [0.42 + x, 0.22, -0.06 + z],
    })),
  ];
}

const padBuild = () => withFinish(padParts(), 'satin');

export function Gamepad() {
  const store = useSceneStoreApi();
  const group = useRef<Group>(null);
  const { at: rumbleAt, handlers } = usePressTime();
  const led = useMemo(() => new MeshBasicMaterial({ color: 0x1b1916 }), []);
  useEffect(() => () => led.dispose(), [led]);

  useFrame(() => {
    const { frame, settings } = store.getState();
    const { t } = frame;
    const on = t >= ARRIVAL.padLed;
    led.color.setRGB(on ? 0.3 : 0.05, on ? 0.6 : 0.03, on ? 1.2 : 0.03, SRGBColorSpace);
    const node = group.current;
    if (!node) return;
    const v = rumble(t, rumbleAt.current, settings.reducedMotion);
    node.position.set(Math.sin(t * 90) * v, 0, Math.cos(t * 77) * v);
    node.rotation.y = Math.sin(t * 60) * v * 1.5;
  });

  return (
    <group name="decor-pad" {...handlers}>
      <group ref={group}>
        <MergedParts build={padBuild} />
        <mesh material={led} position={[0, 0.205, -0.17]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 8]} />
        </mesh>
      </group>
    </group>
  );
}
