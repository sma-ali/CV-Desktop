import { Quaternion, Vector3 } from 'three';
import { HELD } from '../core/framing';
import type { HeldSpin } from '../core/store';

// La rotation libre de l'objet présenté (partie A de l'étape 6), sans React :
// une boule virtuelle (trackball) sous le pointeur, l'inertie au lâcher, les
// pas du clavier et le retour à l'endroit. Tout se calcule dans le repère de
// la caméra (x à droite, y en haut, z vers le visiteur), puis passe dans
// celui du monde : store.heldSpin s'applique par-dessus la pose tenue, dans
// le repère du monde (usePresentation).

export const SPIN = {
  /** Rayon de la boule, en part de la plus petite dimension du canvas. */
  radius: 0.32,
  /** Gain de la boule : 1 suit exactement le point saisi ; un peu plus rend l'objet vif. */
  gain: 1.35,
  /** Inertie : la vitesse se divise par e en 1 / friction seconde. */
  friction: 5,
  /** En deçà (radians par seconde), l'objet s'arrête. */
  minSpeed: 0.05,
  /** Vitesse maximale au lâcher (radians par seconde). */
  maxSpeed: 10,
  /** Lissage de la vitesse mesurée pendant le glisser (part gardée par image à 60 i/s). */
  velocityKeep: 0.6,
  /** Un pas des flèches du clavier (radians). */
  keyStep: Math.PI / 8,
  /** Les pas du clavier et le retour à l'endroit se jouent à ce rythme (part par seconde). */
  ease: 12,
  /** Au-delà de cet angle (radians), l'objet compte comme tourné (« Remettre droit »). */
  turned: 0.05,
} as const;

const IDENTITY = new Quaternion();

/**
 * Le point de la boule virtuelle sous un point de l'écran (Bell) : x et y
 * relatifs au centre, en rayons de la boule ; au-delà du bord, une
 * hyperbole qui prolonge la sphère sans cassure. Renvoie un vecteur unitaire.
 */
export function sphereVector(x: number, y: number, out: Vector3): Vector3 {
  const d2 = x * x + y * y;
  const z = d2 <= 0.5 ? Math.sqrt(1 - d2) : 0.5 / Math.sqrt(d2);
  return out.set(x, y, z).normalize();
}

const from = new Vector3();
const to = new Vector3();
const axis = new Vector3();

/**
 * La rotation (repère de la caméra) qui mène le point de la boule sous
 * (x0, y0) à celui sous (x1, y1), multipliée par gain. Près du centre, un
 * glisser fait basculer l'objet ; au bord, il le fait tourner autour de
 * l'axe de la vue : les trois axes sont accessibles.
 */
export function arcball(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gain: number,
  out: Quaternion,
): Quaternion {
  sphereVector(x0, y0, from);
  sphereVector(x1, y1, to);
  axis.crossVectors(from, to);
  const sin = axis.length();
  if (sin < 1e-9) return out.identity();
  const angle = Math.atan2(sin, from.dot(to)) * gain;
  return out.setFromAxisAngle(axis.divideScalar(sin), angle);
}

/** La boule virtuelle sur le canvas : centre et rayon, en pixels de la fenêtre. */
export interface Ball {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Où se trouve la boule : centrée sur le point où se tient l'objet présenté
 * (HELD), d'un rayon proportionnel au canvas.
 */
export function heldBall(
  rect: { left: number; top: number; width: number; height: number },
  portrait: boolean,
  out: Ball,
): Ball {
  const held = portrait ? HELD.portrait : HELD.landscape;
  out.cx = rect.left + ((held.x + 1) / 2) * rect.width;
  out.cy = rect.top + ((1 - held.y) / 2) * rect.height;
  out.r = Math.max(1, SPIN.radius * Math.min(rect.width, rect.height));
  return out;
}

/**
 * La rotation (repère de la caméra) d'un glisser de (ax, ay) à (bx, by),
 * en pixels de la fenêtre (y vers le bas).
 */
export function dragRotation(
  ball: Ball,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: Quaternion,
): Quaternion {
  return arcball(
    (ax - ball.cx) / ball.r,
    (ball.cy - ay) / ball.r,
    (bx - ball.cx) / ball.r,
    (ball.cy - by) / ball.r,
    SPIN.gain,
    out,
  );
}

const inverse = new Quaternion();

/** Passe une rotation du repère de la caméra à celui du monde : c q c⁻¹. */
export function cameraToWorld(q: Quaternion, camera: Quaternion, out: Quaternion): Quaternion {
  inverse.copy(camera).invert();
  return out.copy(camera).multiply(q).multiply(inverse);
}

/** L'angle d'une rotation (0 à π). */
export function rotationAngle(q: Quaternion | HeldSpin): number {
  const w = 'w' in q ? q.w : q.qw;
  return 2 * Math.acos(Math.min(1, Math.abs(w)));
}

/** Le vecteur rotation (axe fois angle) d'un quaternion. */
export function toRotationVector(q: Quaternion, out: Vector3): Vector3 {
  const angle = rotationAngle(q);
  const s = Math.sqrt(Math.max(0, 1 - q.w * q.w));
  if (s < 1e-9 || angle < 1e-9) return out.set(0, 0, 0);
  const sign = q.w < 0 ? -1 : 1;
  return out.set(q.x, q.y, q.z).multiplyScalar((sign * angle) / s);
}

/** Le quaternion d'un vecteur rotation. */
export function fromRotationVector(v: Vector3, out: Quaternion): Quaternion {
  const angle = v.length();
  if (angle < 1e-12) return out.identity();
  axis.copy(v).divideScalar(angle);
  return out.setFromAxisAngle(axis, angle);
}

export function readSpin(spin: HeldSpin, out: Quaternion): Quaternion {
  return out.set(spin.qx, spin.qy, spin.qz, spin.qw);
}

export function writeSpin(q: Quaternion, spin: HeldSpin): void {
  q.normalize();
  // Toujours du côté w ≥ 0 : la même rotation, et qw === 1 à l'identité.
  const sign = q.w < 0 ? -1 : 1;
  spin.qx = q.x * sign;
  spin.qy = q.y * sign;
  spin.qz = q.z * sign;
  spin.qw = q.w * sign;
  if (rotationAngle(spin) < 1e-6) {
    spin.qx = 0;
    spin.qy = 0;
    spin.qz = 0;
    spin.qw = 1;
  }
}

/**
 * L'inertie : la vitesse angulaire (vecteur rotation par seconde, repère du
 * monde) fait tourner l'objet pendant dt, puis décroît. Renvoie la rotation
 * de l'image dans out, et ralentit velocity en place (zéro sous minSpeed).
 */
export function stepInertia(velocity: Vector3, dt: number, out: Quaternion): Quaternion {
  const speed = velocity.length();
  if (speed < SPIN.minSpeed || dt <= 0) {
    velocity.set(0, 0, 0);
    return out.identity();
  }
  axis.copy(velocity).multiplyScalar(dt);
  fromRotationVector(axis, out);
  velocity.multiplyScalar(Math.exp(-SPIN.friction * dt));
  return out;
}

/** Plafonne une vitesse angulaire à SPIN.maxSpeed. */
export function clampSpeed(velocity: Vector3): Vector3 {
  const speed = velocity.length();
  if (speed > SPIN.maxSpeed) velocity.multiplyScalar(SPIN.maxSpeed / speed);
  return velocity;
}

/**
 * Un pas vers une rotation à jouer : la part k de pending (rotation restante,
 * repère du monde) est rendue dans out, et pending garde le reste
 * (pending · out⁻¹). Avec k = 1, tout est joué.
 */
export function takePending(pending: Quaternion, k: number, out: Quaternion): Quaternion {
  if (k >= 1 || rotationAngle(pending) < 1e-4) {
    out.copy(pending);
    pending.identity();
    return out;
  }
  out.copy(IDENTITY).slerp(pending, k);
  inverse.copy(out).invert();
  pending.multiply(inverse);
  return out;
}

/** La part d'un pas amorti à jouer pendant dt (1 en mouvement réduit ou horloge gelée). */
export function easeShare(dt: number, immediate: boolean): number {
  return immediate ? 1 : 1 - Math.exp(-SPIN.ease * Math.max(0, dt));
}

/**
 * Un pas du clavier dans le repère de la caméra : yaw autour de l'axe
 * vertical de la vue (droite : la face avant part à droite), pitch autour
 * de l'axe horizontal (bas : la face avant descend).
 */
export function keyRotation(yaw: number, pitch: number, out: Quaternion): Quaternion {
  axis.set(pitch, yaw, 0);
  const steps = axis.length();
  if (steps === 0) return out.identity();
  return out.setFromAxisAngle(axis.divideScalar(steps), steps * SPIN.keyStep);
}

/**
 * ?tourne=x,y : angles (radians) appliqués à l'objet présenté, x autour de
 * l'axe horizontal de la vue, puis y autour de son axe vertical. Null si
 * absent ou illisible.
 */
export function parseTurn(search: string): { x: number; y: number } | null {
  const value = new URLSearchParams(search).get('tourne');
  if (value === null) return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

/** La rotation de ?tourne (repère de la caméra). */
export function turnRotation(turn: { x: number; y: number }, out: Quaternion): Quaternion {
  const pitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), turn.x);
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), turn.y);
  return out.copy(yaw).multiply(pitch);
}
