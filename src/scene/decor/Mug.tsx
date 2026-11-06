'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Sprite } from 'three';
import { useSceneStoreApi } from '../core/store-context';
import { useCanvasTexture } from '../core/textures';
import { STEAM_COUNT, steamPuff, type SteamPuff } from './layout';
import type { Part } from './merge';
import { paintSoftDot } from './paint';
import { cyl, MergedParts, torus, usePressTime } from './shared';

// La tasse et sa vapeur, qui fume plus fort quand on clique dessus.

function mugParts(): Part[] {
  return [
    {
      geometry: cyl(0.3, 0.28, 0.52, 12),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0, 0.26, 0],
    },
    {
      geometry: cyl(0.305, 0.305, 0.08, 12),
      color: 0x8f2a22,
      finish: 'gloss',
      position: [0, 0.36, 0],
    },
    // Le café affleure, cerné par la lèvre de la tasse.
    {
      geometry: cyl(0.265, 0.265, 0.02, 12),
      color: 0x2a170c,
      finish: 'gloss',
      position: [0, 0.525, 0],
    },
    {
      geometry: torus(0.285, 0.022, 4, 16),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0, 0.53, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      geometry: torus(0.13, 0.04, 6, 10, Math.PI * 1.2),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0.3, 0.27, 0],
      rotation: [0, 0, -Math.PI * 0.6],
    },
  ];
}

const STEAM_INDICES = Array.from({ length: STEAM_COUNT }, (_, i) => i);

export function Mug() {
  const store = useSceneStoreApi();
  const { at: puffAt, handlers } = usePressTime();
  const dot = useCanvasTexture({ width: 64, height: 64, draw: paintSoftDot, usesFonts: false });
  const sprites = useRef<(Sprite | null)[]>([]);
  const puffRef = useRef<SteamPuff>({ x: 0, y: 0, z: 0, scale: 0, opacity: 0 });

  useFrame(() => {
    const { frame, settings } = store.getState();
    const light = frame.lamp + frame.window;
    const puff = puffRef.current;
    for (let i = 0; i < STEAM_COUNT; i++) {
      const sprite = sprites.current[i];
      if (!sprite) continue;
      steamPuff(frame.t, i, light, puffAt.current, settings.reducedMotion, puff);
      sprite.position.set(puff.x, puff.y, puff.z);
      sprite.scale.setScalar(puff.scale);
      sprite.material.opacity = puff.opacity;
      sprite.visible = puff.opacity > 0.002;
    }
  });

  return (
    <group name="decor-mug" {...handlers}>
      <MergedParts build={mugParts} />
      {STEAM_INDICES.map((i) => (
        <sprite
          key={i}
          ref={(node) => {
            sprites.current[i] = node;
          }}
          renderOrder={2}
          visible={false}
        >
          {/* Un matériau par bouffée : chacune a sa propre opacité. */}
          <spriteMaterial map={dot} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
