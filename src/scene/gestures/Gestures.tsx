'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { DeskBodies } from '../core/bodies';
import type { BodyId } from '../core/ids';
import type { PhysicsControl } from '../physics/world';
import type { SceneStore } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { DRAG_THRESHOLD, gestureHub } from './hub';
import { GESTURES_AFTER } from './pointer';
import { GESTURES_PRIORITY } from './priorities';

// Les gestes du visiteur sur le plateau (étape 6 : sur le moteur physique) :
// glisser n'importe quel corps (BODY_IDS) à la souris ou au doigt ; il suit
// le pointeur au-dessus de ce qu'il survole, pousse ce qu'il heurte, et
// part avec l'élan du geste au lâcher (sauf en mouvement réduit). ?glisse=
// joue un glisser pour les tests et les captures.
//
// Le chemin d'un appui :
// 1. pointerdown sur le canvas : l'appui commence (hub.down) ; l'objet sous
//    le pointeur s'y désigne s'il glisse (claimBody, dans son onPointerDown),
//    ou s'il est l'objet présenté (claimHeld : la partie A le fait tourner) ;
// 2. pointermove : au-delà de DRAG_THRESHOLD pixels sur un corps, le glisser
//    commence (capture du pointeur, physics.grab, startDrag) ; le corps vise
//    ensuite le point du plateau (plan y = 0) sous le pointeur ;
// 3. pointerup : le corps est lâché (physics.release, endDrag). Un appui qui
//    a parcouru le seuil ne fait pas de clic : le clic qui suit est avalé
//    avant React Three Fiber. En deçà, c'est un clic (présenter, retourner,
//    reposer).
//
// Avant que le moteur ne soit prêt (il se charge après l'arrivée, ou au
// premier appui sur un corps), un appui sur un corps reste un clic.

/** Après une action du visiteur, la visite reprend au bout d'un moment : un long glisser la tient coupée. */
const KEEP_TOUR_OFF = 1;
/** ?glisse : le corps est lâché arrivé, bloqué depuis 0.4 s, ou au bout de 3 s (sous &fige : playFrozen). */
const PLAYBACK = { close: 0.02, stuck: 0.4, timeout: 3 };

const plane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();

/** Le point du plateau (plan y = 0) sous un point de la fenêtre, ou null. */
function planeUnder(camera: Camera, canvas: HTMLElement, x: number, y: number): Vector3 | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(plane, hit);
}

/** Lâche le corps glissé : avec son élan, sauf en mouvement réduit ou sur demande. */
/**
 * Sous &fige, ?glisse se joue d'un coup, pas à pas, sans attendre les images
 * (aussi lentes soient-elles) : jusqu'au but, à un blocage de
 * FROZEN_PLAY.still pas, ou au bout de FROZEN_PLAY.steps pas. Déterministe.
 */
const FROZEN_PLAY = { steps: 300, still: 30 };

function playFrozen(
  physics: PhysicsControl,
  desk: DeskBodies,
  request: { item: BodyId; x: number; z: number },
): void {
  const body = desk[request.item];
  let still = 0;
  for (let i = 0; i < FROZEN_PLAY.steps; i++) {
    const { x, z } = body;
    physics.stepMany(desk, 1);
    if (Math.hypot(request.x - body.x, request.z - body.z) < PLAYBACK.close) return;
    still = Math.hypot(body.x - x, body.z - z) < 1e-4 ? still + 1 : 0;
    if (still > FROZEN_PLAY.still) return;
  }
}

function letGo(store: SceneStore, withThrow: boolean): void {
  const scene = store.getState();
  gestureHub(store).physics?.release(withThrow && !scene.settings.reducedMotion);
  scene.endDrag();
}

export function Gestures() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const replays = useSceneStore((state) => state.replays);
  const playback = useRef({
    done: false,
    startedAt: 0,
    lastMoveAt: 0,
    x: 0,
    z: 0,
  });
  const lastMark = useRef(-Infinity);

  // Rejouer : le glisser en cours s'arrête (le moteur remet les corps en place).
  useEffect(() => {
    const hub = gestureHub(store);
    hub.physics?.release(false);
    hub.reset();
  }, [replays, store]);

  useEffect(() => {
    const canvas = get().gl.domElement;
    const hub = gestureHub(store);

    const follow = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (event.pointerType === 'touch' || rect.width === 0) {
        hub.pointer.targetX = 0;
        hub.pointer.targetY = 0;
        return;
      }
      hub.pointer.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      hub.pointer.targetY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const startDrag = (event: PointerEvent, body: BodyId) => {
      const scene = store.getState();
      if (!scene.settings.reducedMotion && scene.frame.t < GESTURES_AFTER) return;
      const physics = hub.physics;
      const press = hub.press;
      if (!physics || !press) return;
      const grab = planeUnder(get().camera, canvas, press.x, press.y);
      if (!grab || !physics.grab(body, grab.x, grab.z)) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Le pointeur a déjà disparu : le glisser finira au prochain relâchement.
      }
      // Un glisser ne présente rien : ce qui était tenu retourne sur le bureau.
      scene.startDrag(body);
      if (scene.presented !== null) store.getState().putBack();
      canvas.style.cursor = 'grabbing';
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      follow(event);
      hub.down(event.pointerId, event.pointerType, event.clientX, event.clientY, hub.dragging);
    };

    const onMove = (event: PointerEvent) => {
      follow(event);
      const press = hub.press;
      if (!press || press.pointerId !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        // Relâché hors de la fenêtre sans qu'on le voie : l'appui est fini.
        onUp(event);
        return;
      }
      hub.client.x = event.clientX;
      hub.client.y = event.clientY;
      press.travel = Math.max(
        press.travel,
        Math.hypot(event.clientX - press.x, event.clientY - press.y),
      );
      if (!hub.dragging && press.body && press.travel > DRAG_THRESHOLD) {
        startDrag(event, press.body);
      }
    };

    const onUp = (event: PointerEvent) => {
      const press = hub.press;
      if (!press || press.pointerId !== event.pointerId) return;
      hub.press = null;
      if (hub.dragging) {
        letGo(store, true);
        canvas.style.cursor = '';
        hub.swallowClick = true;
      } else if (press.travel >= DRAG_THRESHOLD) {
        // Un appui qui a bougé n'est pas un clic, même sans glisser.
        hub.swallowClick = true;
      } else if (press.travel > 2 && get().internal.initialHits.length === 0) {
        // Un clic à peine bougé hors des objets : React Three Fiber ne le
        // compte comme manqué qu'en deçà de 2 pixels ; il repose quand même.
        const scene = store.getState();
        scene.markUser();
        scene.putBack();
      }
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    const onCancel = (event: PointerEvent) => {
      if (hub.press?.pointerId !== event.pointerId) return;
      hub.press = null;
      if (hub.dragging) {
        letGo(store, false);
        canvas.style.cursor = '';
      }
    };

    // Avant React Three Fiber (phase de capture, sur la fenêtre) : le clic
    // qui termine un glisser ne présente rien et ne fait pas réagir le décor.
    const onClick = (event: MouseEvent) => {
      if (!hub.swallowClick || event.target !== canvas) return;
      hub.swallowClick = false;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    // Relâché n'importe où, même hors du canvas.
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('click', onClick, true);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('click', onClick, true);
    };
  }, [get, store]);

  useFrame((three) => {
    const scene = store.getState();
    const { frame, settings, desk } = scene;
    const reduced = settings.reducedMotion;
    const hub = gestureHub(store);
    const physics = hub.physics;

    // Le pointeur que l'objet tenu suit, lissé (immobile en mouvement réduit).
    const pointer = hub.pointer;
    const k = reduced ? 1 : 1 - Math.pow(0.004, frame.dt);
    pointer.x += ((reduced ? 0 : pointer.targetX) - pointer.x) * k;
    pointer.y += ((reduced ? 0 : pointer.targetY) - pointer.y) * k;

    if (!physics) return;

    // ?glisse= : un glisser joué d'office, puis lâché sans élan.
    const request = settings.initialDrag;
    const run = playback.current;
    if (request && !run.done && scene.initialized && physics.grabbed === null) {
      const body = desk[request.item];
      if (!body.hidden && physics.grab(request.item, body.x, body.z)) {
        physics.aim(request.x, request.z);
        scene.startDrag(request.item);
        run.startedAt = frame.t;
        run.lastMoveAt = performance.now() / 1000;
        run.x = body.x;
        run.z = body.z;
        if (settings.frozen) {
          playFrozen(physics, desk, request);
          letGo(store, false);
        }
      }
      run.done = true;
    }

    const grabbed = physics.grabbed;
    if (scene.dragging !== null && grabbed === null) {
      // Le corps a quitté le monde (présenté par une puce, les flèches ou la
      // fiche) : le glisser s'arrête, et l'appui en cours n'en relancera pas
      // d'autre (le mouvement suivant reposerait l'objet présenté). Son
      // relâchement reste avalé : il a parcouru le seuil.
      scene.endDrag();
      if (hub.press) hub.press.body = null;
      three.gl.domElement.style.cursor = '';
      return;
    }
    if (grabbed === null) return;

    if (hub.press) {
      const point = planeUnder(three.camera, three.gl.domElement, hub.client.x, hub.client.y);
      if (point) physics.aim(point.x, point.z);
      three.gl.domElement.style.cursor = 'grabbing';
    } else if (request?.item === grabbed) {
      // Fin d'un ?glisse : arrivé, bloqué, ou trop long.
      const body = desk[grabbed];
      const now = performance.now() / 1000;
      if (Math.hypot(body.x - run.x, body.z - run.z) > 1e-3) {
        run.lastMoveAt = now;
        run.x = body.x;
        run.z = body.z;
      }
      const close = Math.hypot(request.x - body.x, request.z - body.z) < PLAYBACK.close;
      const late =
        frame.t - run.startedAt > PLAYBACK.timeout || now - run.lastMoveAt > PLAYBACK.stuck;
      if (close || late) letGo(store, false);
    }

    // La visite reste coupée tant que le visiteur tient un corps.
    if (hub.press && frame.t - lastMark.current > KEEP_TOUR_OFF) {
      lastMark.current = frame.t;
      scene.markUser();
    }
  }, GESTURES_PRIORITY);

  return null;
}
