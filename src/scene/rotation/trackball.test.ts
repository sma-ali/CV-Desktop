import { Euler, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { rotateKey, rotationInput, RotationInput } from './control';
import { createSceneStore } from '../core/store';
import {
  arcball,
  cameraToWorld,
  clampSpeed,
  dragRotation,
  easeShare,
  fromRotationVector,
  heldBall,
  keyRotation,
  parseTurn,
  rotationAngle,
  sphereVector,
  SPIN,
  stepInertia,
  takePending,
  toRotationVector,
  turnRotation,
  writeSpin,
} from './trackball';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

/** Où va la face avant (z vers le visiteur) sous une rotation. */
const front = (q: Quaternion) => new Vector3(0, 0, 1).applyQuaternion(q);

describe('la boule virtuelle', () => {
  it('donne des points unitaires, continus au bord', () => {
    for (const [x, y] of [
      [0, 0],
      [0.3, -0.2],
      [0.7, 0.1],
      [2, 3],
    ] as const) {
      close(sphereVector(x, y, new Vector3()).length(), 1);
    }
    // De part et d'autre du raccord (d² = 0.5), la hauteur ne saute pas.
    const inside = sphereVector(Math.sqrt(0.5) - 1e-6, 0, new Vector3());
    const outside = sphereVector(Math.sqrt(0.5) + 1e-6, 0, new Vector3());
    expect(inside.distanceTo(outside)).toBeLessThan(1e-4);
  });

  it('un glisser vers la droite au centre fait tourner autour de l’axe vertical', () => {
    const q = arcball(0, 0, 0.2, 0, 1, new Quaternion());
    const v = toRotationVector(q, new Vector3());
    expect(v.y).toBeGreaterThan(0.1);
    close(v.x, 0);
    close(v.z, 0);
    // La face avant part vers la droite.
    expect(front(q).x).toBeGreaterThan(0.1);
  });

  it('un glisser vers le haut fait basculer la face avant vers le haut', () => {
    const q = arcball(0, 0, 0, 0.2, 1, new Quaternion());
    expect(front(q).y).toBeGreaterThan(0.1);
    expect(toRotationVector(q, new Vector3()).x).toBeLessThan(0);
  });

  it('un glisser en arc au bord fait tourner autour de l’axe de la vue', () => {
    // Du bord droit vers le haut, en tournant autour du centre.
    const q = arcball(2, 0, 0, 2, 1, new Quaternion());
    const v = toRotationVector(q, new Vector3());
    expect(Math.abs(v.z)).toBeGreaterThan(Math.abs(v.x) + Math.abs(v.y));
    expect(v.z).toBeGreaterThan(0);
  });

  it('suit le point saisi avec un gain de 1', () => {
    const q = arcball(0.1, 0.1, 0.4, -0.2, 1, new Quaternion());
    const a = sphereVector(0.1, 0.1, new Vector3()).applyQuaternion(q);
    const b = sphereVector(0.4, -0.2, new Vector3());
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
  });

  it('ne tourne pas sans mouvement', () => {
    expect(rotationAngle(arcball(0.3, 0.3, 0.3, 0.3, 1, new Quaternion()))).toBe(0);
  });

  it('se centre sur l’objet tenu, en pixels de la fenêtre', () => {
    const rect = { left: 0, top: 0, width: 1000, height: 500 };
    const ball = heldBall(rect, false, { cx: 0, cy: 0, r: 0 });
    close(ball.cx, 350); // HELD.landscape.x = -0.3
    close(ball.cy, 235); // HELD.landscape.y = 0.06
    close(ball.r, 500 * SPIN.radius);
    // En pixels, y descend : un glisser vers le bas fait descendre la face avant.
    const q = dragRotation(ball, ball.cx, ball.cy, ball.cx, ball.cy + 50, new Quaternion());
    expect(front(q).y).toBeLessThan(-0.1);
  });
});

describe('les repères', () => {
  it('passe une rotation de la caméra au monde', () => {
    // Caméra tournée d'un quart de tour à gauche : son axe vertical reste y.
    const camera = new Quaternion().setFromEuler(new Euler(-0.6, 0.4, 0));
    const local = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5);
    const world = cameraToWorld(local, camera, new Quaternion());
    const axis = toRotationVector(world, new Vector3()).normalize();
    const cameraUp = new Vector3(0, 1, 0).applyQuaternion(camera);
    close(axis.dot(cameraUp), 1);
    close(rotationAngle(world), 0.5);
  });

  it('vecteur rotation et quaternion font l’aller-retour', () => {
    const q = new Quaternion().setFromEuler(new Euler(0.3, -1.1, 0.7));
    const back = fromRotationVector(toRotationVector(q, new Vector3()), new Quaternion());
    close(Math.abs(back.dot(q)), 1);
  });

  it('écrit le spin du côté w positif, l’identité à qw 1', () => {
    const spin = { qx: 0, qy: 0, qz: 0, qw: 1 };
    writeSpin(new Quaternion(0.1, 0.2, 0.3, -0.9), spin);
    expect(spin.qw).toBeGreaterThan(0);
    writeSpin(new Quaternion(0, 0, 0, -1), spin);
    expect(spin).toEqual({ qx: 0, qy: 0, qz: 0, qw: 1 });
  });
});

describe('l’inertie', () => {
  it('tourne puis s’arrête', () => {
    const velocity = new Vector3(0, 3, 0);
    const q = stepInertia(velocity, 1 / 60, new Quaternion());
    close(rotationAngle(q), 3 / 60);
    expect(velocity.y).toBeLessThan(3);
    let total = 0;
    for (let i = 0; i < 600 && velocity.lengthSq() > 0; i++) {
      total += rotationAngle(stepInertia(velocity, 1 / 60, new Quaternion()));
    }
    expect(velocity.length()).toBe(0);
    // L'élan total reste court : environ vitesse / friction.
    expect(total).toBeLessThan(3 / SPIN.friction + 0.01);
  });

  it('ne fait rien sans temps ni vitesse', () => {
    expect(rotationAngle(stepInertia(new Vector3(0, 3, 0), 0, new Quaternion()))).toBe(0);
    const slow = new Vector3(0, SPIN.minSpeed / 2, 0);
    expect(rotationAngle(stepInertia(slow, 1 / 60, new Quaternion()))).toBe(0);
    expect(slow.length()).toBe(0);
  });

  it('plafonne la vitesse au lâcher', () => {
    close(clampSpeed(new Vector3(100, 0, 0)).length(), SPIN.maxSpeed);
    close(clampSpeed(new Vector3(1, 0, 0)).length(), 1);
  });
});

describe('les pas du clavier', () => {
  it('droite : la face avant part à droite ; bas : elle descend', () => {
    expect(front(keyRotation(1, 0, new Quaternion())).x).toBeGreaterThan(0.3);
    expect(front(keyRotation(0, 1, new Quaternion())).y).toBeLessThan(-0.3);
    close(rotationAngle(keyRotation(-2, 0, new Quaternion())), 2 * SPIN.keyStep);
    expect(rotationAngle(keyRotation(0, 0, new Quaternion()))).toBe(0);
  });

  it('se jouent par parts, sans perte', () => {
    const target = keyRotation(1, 1, new Quaternion());
    const pending = target.clone();
    const done = new Quaternion();
    for (let i = 0; i < 200 && rotationAngle(pending) > 0; i++) {
      done.premultiply(takePending(pending, easeShare(1 / 60, false), new Quaternion()));
    }
    close(Math.abs(done.dot(target)), 1, 1e-5);
    expect(rotationAngle(pending)).toBe(0);
  });

  it('d’un coup en mouvement réduit', () => {
    expect(easeShare(1 / 60, true)).toBe(1);
    const pending = keyRotation(1, 0, new Quaternion());
    close(rotationAngle(takePending(pending, 1, new Quaternion())), SPIN.keyStep);
    expect(rotationAngle(pending)).toBe(0);
  });

  it('les flèches, et rien d’autre', () => {
    expect(rotateKey('ArrowLeft')).toEqual([-1, 0]);
    expect(rotateKey('ArrowDown')).toEqual([0, 1]);
    expect(rotateKey('PageDown')).toBeNull();
    expect(rotateKey('toString')).toBeNull();
  });

  it('s’accumulent jusqu’à la prochaine image, une entrée par store', () => {
    const store = createSceneStore();
    const input = rotationInput(store);
    expect(rotationInput(store)).toBe(input);
    expect(rotationInput(createSceneStore())).not.toBe(input);
    input.nudge(1, 0);
    input.nudge(1, -1);
    expect(input.take()).toEqual({ yaw: 2, pitch: -1 });
    expect(input.take()).toBeNull();
    expect(new RotationInput().take()).toBeNull();
  });
});

describe('?tourne', () => {
  it('lit deux angles en radians', () => {
    expect(parseTurn('?t=11000&tourne=0.5,-1.2')).toEqual({ x: 0.5, y: -1.2 });
    expect(parseTurn('?tourne=2,3')).toEqual({ x: 2, y: 3 });
  });

  it('ignore une valeur absente ou illisible', () => {
    expect(parseTurn('?t=11000')).toBeNull();
    expect(parseTurn('?tourne')).toBeNull();
    expect(parseTurn('?tourne=a,b')).toBeNull();
    expect(parseTurn('?tourne=1')).toBeNull();
  });

  it('applique x puis y', () => {
    const q = turnRotation({ x: 0, y: Math.PI / 2 }, new Quaternion());
    close(front(q).x, 1);
    const both = turnRotation({ x: 0.4, y: 0.7 }, new Quaternion());
    const expected = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), 0.7)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.4));
    close(Math.abs(both.dot(expected)), 1);
  });
});
