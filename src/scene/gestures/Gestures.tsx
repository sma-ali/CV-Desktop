'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { BODY_IDS, isItemId, type BodyId } from '../core/ids';
import type { SceneState } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { DRAG } from './drag';
import { gestureHub } from './hub';
import { GESTURES_AFTER } from './pointer';
import { GESTURES_PRIORITY } from './priorities';

// Les gestes du visiteur sur le plateau : glisser un corps (BODY_IDS) à la
// souris ou au doigt, avec collisions entre rectangles orientés (objets,
// décor, bords), rebond au lâcher, et ?glisse= pour les tests et captures.
//
// Le chemin d'un appui :
// 1. pointerdown sur le canvas : l'appui commence (hub.down) ; l'objet sous
//    le pointeur s'y désigne s'il glisse (claimBody, dans son onPointerDown) ;
// 2. pointermove : au-delà de DRAG.threshold pixels sur un corps, le glisser
//    commence (capture du pointeur, startDrag) ; le corps vise ensuite le
//    point du plateau (plan y = 0) sous le pointeur, au décalage de prise près ;
// 3. pointerup : le corps est lâché (endDrag). Un appui qui a parcouru le
//    seuil ne fait pas de clic : le clic qui suit est avalé avant React
//    Three Fiber. En deçà, c'est un clic (présenter, retourner, reposer).
//
// Chaque image, avant les objets, ce composant fait avancer le glisser et le
// solveur, et écrit store.desk ; les objets et le décor s'y posent.

/** Après une action du visiteur, la visite reprend au bout d'un moment : un long glisser la tient coupée. */
const KEEP_TOUR_OFF = 1;
/** ?glisse sans horloge gelée : le corps est lâché arrivé, bloqué, ou au bout de ce temps (s). */
const PLAYBACK = { close: 0.01, stuck: 0.4, timeout: 3 };

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

/** Les corps posés sur le plateau : ni présentés, ni en train d'y revenir. */
function activeBodies(scene: SceneState, progress: ReadonlyMap<string, number>): BodyId[] {
  return BODY_IDS.filter(
    (id) => !isItemId(id) || (scene.presented !== id && (progress.get(id) ?? 0) <= 0.02),
  );
}

export function Gestures() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const replays = useSceneStore((state) => state.replays);
  const playback = useRef({ done: false, startedAt: 0, lastMoveAt: 0 });
  const lastMark = useRef(-Infinity);

  // Rejouer : les corps sont remis en place par le store ; le glisser en
  // cours et les rebonds s'arrêtent.
  useEffect(() => {
    const { desk } = store.getState();
    const hub = gestureHub(store);
    hub.sim.cancel(desk);
    hub.sim.settle(desk);
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
      const press = hub.press;
      if (!press) return;
      const grab = planeUnder(get().camera, canvas, press.x, press.y);
      if (!grab) return;
      hub.sim.begin(scene.desk, body, grab.x, grab.z);
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

    const endDrag = (bounce: boolean) => {
      const scene = store.getState();
      hub.sim.release(scene.desk, !bounce || scene.settings.reducedMotion);
      scene.endDrag();
      canvas.style.cursor = '';
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      follow(event);
      hub.down(
        event.pointerId,
        event.pointerType,
        event.clientX,
        event.clientY,
        hub.sim.session !== null,
      );
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
      if (!hub.sim.session && press.body && press.travel > DRAG.threshold) {
        startDrag(event, press.body);
      }
    };

    const onUp = (event: PointerEvent) => {
      const press = hub.press;
      if (!press || press.pointerId !== event.pointerId) return;
      hub.press = null;
      if (hub.sim.session) {
        endDrag(true);
        hub.swallowClick = true;
      } else if (press.travel >= DRAG.threshold) {
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
      if (hub.sim.session) endDrag(false);
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
    const dt = frame.dt;
    const reduced = settings.reducedMotion;
    const hub = gestureHub(store);
    const sim = hub.sim;

    // Le pointeur que l'objet tenu suit, lissé (immobile en mouvement réduit).
    const pointer = hub.pointer;
    const k = reduced ? 1 : 1 - Math.pow(0.004, dt);
    pointer.x += ((reduced ? 0 : pointer.targetX) - pointer.x) * k;
    pointer.y += ((reduced ? 0 : pointer.targetY) - pointer.y) * k;

    const active = activeBodies(scene, hub.progress);

    // ?glisse= : un glisser joué d'office, lâché à l'arrivée. Sous &fige (ou
    // en mouvement réduit), il se pose aussitôt dans son état final.
    const request = settings.initialDrag;
    const run = playback.current;
    if (request && !run.done && scene.initialized && !sim.session) {
      if (active.includes(request.item)) {
        sim.begin(desk, request.item, desk[request.item].x, desk[request.item].z);
        sim.aimCenter(request.x, request.z);
        scene.startDrag(request.item);
        run.startedAt = frame.t;
        run.lastMoveAt = performance.now() / 1000;
        if (settings.frozen || reduced) {
          sim.step(desk, { dt, active, reduced: true, instant: true });
          sim.release(desk, true);
          sim.settle(desk);
          scene.endDrag();
        }
      }
      run.done = true;
    }

    const session = sim.session;
    if (session) {
      if (!active.includes(session.id)) {
        // Le corps a quitté le plateau (présenté par une puce) : le glisser s'arrête.
        sim.cancel(desk);
        scene.endDrag();
      } else if (hub.press) {
        const point = planeUnder(three.camera, three.gl.domElement, hub.client.x, hub.client.y);
        if (point) sim.aim(point.x, point.z);
        three.gl.domElement.style.cursor = 'grabbing';
      }
      // La visite reste coupée tant que le visiteur tient un corps.
      if (frame.t - lastMark.current > KEEP_TOUR_OFF) {
        lastMark.current = frame.t;
        scene.markUser();
      }
    }

    const beforeX = session ? desk[session.id].x : 0;
    const beforeZ = session ? desk[session.id].z : 0;
    const events = sim.step(desk, { dt, active, reduced, instant: settings.frozen });
    for (const strength of events.thuds) scene.sound.play('thud', strength);

    // Fin d'un ?glisse animé : arrivé, bloqué, ou trop long.
    if (session && !hub.press && sim.session === session && request?.item === session.id) {
      const body = desk[session.id];
      const now = performance.now() / 1000;
      if (Math.hypot(body.x - beforeX, body.z - beforeZ) > 1e-4) run.lastMoveAt = now;
      const close = Math.hypot(session.targetX - body.x, session.targetZ - body.z) < PLAYBACK.close;
      if (
        close ||
        now - run.lastMoveAt > PLAYBACK.stuck ||
        frame.t - run.startedAt > PLAYBACK.timeout
      ) {
        sim.release(desk, reduced);
        scene.endDrag();
      }
    }

    if (events.settled && store.getState().dragging === null) store.getState().commitPlaces();
  }, GESTURES_PRIORITY);

  return null;
}
