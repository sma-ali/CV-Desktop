import type { ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import { ARRIVAL } from '../core/constants';
import type { BodyId } from '../core/ids';
import type { SceneStore } from '../core/store';
import { gestureHub } from './hub';

/** Avant cet instant de l'arrivée, ni clic ni glisser : on ne prend pas un objet qui tombe encore. */
export const GESTURES_AFTER = ARRIVAL.lampOn + 0.25;

/** L'objet qui porte le gestionnaire est-il le plus proche sous le pointeur ? */
export function isNearest(event: ThreeEvent<PointerEvent>): boolean {
  const first = event.intersections[0]?.object;
  for (let node: Object3D | null = first ?? null; node; node = node.parent) {
    if (node === event.eventObject) return true;
  }
  return false;
}

/**
 * onPointerDown d'un corps qui glisse : l'appui le désigne au glisser, s'il
 * est le premier objet sous le pointeur (pas une lampe ou un objet tenu
 * devant lui). Le glisser lui-même ne commence qu'au-delà du seuil (Gestures).
 */
export function claimBody(store: SceneStore, event: ThreeEvent<PointerEvent>, body: BodyId): void {
  event.stopPropagation();
  const scene = store.getState();
  if (!scene.settings.reducedMotion && scene.frame.t < GESTURES_AFTER) return;
  if (!isNearest(event)) return;
  // Le moteur physique se charge après l'arrivée ; un appui sur un corps le
  // demande plus tôt (ce glisser-là reste un clic s'il n'est pas prêt).
  if (scene.physics === 'off') scene.setPhysics('loading');
  const { pointerId, pointerType, clientX, clientY } = event.nativeEvent;
  gestureHub(store).claim(pointerId, pointerType, clientX, clientY, body);
}

/**
 * onPointerDown de l'objet présenté : l'appui lui est réservé (rotation
 * libre, partie A). Sans arrêter la propagation : le clic qui suit, s'il en
 * est un, le retourne comme avant.
 */
export function claimHeld(store: SceneStore, event: ThreeEvent<PointerEvent>): void {
  if (!isNearest(event)) return;
  const { pointerId, pointerType, clientX, clientY } = event.nativeEvent;
  gestureHub(store).claimHeld(pointerId, pointerType, clientX, clientY);
}
