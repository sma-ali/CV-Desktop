import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../core/ids';
import { deskExit, easeInOut, flightPose, slerp, yawQuaternion } from './flight';
import { bodyReach, occupiedHeight, reachOf } from './reach';
import { createDeskBodies } from '../core/bodies';

// Le trajet d'un corps qui rentre : il part de sa pose, passe au-dessus du
// bureau, arrive droit à sa place ; il sort d'abord de sous le plateau.

const start = { x: -8, y: -3, z: 1, qx: 0.6, qy: 0, qz: 0, qw: 0.8 };
const home = { x: -3, y: 0, z: 1.4, ry: 0.2 };

describe('le trajet du retour', () => {
  it('part de la pose de départ et arrive droit à sa place', () => {
    const a = flightPose(start, home, 0, 1.5);
    expect([a.x, a.y, a.z]).toEqual([start.x, start.y, start.z]);
    expect(a.qx).toBeCloseTo(start.qx, 6);
    const b = flightPose(start, home, 1, 1.5);
    expect(b.x).toBeCloseTo(home.x, 6);
    expect(b.y).toBeCloseTo(home.y, 6);
    expect(b.z).toBeCloseTo(home.z, 6);
    expect(b.ry).toBeCloseTo(home.ry, 6);
    expect(Math.abs(b.qx) + Math.abs(b.qz)).toBeLessThan(1e-6);
  });

  it('passe au-dessus de sa place à mi-chemin', () => {
    expect(flightPose(start, home, 0.5, 1.5).y).toBeGreaterThan(home.y + 0.5);
  });

  it('adoucit le départ et l’arrivée', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });

  it('interpole les orientations par le plus court chemin', () => {
    const a = yawQuaternion(0);
    const b = yawQuaternion(Math.PI / 2);
    const mid = slerp(a, b, 0.5);
    expect(2 * Math.atan2(mid.qy, mid.qw)).toBeCloseTo(Math.PI / 4, 6);
  });

  it('sort de sous le plateau par le bord le plus proche, jamais par le mur', () => {
    const area = { x0: -6.6, x1: 6.6, z0: -3.55, z1: 3.4, under: -0.36 };
    expect(deskExit({ x: -5.5, y: -3, z: 0 }, area, 1)).toEqual({ x: -7.6, z: 0 });
    expect(deskExit({ x: 5.5, y: -3, z: -3 }, area, 1)).toEqual({ x: 7.6, z: -3 });
    expect(deskExit({ x: 0, y: -3, z: 3 }, area, 1)).toEqual({ x: 0, z: 4.4 });
    // Déjà dehors, ou sur le plateau : rien à faire.
    expect(deskExit({ x: -8, y: -3, z: 0 }, area, 1)).toBeNull();
    expect(deskExit({ x: 0, y: 0.2, z: 0 }, area, 1)).toBeNull();
  });
});

describe('l’encombrement des corps', () => {
  it('donne à chaque corps une sphère qui le contient', () => {
    for (const id of BODY_IDS) expect(reachOf(id), id).toBeGreaterThan(0.05);
    expect(bodyReach({ shapes: [{ kind: 'ball', radius: 0.5, at: [1, 0, 0] }] })).toBeCloseTo(1.5);
  });

  it('voit une place libre au repos, et occupée par un corps déplacé', () => {
    const desk = createDeskBodies(false);
    const notMoved = (id: (typeof BODY_IDS)[number]) => !desk[id].moved;
    expect(occupiedHeight(desk, 'book', desk.book.x, desk.book.z, notMoved)).toBe(-Infinity);
    desk.homelab.x = desk.book.x;
    desk.homelab.z = desk.book.z;
    desk.homelab.moved = true;
    expect(occupiedHeight(desk, 'book', desk.book.x, desk.book.z, notMoved)).toBeGreaterThan(0.5);
  });
});
