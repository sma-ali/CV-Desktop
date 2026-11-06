'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { PerspectiveCamera, Vector3, type Camera } from 'three';
import type { Vec3 } from '../core/constants';
import { FOOTPRINT_IDS } from '../core/bodies';
import { useSceneStoreApi } from '../core/store-context';
import { bodyExtent, fixedExtent, restLimits, screenShare } from './framing';

// Ce qui sort du cadre au repos (partie « objets », cadrage sur téléphone) :
// toutes les quelques images, une fois l'arrivée finie et rien de présenté
// ni de tenu, projette l'encombrement de chaque corps du plateau (les huit
// coins de son rectangle, au ras du plateau et à sa hauteur, à sa place du
// moment) et les points fixes du bureau utile (haut de l'écran, casque,
// corde à sauter, lampe), et écrit dans store.offscreen ceux qui dépassent de la
// fenêtre. Mêmes points que le cadrage de repos (fitRestView) : ce que le
// cadrage fait tenir, le relevé le vérifie. Le HUD l'expose aux tests
// (data-offscreen) ; le canvas compte les relevés faits
// (data-offscreen-probes), pour qu'un test sache que la liste vide vient
// d'une mesure et non de l'état de départ. Il écrit aussi la part de la
// hauteur utile, entre les bandes du HUD, que couvre ce bureau utile
// (data-desk-share, 0.736 sur un téléphone de 390x844) : la mesure du
// bureau resserré du portrait, que les tests E2E vérifient.

/** Toutes les combien d'images on mesure (aussi sous ?fige, où dt vaut 0). */
const EVERY = 12;

/** Priorité : après les gestes (-12) et la caméra, avant le rendu. */
const OFFSCREEN_PRIORITY = -8;

/** Tolérance en coordonnées normalisées : un coin posé sur le bord compte comme dedans. */
const EDGE = 1.002;

const probe = new Vector3();

function outside(camera: Camera, [x, y, z]: Vec3): boolean {
  probe.set(x, y, z).project(camera);
  return probe.z > 1 || Math.abs(probe.x) > EDGE || Math.abs(probe.y) > EDGE;
}

export function OffscreenProbe() {
  const store = useSceneStoreApi();
  const frames = useRef(0);
  const probes = useRef(0);

  useFrame(({ camera, gl, size }) => {
    frames.current += 1;
    if (frames.current % EVERY !== 0) return;
    const state = store.getState();
    const { frame, presented, dragging, desk } = state;
    if (frame.camera < 1 || presented !== null || dragging !== null || frame.presentLevel > 0) {
      return;
    }
    const ids: string[] = [];
    const all: Vec3[] = [];
    for (const id of FOOTPRINT_IDS) {
      const points = bodyExtent(id, desk[id]);
      all.push(...points);
      if (points.some((point) => outside(camera, point))) ids.push(id);
    }
    for (const [id, points] of Object.entries(fixedExtent(frame.portrait))) {
      all.push(...points);
      if (points.some((point) => outside(camera, point))) ids.push(id);
    }
    if (camera instanceof PerspectiveCamera) {
      const share = screenShare(all, camera, restLimits(frame.portrait, size));
      gl.domElement.dataset.deskShare = share.toFixed(3);
    }
    state.setOffscreen(ids);
    probes.current += 1;
    gl.domElement.dataset.offscreenProbes = String(probes.current);
  }, OFFSCREEN_PRIORITY);

  return null;
}
