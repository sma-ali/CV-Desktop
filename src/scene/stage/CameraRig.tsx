'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import { damp, lerp } from '../core/math';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import {
  arrivalPose,
  blendPose,
  createPose,
  fitRestView,
  type CameraPose,
  isPortrait,
  screenFocusPose,
  startView,
} from './framing';
import { STAGE_PRIORITY } from './priorities';
import type { StageShared } from './shared';

/** Vitesse du lissage de la caméra et du gros plan sur l'écran (part restante après une seconde). */
const CAMERA_SMOOTHING = 0.02;
const SCREEN_SMOOTHING = 0.03;
/** Plan du fond de la caméra au plus près (celui de SceneCanvas). */
const MIN_FAR = 90;
/** Le plan du fond, en multiple de la distance de la vue de repos (le mur reste dans le champ). */
const FAR_PER_DISTANCE = 2.2;

// La caméra : montée de l'arrivée (de START vers la vue de repos), cadrage
// recalculé au redimensionnement (portrait sur téléphone), léger mouvement
// qui suit le pointeur une fois posée, gros plan sur l'écran quand on le
// présente. Lissée d'une image à l'autre, sauf en mouvement réduit et
// horloge gelée (la pose est alors exacte tout de suite).
export function CameraRig({ sharedRef }: { sharedRef: RefObject<StageShared> }) {
  const store = useSceneStoreApi();
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const replays = useSceneStore((state) => state.replays);
  const aspect = width / Math.max(1, height);
  const portrait = isPortrait(aspect);

  // La vue de repos ne dépend que du format : calculée au redimensionnement.
  const rest = useMemo(() => fitRestView(aspect, { width, height }), [aspect, width, height]);
  const screen = useMemo(() => screenFocusPose(portrait), [portrait]);
  // Poses de travail, réutilisées à chaque image ; ready à false : la
  // prochaine pose est prise telle quelle, sans lissage.
  const rigRef = useRef<{ wanted: CameraPose; smoothed: CameraPose; ready: boolean } | null>(null);

  // Rejouer, ou un nouveau format : la caméra repart sans glisser depuis l'ancienne pose.
  useEffect(() => {
    if (rigRef.current) rigRef.current.ready = false;
  }, [replays, rest]);

  useFrame((state) => {
    const { frame, settings, presented, clock } = store.getState();
    const camera = state.camera as PerspectiveCamera;
    const shared = sharedRef.current;
    const rig = (rigRef.current ??= { wanted: createPose(), smoothed: createPose(), ready: false });
    const reduced = settings.reducedMotion;
    const exact = reduced || clock.frozen || !rig.ready;

    const pose = arrivalPose(
      {
        t: frame.t,
        progress: frame.camera,
        start: startView(portrait),
        rest,
        pointerX: state.pointer.x,
        pointerY: state.pointer.y,
        reduced,
      },
      rig.wanted,
    );

    // Gros plan sur l'écran.
    const wantScreen = presented === 'monitor' ? 1 : 0;
    shared.screenFocus = exact
      ? wantScreen
      : lerp(shared.screenFocus, wantScreen, damp(SCREEN_SMOOTHING, frame.dt));
    if (shared.screenFocus > 0.001) blendPose(pose, screen, shared.screenFocus);

    const { smoothed } = rig;
    if (exact) {
      smoothed.position.copy(pose.position);
      smoothed.target.copy(pose.target);
      rig.ready = true;
    } else {
      const a = damp(CAMERA_SMOOTHING, frame.dt);
      smoothed.position.lerp(pose.position, a);
      smoothed.target.lerp(pose.target, a);
    }
    camera.position.copy(smoothed.position);
    camera.lookAt(smoothed.target);
    // En portrait, la caméra recule loin pour faire tenir tout le bureau :
    // le plan du fond suit, pour garder le mur et la fenêtre.
    const far = Math.max(MIN_FAR, rest.dist * FAR_PER_DISTANCE);
    if (Math.abs(camera.fov - pose.fov) > 1e-4 || camera.far !== far) {
      camera.fov = pose.fov;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }, STAGE_PRIORITY.camera);

  return null;
}
