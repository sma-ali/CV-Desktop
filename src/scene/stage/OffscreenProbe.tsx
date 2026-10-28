'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Camera } from 'three';
import { bodyObb, obbCorners } from '../core/bodies';
import { HEADSET_STAND, ITEM_POSES, LAMP, MONITOR, type Vec3 } from '../core/constants';
import { BODY_IDS, type BodyId } from '../core/ids';
import type { SceneState } from '../core/store';
import { useSceneStoreApi } from '../core/store-context';
import { MIC, MIC_CENTER } from '../decor/layout';

// Ce qui sort du cadre au repos (partie « objets », cadrage sur téléphone) :
// toutes les quelques images, une fois l'arrivée finie et rien de présenté,
// projette les coins de chaque corps du plateau et quelques points du décor
// (micro, lampe, écran, casque) et écrit dans store.offscreen ceux qui
// dépassent de la fenêtre. Le HUD l'expose aux tests (data-offscreen).

/** Toutes les combien d'images on mesure (aussi sous ?fige, où dt vaut 0). */
const EVERY = 12;

/** Priorité : après les gestes (-12) et la caméra, avant le rendu. */
export const OFFSCREEN_PRIORITY = -8;

const [mx, , mz] = MONITOR.position;
const halfFrame = MONITOR.frame.width / 2;

/** Points fixes à garder dans le cadre, par identifiant. */
const FIXED_POINTS: Record<string, readonly Vec3[]> = {
  monitor: [
    [mx - halfFrame, MONITOR.tiltY + MONITOR.frame.height / 2, mz],
    [mx + halfFrame, MONITOR.tiltY + MONITOR.frame.height / 2, mz],
  ],
  headset: [[HEADSET_STAND[0], ITEM_POSES.headset.y + 0.9, HEADSET_STAND[2]]],
  mic: [MIC.clamp, ...MIC.joints, MIC_CENTER],
  lamp: [LAMP.base, LAMP.head],
};

const probe = new Vector3();

function outside(camera: Camera, [x, y, z]: Vec3): boolean {
  probe.set(x, y, z).project(camera);
  return probe.z > 1 || Math.abs(probe.x) > 1 || Math.abs(probe.y) > 1;
}

function bodyOutside(camera: Camera, state: SceneState, id: BodyId): boolean {
  const body = state.desk[id];
  return obbCorners(bodyObb(id, body)).some(([x, z]) => outside(camera, [x, 0, z]));
}

export function OffscreenProbe() {
  const store = useSceneStoreApi();
  const frames = useRef(0);

  useFrame(({ camera }) => {
    frames.current += 1;
    if (frames.current % EVERY !== 0) return;
    const state = store.getState();
    const { frame, presented, dragging } = state;
    if (frame.camera < 1 || presented !== null || dragging !== null || frame.presentLevel > 0) {
      return;
    }
    const ids: string[] = [];
    for (const id of BODY_IDS) if (bodyOutside(camera, state, id)) ids.push(id);
    for (const [id, points] of Object.entries(FIXED_POINTS)) {
      if (points.some((point) => outside(camera, point))) ids.push(id);
    }
    state.setOffscreen(ids);
  }, OFFSCREEN_PRIORITY);

  return null;
}
