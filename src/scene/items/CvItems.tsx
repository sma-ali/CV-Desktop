'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { Box } from '../core/geometry';
import { ITEM_IDS, type ItemId } from '../core/ids';
import { ITEM_POSES } from '../core/constants';
import { standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';

// PROVISOIRE : un bloc par objet du CV, à sa place, cliquable. Il montre le
// contrat du store (survol, présentation) ; la partie « objets » remplace ce
// fichier (écran et code, livre, badge, post-it, casque, portable, carte,
// coffret, étiquettes, présentation devant la caméra).

const SIZES: Record<ItemId, readonly [number, number, number]> = {
  book: [1.9, 0.5, 2.5],
  badge: [0.86, 0.04, 1.24],
  postit: [0.78, 0.02, 0.78],
  headset: [1.2, 0.5, 0.4],
  laptop: [2.7, 0.16, 1.85],
  card: [1.7, 0.03, 1.0],
  chest: [1.25, 0.78, 0.85],
  monitor: [5.0, 2.92, 0.13],
};

const COLORS: Record<ItemId, number> = {
  book: 0x3a4466,
  badge: 0xe6ddca,
  postit: 0xf3d46a,
  headset: 0x2a2826,
  laptop: 0x8f8a82,
  card: 0xe8dcc4,
  chest: 0x5b3720,
  monitor: 0x1c1a18,
};

function Placeholder({ id }: { id: ItemId }) {
  const store = useSceneStoreApi();
  const group = useRef<Group>(null);
  const pose = ITEM_POSES[id];
  const [w, h, d] = SIZES[id];
  const lift = id === 'monitor' ? 0 : 1;

  useFrame(() => {
    const { presented, hovered, frame } = store.getState();
    if (!group.current) return;
    const target = presented === id ? lift : hovered === id ? 0.08 : 0;
    group.current.position.y +=
      (pose.y + target - group.current.position.y) * Math.min(1, frame.dt * 6);
  });

  return (
    <group ref={group} position={[pose.x, pose.y, pose.z]} rotation={[0, pose.ry, 0]}>
      <Box
        size={[w, h, d]}
        position={[0, id === 'monitor' ? 2.32 : h / 2, 0]}
        material={standardMaterial(COLORS[id], { roughness: 0.7 })}
        onClick={(event) => {
          event.stopPropagation();
          const state = store.getState();
          if (state.presented === id) state.putBack();
          else state.present(id, 'click');
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          store.getState().setHovered(id);
        }}
        onPointerOut={() => {
          if (store.getState().hovered === id) store.getState().setHovered(null);
        }}
      />
    </group>
  );
}

export function CvItems({ texts }: { texts: SceneTexts }) {
  return (
    <group name={`cv-items-${texts.locale}`}>
      {ITEM_IDS.map((id) => (
        <Placeholder key={id} id={id} />
      ))}
    </group>
  );
}
