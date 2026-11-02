'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { ItemId } from '../core/ids';
import type { SceneStore } from '../core/store';
import { useSceneStoreApi } from '../core/store-context';
import { DRAG_THRESHOLD, gestureHub } from '../gestures/hub';
import { ROTATION_PRIORITY } from '../gestures/priorities';
import { rotationInput } from './control';
import {
  cameraToWorld,
  clampSpeed,
  dragRotation,
  easeShare,
  heldBall,
  keyRotation,
  parseTurn,
  readSpin,
  rotationAngle,
  SPIN,
  stepInertia,
  takePending,
  toRotationVector,
  turnRotation,
  writeSpin,
  type Ball,
} from './trackball';

// Partie A de l'étape 6 : la rotation libre de l'objet présenté. Un appui
// sur l'objet tenu (claimHeld, dans usePresentation, qui pose press.held)
// qui dépasse DRAG_THRESHOLD le fait tourner comme une boule sous le doigt
// (trackball, sur les trois axes) ; au lâcher, il garde un peu d'élan, puis
// l'orientation qu'on lui a donnée. En deçà du seuil, c'est un clic : il se
// retourne comme avant (Gestures avale le clic d'un appui qui a bougé). Les
// flèches du clavier (Sheet, par rotationInput) le tournent d'un pas ;
// « Remettre droit » (requestUpright) le ramène à sa pose de présentation.
// Le tout s'écrit dans store.heldSpin (repère du monde), que usePresentation
// applique par-dessus la pose tenue, et dans store.heldTurned (le bouton
// « Remettre droit », data-turned sur #hud). data-spin sur le canvas : l'angle
// de la rotation libre, pour les tests.
//
// Le glisser se suit aux événements du pointeur, pas à chaque image : sur
// une machine lente (deux images par seconde), un geste vif entre deux
// images compte quand même. L'inertie, les pas du clavier et le retour se
// jouent à chaque image, à ROTATION_PRIORITY (avant les objets).
//
// Mouvement réduit : ni inertie ni animation, les pas et le retour sont
// immédiats. Horloge gelée (&fige) : pareil, pour des captures et des tests
// stables. L'écran ne tourne pas : un clic y quitte le gros plan.

/** Pendant une rotation, la visite reste coupée (markUser au plus une fois par seconde). */
const KEEP_TOUR_OFF = 1;
/** Lâché après une pause plus longue que celle-ci (secondes) : pas d'élan. */
const RELEASE_PAUSE = 0.08;

interface RotationState {
  item: ItemId | null;
  /** La rotation au pointeur en cours (identifiant du pointeur), ou null. */
  dragging: number | null;
  lastX: number;
  lastY: number;
  /** Instant du dernier mouvement (secondes, horloge des événements). */
  lastTime: number;
  lastMark: number;
  /** Vitesse angulaire, vecteur rotation par seconde (repère du monde). */
  velocity: Vector3;
  /** Pas du clavier restant à jouer (repère du monde). */
  pending: Quaternion;
  /** « Remettre droit » en cours. */
  upright: boolean;
  /** Dernier uprightRequests vu. */
  uprightSeen: number;
  /** ?tourne (lu une fois), et déjà appliqué. */
  turn: { x: number; y: number } | null;
  turnDone: boolean;
}

const spin = new Quaternion();
const delta = new Quaternion();
const world = new Quaternion();
const instant = new Vector3();
const ball: Ball = { cx: 0, cy: 0, r: 1 };
const IDENTITY = new Quaternion();

/** L'objet présenté peut-il tourner ? (pas l'écran, ni rien avant l'initialisation) */
function canSpin(store: SceneStore): boolean {
  const { presented, initialized } = store.getState();
  return initialized && presented !== null && presented !== 'monitor';
}

/** L'angle de la rotation libre, sur le canvas (data-spin), pour les tests. */
function markSpin(canvas: HTMLCanvasElement, angle: number): void {
  const value = angle.toFixed(3);
  if (canvas.dataset.spin !== value) canvas.dataset.spin = value;
}

export function HeldRotation() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const state = useRef<RotationState>({
    item: null,
    dragging: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    lastMark: -Infinity,
    velocity: new Vector3(),
    pending: new Quaternion(),
    upright: false,
    uprightSeen: 0,
    turn: null,
    turnDone: false,
  });

  useEffect(() => {
    state.current.turn = parseTurn(window.location.search);
  }, []);

  // Le glisser sur l'objet tenu. Ces écouteurs s'ajoutent après ceux de
  // Gestures (monté avant dans Scene.tsx) : press.travel est déjà à jour.
  useEffect(() => {
    const canvas = get().gl.domElement;
    const hub = gestureHub(store);
    const run = state.current;

    const onMove = (event: PointerEvent) => {
      const press = hub.press;
      if (!press || press.pointerId !== event.pointerId || !press.held || hub.dragging) return;
      const scene = store.getState();
      if (!canSpin(store) || run.item !== scene.presented) return;
      const time = event.timeStamp / 1000;
      if (run.dragging !== press.pointerId) {
        if (press.travel <= DRAG_THRESHOLD) return;
        // La rotation commence au point d'appui : le seuil fait partie du geste.
        run.dragging = press.pointerId;
        run.lastX = press.x;
        run.lastY = press.y;
        run.lastTime = time;
        run.velocity.set(0, 0, 0);
        run.upright = false;
        run.pending.identity();
        try {
          canvas.setPointerCapture(press.pointerId);
        } catch {
          // Le pointeur a déjà disparu : la rotation finira au relâchement.
        }
        // L'objet de la visite passe au visiteur au lieu d'être reposé.
        if (scene.presentedBy === 'auto') store.setState({ presentedBy: 'click' });
      }
      const t = scene.clock.t;
      if (t - run.lastMark > KEEP_TOUR_OFF || run.lastMark > t) {
        run.lastMark = t;
        store.getState().markUser();
      }
      canvas.style.cursor = 'grabbing';

      const { clientX: x, clientY: y } = event;
      if (x === run.lastX && y === run.lastY) return;
      heldBall(canvas.getBoundingClientRect(), scene.frame.portrait, ball);
      dragRotation(ball, run.lastX, run.lastY, x, y, delta);
      cameraToWorld(delta, get().camera.quaternion, world);
      const heldSpin = store.getState().heldSpin;
      writeSpin(readSpin(heldSpin, spin).premultiply(world), heldSpin);
      const dt = time - run.lastTime;
      if (dt > 1e-3) {
        // Vitesse lissée sur les derniers mouvements.
        const keep = Math.pow(SPIN.velocityKeep, dt * 60);
        toRotationVector(world, instant).divideScalar(dt);
        run.velocity.multiplyScalar(keep).addScaledVector(instant, 1 - keep);
      }
      run.lastX = x;
      run.lastY = y;
      run.lastTime = time;
    };

    const onEnd = (event: PointerEvent) => {
      if (run.dragging !== event.pointerId) return;
      run.dragging = null;
      canvas.style.cursor = '';
      const { settings, clock } = store.getState();
      // Lâché après une pause, interrompu, en mouvement réduit ou horloge
      // gelée : pas d'élan.
      const paused = event.timeStamp / 1000 - run.lastTime > RELEASE_PAUSE;
      if (paused || event.type === 'pointercancel' || settings.reducedMotion || clock.frozen) {
        run.velocity.set(0, 0, 0);
      } else {
        clampSpeed(run.velocity);
      }
    };

    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [get, store]);

  useFrame((three) => {
    const scene = store.getState();
    const run = state.current;
    const input = rotationInput(store);
    const canvas = three.gl.domElement;

    // Un autre objet (ou aucun) : tout repart de zéro. Le socle remet
    // heldSpin à l'identité dans present(), putBack(), markUser() et replay().
    if (scene.presented !== run.item) {
      run.item = scene.presented;
      run.velocity.set(0, 0, 0);
      run.pending.identity();
      run.upright = false;
      run.uprightSeen = scene.uprightRequests;
      if (run.dragging !== null) canvas.style.cursor = '';
      run.dragging = null;
    }
    if (!canSpin(store)) {
      input.take();
      run.uprightSeen = scene.uprightRequests;
      markSpin(canvas, 0);
      return;
    }

    const dt = scene.frame.dt;
    const immediate = scene.settings.reducedMotion || scene.clock.frozen;
    const camera = three.camera.quaternion;
    readSpin(scene.heldSpin, spin);

    // ?tourne=x,y : une orientation donnée d'office à l'objet de ?prendre=
    // (captures, tests).
    if (run.turn && !run.turnDone && scene.presentedBy === 'test') {
      run.turnDone = true;
      spin.premultiply(cameraToWorld(turnRotation(run.turn, delta), camera, world));
    }

    // L'inertie, une fois lâché.
    if (run.dragging === null && run.velocity.lengthSq() > 0) {
      spin.premultiply(stepInertia(run.velocity, dt, delta));
    }

    // Les flèches du clavier.
    const steps = input.take();
    if (steps) {
      run.upright = false;
      run.velocity.set(0, 0, 0);
      cameraToWorld(keyRotation(steps.yaw, steps.pitch, delta), camera, world);
      run.pending.premultiply(world);
    }
    if (rotationAngle(run.pending) > 0) {
      spin.premultiply(takePending(run.pending, easeShare(dt, immediate), delta));
    }

    // « Remettre droit ».
    if (scene.uprightRequests !== run.uprightSeen) {
      run.uprightSeen = scene.uprightRequests;
      run.upright = true;
      run.velocity.set(0, 0, 0);
      run.pending.identity();
    }
    if (run.upright) {
      if (immediate) spin.identity();
      else spin.slerp(IDENTITY, easeShare(dt, false));
      if (rotationAngle(spin) < 2e-3) {
        spin.identity();
        run.upright = false;
      }
    }

    writeSpin(spin, scene.heldSpin);
    const angle = rotationAngle(scene.heldSpin);
    scene.setHeldTurned(angle > SPIN.turned);
    markSpin(canvas, angle);
  }, ROTATION_PRIORITY);

  return null;
}
