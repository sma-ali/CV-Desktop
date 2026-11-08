'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { deskBounds } from '../core/constants';
import type { ItemId } from '../core/ids';
import type { SceneStore } from '../core/store';
import { useSceneStoreApi } from '../core/store-context';
import { pinchFactor, wheelFactor, zoomDesk, zoomHeld } from './zoomLevels';
import { gestureHub } from './hub';
import { GESTURES_PRIORITY } from './priorities';

// Le zoom du visiteur : la molette (ou le pincement d'un pavé tactile, vu
// comme une molette avec Ctrl) et le pincement à deux doigts. Rien de tenu :
// la caméra se rapproche du point visé du bureau. Un objet tenu, ou l'écran
// en gros plan : l'objet se rapproche. Sur le portable tenu, la molette fait
// défiler son écran (Laptop.tsx) ; Ctrl + molette et le pincement zooment.
// Le réglage vit dans gestureHub(store).zoom, lu par la caméra et les objets.

/** Une ligne de molette (deltaMode 1) vaut environ autant de pixels. */
const LINE_HEIGHT = 16;

const plane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();

/** Le point du plateau sous un point de la fenêtre, ou null. */
function deskPointUnder(camera: Camera, canvas: HTMLElement, x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const point = raycaster.ray.intersectPlane(plane, hit);
  return point ? { x: point.x, z: point.z } : null;
}

/** Applique un facteur de zoom à ce que regarde le visiteur. */
function applyZoom(
  store: SceneStore,
  camera: Camera,
  canvas: HTMLElement,
  factor: number,
  x: number,
  y: number,
): void {
  const scene = store.getState();
  const zoom = gestureHub(store).zoom;
  if (scene.presented !== null) {
    zoom.held = zoomHeld(zoom.held, factor);
    return;
  }
  const point = deskPointUnder(camera, canvas, x, y);
  zoom.desk = zoomDesk(zoom.desk, factor, point, zoom.center, deskBounds(scene.frame.portrait));
}

export function Zoom() {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const lastPresented = useRef<ItemId | null>(null);

  useEffect(() => {
    const canvas = get().gl.domElement;
    const hub = gestureHub(store);
    // Les doigts posés sur le canvas, et l'écart des deux premiers.
    const touches = new Map<number, { x: number; y: number }>();
    let spread = 0;

    /** Le zoom n'agit qu'une fois la caméra arrivée. */
    const ready = () => {
      const { frame, settings } = store.getState();
      return settings.reducedMotion || frame.camera >= 0.999;
    };

    const onWheel = (event: WheelEvent) => {
      const scene = store.getState();
      // Sur le portable tenu, la molette seule fait défiler son écran.
      if (scene.presented === 'laptop' && !event.ctrlKey) return;
      // Ni la page ni le navigateur (Ctrl + molette) ne zooment à sa place.
      event.preventDefault();
      if (!ready()) return;
      const delta = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT : event.deltaY;
      applyZoom(store, get().camera, canvas, wheelFactor(delta), event.clientX, event.clientY);
    };

    const distance = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        spread = distance();
        // Deux doigts : ce n'est plus un glisser ni un clic.
        if (hub.dragging) {
          hub.physics?.release(false);
          store.getState().endDrag();
        }
        hub.press = null;
        hub.swallowClick = true;
      }
    };

    const onMove = (event: PointerEvent) => {
      const touch = touches.get(event.pointerId);
      if (!touch) return;
      touch.x = event.clientX;
      touch.y = event.clientY;
      if (touches.size !== 2 || !ready()) return;
      const current = distance();
      const factor = pinchFactor(spread, current);
      spread = current;
      if (factor === 1) return;
      const [a, b] = [...touches.values()];
      if (!a || !b) return;
      applyZoom(store, get().camera, canvas, factor, (a.x + b.x) / 2, (a.y + b.y) / 2);
    };

    const onUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      spread = touches.size === 2 ? distance() : 0;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [get, store]);

  // Un nouvel objet tenu repart à sa taille prévue.
  useFrame(() => {
    const { presented } = store.getState();
    if (presented !== lastPresented.current) {
      lastPresented.current = presented;
      gestureHub(store).zoom.held = 1;
    }
  }, GESTURES_PRIORITY);

  return null;
}
