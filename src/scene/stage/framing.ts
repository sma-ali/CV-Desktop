import { PerspectiveCamera, Vector3 } from 'three';
import { ease, lerp, seg, smooth } from '../core/arrival';
import {
  ARRIVAL,
  HELD,
  MONITOR,
  PORTRAIT_MAX_ASPECT,
  REST,
  REST_FIT,
  SCREEN_FOCUS,
  START_L,
  START_P,
  type Vec3,
  type View,
} from '../core/constants';

// Le cadrage de la caméra, en fonctions pures (testées) : la vue de repos
// calculée d'après le format de la fenêtre (layout() du prototype), la montée
// de l'arrivée, le léger mouvement qui suit le pointeur, et le gros plan sur
// l'écran.

/** Position de la caméra pour une vue (camAt du prototype). */
export function cameraPosition(
  [tx, ty, tz]: Vec3,
  elev: number,
  az: number,
  dist: number,
  out = new Vector3(),
): Vector3 {
  return out.set(
    tx + Math.sin(az) * Math.cos(elev) * dist,
    ty + Math.sin(elev) * dist,
    tz + Math.cos(az) * Math.cos(elev) * dist,
  );
}

export const isPortrait = (aspect: number) => aspect < PORTRAIT_MAX_ASPECT;

/** Bornes, en coordonnées normalisées, des points à cadrer vus d'une caméra. */
export function projectedBounds(points: readonly Vec3[], camera: PerspectiveCamera) {
  const probe = new Vector3();
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const point of points) {
    probe.set(...point).project(camera);
    x0 = Math.min(x0, probe.x);
    x1 = Math.max(x1, probe.x);
    y0 = Math.min(y0, probe.y);
    y1 = Math.max(y1, probe.y);
  }
  return { x0, x1, y0, y1 };
}

/** Une caméra de calcul placée sur une vue. */
export function cameraForView(view: View, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(view.fov, aspect, 0.1, 90);
  cameraPosition(view.target, view.elev, view.az, view.dist, camera.position);
  camera.lookAt(...view.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

/**
 * La vue de repos pour un rapport largeur / hauteur : la plus petite distance
 * qui fait tenir les points REST_FIT dans leurs limites, en recentrant le
 * point visé (layout() du prototype). Appelée au redimensionnement seulement.
 */
export function fitRestView(aspect: number): View {
  const portrait = isPortrait(aspect);
  const rest = portrait ? REST.portrait : REST.landscape;
  const { points, limits } = portrait ? REST_FIT.portrait : REST_FIT.landscape;
  const camera = new PerspectiveCamera(rest.fov, aspect, 0.1, 90);
  camera.updateProjectionMatrix();
  const target = new Vector3();

  const fitAt = (dist: number): boolean => {
    const [rx, ry, rz] = rest.target;
    target.set(rx, ry, rz);
    for (let iteration = 0; iteration < 6; iteration++) {
      cameraPosition([target.x, target.y, target.z], rest.elev, 0, dist, camera.position);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const { x0, x1, y0, y1 } = projectedBounds(points, camera);
      if (iteration === 5) {
        return x0 >= -limits.x && x1 <= limits.x && y0 >= limits.yBottom && y1 <= limits.yTop;
      }
      const k = dist * Math.tan((camera.fov * Math.PI) / 360);
      target.z -=
        ((((y0 + y1) / 2 - (limits.yBottom + limits.yTop) / 2) * k) / Math.sin(rest.elev)) * 0.9;
      target.x += ((x0 + x1) / 2) * k * camera.aspect * 0.9;
    }
    return false;
  };

  let lo = 4;
  let hi = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fitAt(mid)) hi = mid;
    else lo = mid;
  }
  fitAt(hi);
  return {
    target: [target.x, target.y, target.z],
    elev: rest.elev,
    az: 0,
    dist: hi,
    fov: rest.fov,
  };
}

/** La vue de départ de l'arrivée, au ras du bureau. */
export const startView = (portrait: boolean): View => (portrait ? START_P : START_L);

/** Une pose de caméra : position, point visé, champ vertical. Réutilisée d'une image à l'autre. */
export interface CameraPose {
  position: Vector3;
  target: Vector3;
  fov: number;
}

export const createPose = (): CameraPose => ({
  position: new Vector3(),
  target: new Vector3(),
  fov: REST.landscape.fov,
});

export interface ArrivalInput {
  /** T de l'arrivée (secondes). */
  t: number;
  /** Avancement de la montée (frame.camera, 0 à 1). */
  progress: number;
  start: View;
  rest: View;
  /** Pointeur en coordonnées normalisées (-1 à 1). */
  pointerX: number;
  pointerY: number;
  reduced: boolean;
}

/** Le mouvement de caméra qui suit le pointeur, qui s'installe en fin d'arrivée (0 à 1). */
export function parallaxLevel(t: number, reduced: boolean): number {
  return reduced ? 0 : smooth(seg(t, ARRIVAL.parallaxStart, ARRIVAL.parallaxEnd));
}

/**
 * La pose de la caméra pendant et après l'arrivée : de START vers la vue de
 * repos, avec un léger recul au tout début, puis un mouvement lent qui suit
 * le pointeur. Écrit dans out, sans rien créer.
 */
export function arrivalPose(input: ArrivalInput, out: CameraPose): CameraPose {
  const { t, start, rest, pointerX, pointerY, reduced } = input;
  const k = reduced ? 1 : input.progress;
  const par = parallaxLevel(t, reduced);
  const elev =
    lerp(start.elev, rest.elev, k) + (pointerY * 0.025 + Math.sin(t * 0.21) * 0.006) * par;
  const az = lerp(start.az, rest.az, k) + (pointerX * -0.035 + Math.sin(t * 0.17) * 0.01) * par;
  const pull = !reduced && t < ARRIVAL.cameraStart ? (ARRIVAL.cameraStart - t) * 0.1 : 0;
  const dist = lerp(start.dist, rest.dist, k) - pull;
  const [sx, sy, sz] = start.target;
  const [rx, ry, rz] = rest.target;
  out.target.set(lerp(sx, rx, k), lerp(sy, ry, k), lerp(sz, rz, k));
  const cosElev = Math.cos(elev);
  out.position.set(
    out.target.x + Math.sin(az) * cosElev * dist,
    out.target.y + Math.sin(elev) * dist,
    out.target.z + Math.cos(az) * cosElev * dist,
  );
  out.fov = lerp(start.fov, rest.fov, k);
  return out;
}

/** Le centre de la dalle de l'écran, et sa normale (vers le visiteur). */
const SCREEN_CENTER: Vec3 = [MONITOR.position[0], MONITOR.tiltY, MONITOR.position[2]];
const SCREEN_NORMAL: Vec3 = [0, Math.sin(-MONITOR.tiltX), Math.cos(-MONITOR.tiltX)];

/** Le gros plan sur l'écran (presented = 'monitor') : la caméra se place face à la dalle. */
export function screenFocusPose(portrait: boolean, out: CameraPose = createPose()): CameraPose {
  const { offset, dist } = portrait ? SCREEN_FOCUS.portrait : SCREEN_FOCUS.landscape;
  const [cx, cy, cz] = SCREEN_CENTER;
  const [nx, ny, nz] = SCREEN_NORMAL;
  const [ox, oy, oz] = offset;
  out.target.set(cx + ox, cy + oy, cz + oz);
  out.position.set(cx + nx * dist + ox, cy + ny * dist + oy + 0.25, cz + nz * dist + oz);
  return out;
}

/** Mélange une pose vers une autre (k de 0 à 1, adouci), sans toucher au champ. */
export function blendPose(out: CameraPose, to: CameraPose, k: number): CameraPose {
  const e = ease(k);
  out.position.lerp(to.position, e);
  out.target.lerp(to.target, e);
  return out;
}

/**
 * Où regarder pour l'assombrissement autour de ce qu'on présente, en
 * coordonnées d'écran (0 à 1, origine en bas à gauche) : l'objet tenu
 * (HELD), ou la dalle quand la caméra s'approche de l'écran.
 */
export function focusPoint(screen: boolean, portrait: boolean): readonly [number, number] {
  if (screen) return portrait ? FOCUS.screenPortrait : FOCUS.screenLandscape;
  return portrait ? FOCUS.heldPortrait : FOCUS.heldLandscape;
}

// Lu à chaque image : des constantes, pour ne rien allouer.
const FOCUS = {
  screenPortrait: [0.5, 0.62],
  screenLandscape: [0.32, 0.52],
  heldPortrait: [HELD.portrait.x * 0.5 + 0.5, HELD.portrait.y * 0.5 + 0.5],
  heldLandscape: [HELD.landscape.x * 0.5 + 0.5, HELD.landscape.y * 0.5 + 0.5],
} as const satisfies Record<string, readonly [number, number]>;
