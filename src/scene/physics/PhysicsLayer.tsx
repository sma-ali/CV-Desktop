'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import { isItemId } from '../core/ids';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { gestureHub } from '../gestures/hub';
import { PHYSICS_PRIORITY } from '../gestures/priorities';
import { DeskPhysics, FIXED_STEP, GRAVITY, type RapierModule } from './world';

// Le moteur physique dans la scène (chargé à part, PhysicsGate). Rapier par
// @react-three/rapier : <Physics> charge le WebAssembly (Suspense), crée le
// monde et le libère. Il ne fait jamais avancer le monde lui-même (paused) :
// DeskPhysics avance à pas fixes à chaque image (advance), ou d'un coup sous
// &fige (settle), et écrit les poses dans store.desk avant les objets.

export default function PhysicsLayer() {
  return (
    <Physics
      paused
      colliders={false}
      gravity={[0, -GRAVITY, 0]}
      timeStep={FIXED_STEP}
      interpolate={false}
    >
      <PhysicsDriver />
    </Physics>
  );
}

/** Pas d'un coup sous &fige pendant un glisser : le corps suit le pointeur. */
const FROZEN_DRAG_STEPS = 4;

function PhysicsDriver() {
  const { rapier, world } = useRapier();
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const replays = useSceneStore((state) => state.replays);
  const physicsRef = useRef<DeskPhysics | null>(null);

  useEffect(() => {
    const scene = store.getState();
    const physics = new DeskPhysics(rapier as unknown as RapierModule, world, scene.frame.portrait);
    physicsRef.current = physics;
    const hub = gestureHub(store);
    hub.physics = physics;
    scene.setPhysics('ready');
    return () => {
      if (hub.physics === physics) hub.physics = null;
      physicsRef.current = null;
      try {
        physics.dispose();
      } catch {
        // Le monde est déjà libéré (démontage de <Physics>).
      }
    };
  }, [rapier, world, store]);

  // Rejouer : tout le monde rentre (le store a déjà remis store.desk).
  useEffect(() => {
    physicsRef.current?.resetAll();
  }, [replays]);

  useFrame(() => {
    const physics = physicsRef.current;
    if (!physics) return;
    const scene = store.getState();
    const { desk, frame, settings, presented } = scene;
    const hub = gestureHub(store);

    // Changement de format : le plateau change, tout rentre (bureau rangé).
    if (physics.portrait !== frame.portrait) {
      physics.setFormat(frame.portrait);
      scene.commitPlaces();
    }
    // L'objet présenté (ou qui revient) sort du monde.
    physics.syncPresence(
      desk,
      (id) => isItemId(id) && (presented === id || (hub.progress.get(id) ?? 0) > 0.02),
    );

    // Sous &fige, le monde n'avance que par les gestes : pendant un glisser,
    // quelques pas par image ; sinon, tout se pose d'un coup.
    const events = settings.frozen
      ? physics.grabbed !== null
        ? physics.stepMany(desk, FROZEN_DRAG_STEPS)
        : physics.anyAwake()
          ? physics.settle(desk)
          : null
      : physics.advance(frame.dt, desk);
    if (!events) return;
    for (const strength of events.thuds) scene.sound.play('thud', strength);
    if (events.settled && scene.dragging === null) {
      scene.commitPlaces();
      get().gl.domElement.dataset.penetration = physics.maxPenetration().toFixed(3);
    }
  }, PHYSICS_PRIORITY);

  return null;
}
