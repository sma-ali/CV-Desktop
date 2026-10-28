import { Euler, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { clamp, lerp } from '../core/arrival';
import {
  HELD,
  HELD_MAX_DISTANCE,
  MONITOR,
  POSTIT_ON_MONITOR,
  type ItemPose,
  type PresentMode,
} from '../core/constants';

// La présentation d'un objet du CV (updateItem, heldPose et presentQ du
// prototype) : il quitte le bureau, se tient devant la caméra en tournant
// doucement, puis se repose. Fonctions sans état React ; les vecteurs de
// travail sont partagés (les objets se mettent à jour l'un après l'autre),
// rien n'est alloué à chaque image.

/** Priorité des useFrame des objets : après la caméra de la mise en scène (voir docs). */
export const ITEMS_PRIORITY = -10;

/** Vitesses du prototype (par seconde) : soulever, reposer, retourner ou ouvrir. */
export const RATES = { lift: 1.25, putBack: 1.6, flip: 1.15 } as const;

/** Relèvement au survol (unités de la scène) et lueur des textures. */
export const HOVER_LIFT = 0.08;
export const GLOW = { held: 0.16, hover: 0.14 } as const;

/** Avance value vers target d'au plus step, sans le dépasser. */
export function stepToward(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** L'état de présentation d'un objet, mutable, gardé par l'objet. */
export interface PresentState {
  /** Avancement du soulèvement (0 sur le bureau, 1 devant la caméra). */
  p: number;
  /** Avancement du geste propre à l'objet (ouvrir, retourner), 0 à 1. */
  f: number;
  /** Survol, 0 à 1. */
  hover: number;
}

export function createPresentState(): PresentState {
  return { p: 0, f: 0, hover: 0 };
}

/**
 * Fait avancer la présentation d'une image. held : l'objet est-il présenté ;
 * hovered : est-il sous le pointeur ; flipped : son geste est-il demandé
 * (store.flipped, vrai par défaut). En mouvement réduit, tout est immédiat.
 */
export function stepPresentation(
  state: PresentState,
  held: boolean,
  hovered: boolean,
  dt: number,
  reduced: boolean,
  flipped = true,
): PresentState {
  const target = held ? 1 : 0;
  state.p = reduced
    ? target
    : stepToward(state.p, target, dt * (held ? RATES.lift : RATES.putBack));
  // Le geste commence quand l'objet est à mi-chemin, et se défait aussitôt reposé.
  const gesture = held && flipped && state.p > 0.55 ? 1 : 0;
  state.f = reduced ? gesture : stepToward(state.f, gesture, dt * RATES.flip);
  const hover = hovered && !held ? 1 : 0;
  state.hover = reduced ? hover : lerp(state.hover, hover, 1 - Math.pow(0.002, dt));
  if (Math.abs(state.hover - hover) < 1e-3) state.hover = hover;
  return state;
}

/** Ce qui, du visiteur, oriente l'objet tenu : pointeur (-1 à 1) et temps. */
export interface PresentInput {
  t: number;
  pointerX: number;
  pointerY: number;
}

const euler = new Euler();
const QX90 = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Orientation de l'objet tenu, dans le repère de la caméra (presentQ du
 * prototype). seed décale le balancement d'un objet à l'autre.
 */
export function presentQuaternion(
  mode: PresentMode,
  f: number,
  seed: number,
  { t, pointerX: px, pointerY: py }: PresentInput,
  out: Quaternion,
): Quaternion {
  const wob = Math.sin(t * 1.3 + seed) * 0.05;
  switch (mode) {
    case 'flip':
      euler.set(
        wob * 0.6 - py * 0.12,
        Math.PI * smooth(f) + wob + px * 0.25,
        Math.sin(t * 0.9) * 0.03,
      );
      return out.setFromEuler(euler).multiply(QX90);
    case 'open':
      euler.set(-0.12 - py * 0.1 + wob * 0.5, -0.1 * f + px * 0.22 + wob, 0);
      return out.setFromEuler(euler).multiply(QX90);
    case 'laptop': {
      const k = smooth(f);
      euler.set(lerp(Math.PI / 2, 0.3, k) - py * 0.1 + wob * 0.4, px * 0.25 + wob - 0.08 * k, 0);
      return out.setFromEuler(euler);
    }
    case 'turn':
      euler.set(0.25 - py * 0.15, Math.sin(t * 0.8) * 0.7 + px * 0.4 + f * Math.PI * 0.15, 0);
      return out.setFromEuler(euler);
    case 'shake': {
      const shake = Math.sin(t * 28) * Math.max(0, Math.sin(t * 1.7)) * 0.06;
      euler.set(0.5 - py * 0.12, -0.35 + Math.sin(t * 0.6) * 0.25 + px * 0.3 + shake, shake * 0.5);
      return out.setFromEuler(euler);
    }
    case 'spin':
      // Un objet debout, penché vers la caméra, qui fait un demi-tour pour montrer son dos.
      euler.set(
        0.35 - py * 0.12 + wob * 0.4,
        Math.PI * smooth(f) + px * 0.3 + wob,
        Math.sin(t * 0.9) * 0.02,
      );
      return out.setFromEuler(euler);
    case 'screen':
      return out.identity();
  }
}

const direction = new Vector3();
const up = new Vector3();
const local = new Quaternion();

/**
 * Où se tient l'objet présenté (heldPose du prototype) : centré sur le point
 * HELD de l'écran, assez loin pour occuper au plus la part prévue de la
 * hauteur et de la largeur, jamais plus loin que HELD_MAX_DISTANCE (l'objet
 * rapetisse alors). Renvoie l'échelle à appliquer.
 */
export function heldPose(
  camera: PerspectiveCamera,
  pose: Pick<ItemPose, 'hold' | 'mode'>,
  portrait: boolean,
  f: number,
  seed: number,
  input: PresentInput,
  outPosition: Vector3,
  outQuaternion: Quaternion,
): number {
  const held = portrait ? HELD.portrait : HELD.landscape;
  const vh = 2 * Math.tan((camera.fov * Math.PI) / 360);
  let distance = Math.max(
    pose.hold.h / (held.fracH * vh),
    pose.hold.w / (held.fracW * vh * camera.aspect),
  );
  const scale = distance > HELD_MAX_DISTANCE ? HELD_MAX_DISTANCE / distance : 1;
  distance = Math.min(distance, HELD_MAX_DISTANCE);
  direction.set(held.x, held.y, 0.5).unproject(camera).sub(camera.position).normalize();
  outPosition.copy(camera.position).addScaledVector(direction, distance);
  if (pose.hold.oy) {
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    outPosition.addScaledVector(up, -pose.hold.oy * scale);
  }
  presentQuaternion(pose.mode, f, seed, input, local);
  outQuaternion.copy(camera.quaternion).multiply(local);
  return scale;
}

/** Une pose de repos : position et orientation dans le repère du monde. */
export interface RestPose {
  position: Vector3;
  quaternion: Quaternion;
}

/** La pose de repos d'un objet posé à plat sur le bureau (ITEM_POSES). */
export function deskRestPose(pose: Pick<ItemPose, 'x' | 'y' | 'z' | 'ry'>): RestPose {
  return {
    position: new Vector3(pose.x, pose.y, pose.z),
    quaternion: new Quaternion().setFromEuler(new Euler(0, pose.ry, 0)),
  };
}

/** Rotation de la dalle de l'écran (monTilt du prototype). */
export function monitorTiltQuaternion(): Quaternion {
  return new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MONITOR.tiltX);
}

/**
 * La pose du post-it collé en bas à droite du cadre de l'écran : la position
 * POSTIT_ON_MONITOR, exprimée dans le repère de la dalle, passée dans celui
 * du monde.
 */
export function postitRestPose(): RestPose {
  const tilt = monitorTiltQuaternion();
  const [mx, my, mz] = MONITOR.position;
  const position = new Vector3(...POSTIT_ON_MONITOR.position)
    .applyQuaternion(tilt)
    .add(new Vector3(mx, my + MONITOR.tiltY, mz));
  const quaternion = tilt
    .clone()
    .multiply(new Quaternion().setFromEuler(new Euler(...POSTIT_ON_MONITOR.rotation)));
  return { position, quaternion };
}

/** Lueur des textures d'un objet : plus forte quand il est tenu ou survolé. */
export function glowLevel(state: PresentState, base = 0): number {
  return clamp(state.p * GLOW.held + state.hover * GLOW.hover + base, 0, 1);
}
