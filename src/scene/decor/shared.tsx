'use client';

import { useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  IcosahedronGeometry,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Vec3 } from '../core/constants';
import type { SceneState } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { finishMaterial, mergeByFinish, type Part } from './merge';

// Outils communs aux pièces du décor : fusion des pièces fixes, clics sur
// le décor, instants de clic remis à zéro par « Rejouer ».

/** Les pièces fusionnées d'un ensemble : un maillage par fini. build doit être stable (défini hors du composant). */
export function MergedParts({
  build,
  castShadow = true,
  receiveShadow = true,
  ...props
}: Omit<ThreeElements['group'], 'children'> & {
  build: () => Part[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshes = useMemo(() => mergeByFinish(build()), [build]);
  useEffect(() => () => meshes.forEach(({ geometry }) => geometry.dispose()), [meshes]);
  return (
    <group {...props}>
      {meshes.map(({ finish, geometry }) => (
        <mesh
          key={finish}
          geometry={geometry}
          material={finishMaterial(finish)}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------
// Briques de géométrie pour les pièces (créées puis fusionnées)
// ------------------------------------------------------------------

export const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);
export const cyl = (top: number, bottom: number, height: number, segments = 8): BufferGeometry =>
  new CylinderGeometry(top, bottom, height, segments);
export const sph = (radius: number, detail = 0): BufferGeometry =>
  new IcosahedronGeometry(radius, detail);
export const torus = (radius: number, tube: number, radial = 5, tubular = 14, arc = Math.PI * 2) =>
  new TorusGeometry(radius, tube, radial, tubular, arc);

/** Tube le long de points (câble, corde, ressort). */
export function tube(points: readonly Vec3[], radius: number, segments = 40, radial = 5) {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  return new TubeGeometry(curve, segments, radius, radial, false);
}

/** Une tige d'un point à un autre (pièce prête à fusionner). */
export function rodPart(
  from: Vec3,
  to: Vec3,
  radius: number,
  color: number,
  finish: Part['finish'] = 'metal',
  segments = 7,
): Part {
  const a = new Vector3(...from);
  const direction = new Vector3(...to).sub(a);
  const length = direction.length();
  return {
    geometry: new CylinderGeometry(radius, radius, length, segments),
    color,
    finish,
    position: a.addScaledVector(direction, 0.5).toArray() as unknown as Vec3,
    quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
  };
}

/** Quaternion qui tourne l'axe +y vers une direction. */
export function alignY(direction: Vec3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(...direction).normalize(),
  );
}

// ------------------------------------------------------------------
// Clics sur le décor
// ------------------------------------------------------------------

/** On ne touche à rien pendant la première seconde de l'arrivée (noir complet). */
const INTERACT_FROM = 1.2;

/**
 * Un élément du décor qui réagit au clic : ses gestionnaires d'événements, et
 * l'instant (T de l'horloge) du dernier clic, null tant qu'on n'a pas cliqué.
 * Le clic sonne (store.sound, muet tant que le son est coupé).
 * « Rejouer » le remet à zéro. at se lit dans useFrame, jamais au rendu.
 */
export function usePressTime(): {
  at: RefObject<number | null>;
  handlers: ReturnType<typeof usePressable>;
} {
  const at = useRef<number | null>(null);
  const replays = useSceneStore((state) => state.replays);
  useEffect(() => {
    at.current = null;
  }, [replays]);
  const handlers = usePressable((t, state) => {
    at.current = t;
    // Un petit clic (muet tant que le son est coupé).
    state.sound.play('tick');
  });
  return { at, handlers };
}

/**
 * Gestionnaires d'événements d'un élément cliquable du décor : main au
 * survol, et onPress(t) au clic (un clic, pas un glissé). Un clic compte
 * comme une action du visiteur (le mode auto s'arrête).
 */
export function usePressable(onPress: (t: number, state: SceneState) => void) {
  const store = useSceneStoreApi();
  const get = useThree((state) => state.get);
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  });
  return useMemo(
    () => ({
      onClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        if (event.delta > 9) return;
        const state = store.getState();
        if (state.clock.t < INTERACT_FROM && !state.settings.reducedMotion) return;
        state.markUser();
        press.current(state.clock.t, state);
      },
      onPointerOver(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        get().gl.domElement.style.cursor = 'pointer';
      },
      onPointerOut() {
        get().gl.domElement.style.cursor = '';
      },
    }),
    [store, get],
  );
}
