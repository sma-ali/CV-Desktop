import { PerspectiveCamera, Vector3 } from 'three';
import { ease, lerp, seg, smooth } from '../core/math';
import {
  bodyObb,
  FOOTPRINT_IDS,
  homePlace,
  obbCorners,
  type DeskPlace,
  type FootprintId,
} from '../core/bodies';
import {
  ARRIVAL,
  headsetPose,
  HEADSET_STAND,
  ITEM_POSES,
  LAMP,
  MONITOR,
  type Vec3,
} from '../core/constants';
import {
  HELD,
  PORTRAIT_HUD,
  PORTRAIT_MAX_ASPECT,
  REST,
  REST_FIT,
  SCREEN_FOCUS,
  START_L,
  START_P,
  type View,
} from '../core/views';
import { decorPlacement, placeDecorPoint } from '../core/decorPlaces';
import { ROPE_EXTENT } from '../decor/layout';
import { decorExtentPortrait } from '../decor/obstacles';

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

/** Les limites à l'écran (coordonnées normalisées) où le bureau doit tenir. */
export interface FitLimits {
  x: number;
  yBottom: number;
  yTop: number;
}

/** La taille de la fenêtre en pixels CSS, quand on la connaît. */
export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Les limites du cadrage de repos. En portrait, elles se calculent en pixels
 * (PORTRAIT_HUD) : le haut et le bas du HUD ont une hauteur fixe, quelle que
 * soit la taille du téléphone. Sans taille connue, celles de REST_FIT.
 */
export function restLimits(portrait: boolean, size?: ViewportSize): FitLimits {
  if (!portrait) return REST_FIT.landscape.limits;
  if (!size || size.height <= 0) return REST_FIT.portrait.limits;
  const { top, bottom, x } = PORTRAIT_HUD;
  return {
    x,
    yBottom: -1 + (2 * bottom) / size.height,
    yTop: 1 - (2 * top) / size.height,
  };
}

/**
 * Hauteur de chaque corps au-dessus du plateau : le haut de son encombrement
 * doit aussi tenir dans le cadre (le coffret, le bocal, la baie sont hauts).
 */
export const BODY_HEIGHTS = {
  book: 0.42,
  badge: 0.05,
  laptop: 0.17,
  card: 0.08,
  chest: 0.96,
  netherbrain: 1.08,
  homelab: 0.98,
  casd: 0.27,
  mug: 0.6,
  pad: 0.32,
} as const satisfies Record<FootprintId, number>;

const [monitorX, , monitorZ] = MONITOR.position;
const monitorHalf = MONITOR.frame.width / 2;
const monitorTop = MONITOR.tiltY + MONITOR.frame.height / 2;

/**
 * Les points fixes du bureau utile, par identifiant : le haut du cadre de
 * l'écran, le casque sur son support, la lampe.
 */
export const FIXED_EXTENT: Readonly<
  Record<'monitor' | 'headset' | 'edge' | 'lamp', readonly Vec3[]>
> = {
  monitor: [
    [monitorX - monitorHalf, monitorTop, monitorZ],
    [monitorX + monitorHalf, monitorTop, monitorZ],
  ],
  headset: [[HEADSET_STAND[0], ITEM_POSES.headset.y + 0.9, HEADSET_STAND[2]]],
  // Le bord gauche du cadre en paysage : la corde à sauter enroulée et ses
  // poignées, le morceau du décor le plus à gauche.
  edge: ROPE_EXTENT,
  lamp: [LAMP.base, LAMP.head],
};

/**
 * La part de la hauteur utile (entre les bandes du HUD, restLimits) que
 * couvrent des points projetés : 1 quand ils vont d'une bande à l'autre.
 * Mesure du bureau resserré sur téléphone (data-desk-share).
 */
export function screenShare(
  points: readonly Vec3[],
  camera: PerspectiveCamera,
  limits: FitLimits,
): number {
  const { y0, y1 } = projectedBounds(points, camera);
  return (y1 - y0) / (limits.yTop - limits.yBottom);
}

/**
 * Les points fixes du format : en portrait, la lampe est à
 * leur place du bureau resserré (core/decorPlaces.ts, PORTRAIT_DECOR), et un
 * morceau caché n'a plus de points.
 */
export function fixedExtent(
  portrait: boolean,
): Readonly<Record<'monitor' | 'headset' | 'edge' | 'lamp', readonly Vec3[]>> {
  return portrait ? FIXED_EXTENT_PORTRAIT : FIXED_EXTENT;
}

const placed = (id: 'lamp', points: readonly Vec3[]): Vec3[] =>
  decorPlacement(id, true).hidden ? [] : points.map((point) => placeDecorPoint(id, true, point));

/**
 * Le casque en portrait : le haut de l'arceau et ses deux écouteurs (à 0.7
 * du centre, haut de l'écouteur). Au bord droit du bureau resserré, un
 * écouteur sortait du cadre alors que le centre y tenait.
 */
const headsetPortraitExtent = (): Vec3[] => {
  const { x, y, z, ry } = headsetPose(true);
  const cups = [-0.7, 0.7].map((lx): Vec3 => [
    x + lx * Math.cos(ry),
    y + 0.17,
    z - lx * Math.sin(ry),
  ]);
  return [[x, y + 0.9, z], ...cups];
};

const FIXED_EXTENT_PORTRAIT = {
  monitor: FIXED_EXTENT.monitor,
  headset: headsetPortraitExtent(),
  edge: [],
  lamp: placed('lamp', FIXED_EXTENT.lamp),
} as const;

/** Les huit coins de l'encombrement d'un corps posé à une place (bas, puis haut). */
export function bodyExtent(id: FootprintId, place: DeskPlace): Vec3[] {
  const corners = obbCorners(bodyObb(id, place));
  const height = BODY_HEIGHTS[id];
  return [
    ...corners.map(([x, z]): Vec3 => [x, 0, z]),
    ...corners.map(([x, z]): Vec3 => [x, height, z]),
  ];
}

/** Tous les points du bureau utile au repos, pour un format : corps à leur place, points fixes. */
export function deskExtent(portrait: boolean): Vec3[] {
  const points: Vec3[] = [];
  for (const id of FOOTPRINT_IDS) points.push(...bodyExtent(id, homePlace(id, portrait)));
  for (const fixed of Object.values(fixedExtent(portrait))) points.push(...fixed);
  return points;
}

/** Ce que demande un cadrage : une vue de départ, des points, des limites, un alignement. */
interface FitRequest {
  view: View;
  points: readonly Vec3[];
  limits: FitLimits;
  /**
   * center : les points se centrent entre les limites ; bottom : leur bas se
   * pose sur la limite basse (en portrait, le mur et la fenêtre remplissent
   * le haut au lieu d'une bande vide sous le bureau).
   */
  align: 'center' | 'bottom';
}

/** Recentrages du point visé à chaque distance essayée. */
const FIT_ITERATIONS = 24;

/**
 * La plus petite distance qui fait tenir les points dans leurs limites, en
 * recentrant le point visé (layout() du prototype).
 */
function fitView({ view, points, limits, align }: FitRequest, aspect: number): View {
  const camera = new PerspectiveCamera(view.fov, aspect, 0.1, 90);
  camera.updateProjectionMatrix();
  const target = new Vector3();
  const sinElev = Math.sin(view.elev);

  const fitAt = (dist: number): boolean => {
    const [rx, ry, rz] = view.target;
    target.set(rx, ry, rz);
    for (let iteration = 0; iteration < FIT_ITERATIONS; iteration++) {
      cameraPosition([target.x, target.y, target.z], view.elev, 0, dist, camera.position);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const { x0, x1, y0, y1 } = projectedBounds(points, camera);
      if (iteration === FIT_ITERATIONS - 1) {
        const eps = 1e-4;
        return (
          x0 >= -limits.x - eps &&
          x1 <= limits.x + eps &&
          y0 >= limits.yBottom - eps &&
          y1 <= limits.yTop + eps
        );
      }
      const k = dist * Math.tan((camera.fov * Math.PI) / 360);
      const shiftY =
        align === 'bottom'
          ? y0 - limits.yBottom
          : (y0 + y1) / 2 - (limits.yBottom + limits.yTop) / 2;
      target.z -= ((shiftY * k) / sinElev) * 0.9;
      target.x += ((x0 + x1) / 2) * k * camera.aspect * 0.9;
    }
    return false;
  };

  let lo = 4;
  let hi = 140;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (fitAt(mid)) hi = mid;
    else lo = mid;
  }
  fitAt(hi);
  return {
    target: [target.x, target.y, target.z],
    elev: view.elev,
    az: 0,
    dist: hi,
    fov: view.fov,
  };
}

/** Les points que la vue de repos cadre : ceux de REST_FIT et tout le bureau utile. */
export function restPoints(portrait: boolean): Vec3[] {
  if (!portrait) return [...REST_FIT.landscape.points, ...deskExtent(false)];
  return [...REST_FIT.portrait.points, ...deskExtent(true), ...decorExtentPortrait()];
}

/**
 * La vue de repos pour un rapport largeur / hauteur (et, en portrait, la
 * taille en pixels, pour tenir compte du HUD). Appelée au redimensionnement
 * seulement.
 */
export function fitRestView(aspect: number, size?: ViewportSize): View {
  const portrait = isPortrait(aspect);
  return fitView(
    {
      view: portrait ? REST.portrait : REST.landscape,
      points: restPoints(portrait),
      limits: restLimits(portrait, size),
      align: portrait ? 'bottom' : 'center',
    },
    aspect,
  );
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
