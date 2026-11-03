import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDeskBodies, homePose, type DeskBodies } from '../core/bodies';
import { BODY_IDS } from '../core/ids';
import { DeskPhysics, FIXED_STEP } from './world';

// Le monde physique du bureau vivant, avec le vrai Rapier (WebAssembly en
// Node) : immobile au repos, un glisser qui pousse, empile ou fait tomber,
// un lancer, le retour à la place d'origine, le changement de format.

beforeAll(async () => {
  await RAPIER.init();
});

function setup(portrait = false) {
  const world = new RAPIER.World({ x: 0, y: -60, z: 0 });
  const physics = new DeskPhysics(RAPIER, world, portrait);
  const desk = createDeskBodies(portrait);
  return { world, physics, desk };
}

/** Glisse un corps vers (x, z) pendant `seconds`, en pas fixes, puis le lâche. */
function dragTo(
  physics: DeskPhysics,
  desk: DeskBodies,
  id: (typeof BODY_IDS)[number],
  x: number,
  z: number,
  { seconds = 1.5, withThrow = false, moving = false } = {},
) {
  const start = { x: desk[id].x, z: desk[id].z };
  expect(physics.grab(id, start.x, start.z)).toBe(true);
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 1; i <= steps; i++) {
    const k = moving ? i / steps : Math.min(1, i / (steps * 0.6));
    physics.aim(start.x + (x - start.x) * k, start.z + (z - start.z) * k);
    physics.stepMany(desk, 1);
  }
  physics.release(withThrow);
}

describe('le monde physique du bureau', () => {
  it('reste immobile au repos : tout dort à sa place d’origine', () => {
    const { physics, desk } = setup();
    for (let i = 0; i < 240; i++) physics.advance(FIXED_STEP, desk);
    expect(physics.anyAwake()).toBe(false);
    for (const id of BODY_IDS) {
      const home = homePose(id, false);
      const pose = physics.poseOf(id);
      expect(Math.hypot(pose.x - home.x, pose.y - home.y, pose.z - home.z), id).toBeLessThan(1e-6);
      expect(desk[id].moved, id).toBe(false);
    }
  });

  it('glisse un corps, le pose, sans interpénétration, puis tout se rendort', () => {
    const { physics, desk } = setup();
    dragTo(physics, desk, 'mug', 4.9, 0);
    const events = physics.settle(desk);
    expect(physics.anyAwake()).toBe(false);
    expect(events.settled).toBe(true);
    expect(desk.mug.moved).toBe(true);
    expect(desk.mug.x).toBeCloseTo(4.9, 1);
    expect(desk.mug.z).toBeCloseTo(0, 1);
    expect(desk.mug.fallen).toBe(false);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
  });

  it('pose le portable sur la carte (il passe par-dessus), sans recouvrement', () => {
    const { physics, desk } = setup();
    dragTo(physics, desk, 'laptop', -0.3, 2.15, { seconds: 2 });
    physics.settle(desk);
    expect(desk.laptop.moved).toBe(true);
    expect(desk.laptop.x).toBeLessThan(1);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
  });

  it('fait tomber du bureau un objet lâché au-delà du bord', () => {
    const { physics, desk } = setup();
    dragTo(physics, desk, 'book', -8.5, 1.4);
    physics.settle(desk);
    expect(desk.book.fallen).toBe(true);
    expect(desk.book.y).toBeLessThan(-2);
  });

  it('lance un objet avec l’élan du geste, et pas sans', () => {
    const run = (withThrow: boolean) => {
      const { physics, desk } = setup();
      dragTo(physics, desk, 'badge', -1.25, 1.2, { seconds: 0.3, withThrow, moving: true });
      physics.settle(desk);
      return desk.badge.z;
    };
    // Lancé vers le fond, il va plus loin que là où on l'a lâché.
    expect(run(true)).toBeLessThan(run(false) - 0.1);
  });

  it('renvoie un corps chez lui, endormi', () => {
    const { physics, desk } = setup();
    dragTo(physics, desk, 'chest', -2, 1.5);
    physics.settle(desk);
    physics.sendHome('chest');
    physics.settle(desk);
    const home = homePose('chest', false);
    const pose = physics.poseOf('chest');
    expect(pose.x).toBeCloseTo(home.x, 5);
    expect(pose.z).toBeCloseTo(home.z, 5);
    expect(physics.isAwake('chest')).toBe(false);
  });

  it('range tout au changement de format', () => {
    const { physics, desk } = setup();
    dragTo(physics, desk, 'card', 3, 2.6);
    physics.settle(desk);
    physics.setFormat(true);
    for (const id of BODY_IDS) {
      const home = homePose(id, true);
      const pose = physics.poseOf(id);
      expect(Math.hypot(pose.x - home.x, pose.z - home.z), id).toBeLessThan(1e-6);
    }
  });

  it('reste immobile au repos en portrait aussi', () => {
    const { physics, desk } = setup(true);
    for (let i = 0; i < 120; i++) physics.advance(FIXED_STEP, desk);
    expect(physics.anyAwake()).toBe(false);
  });

  it('est déterministe : mêmes gestes, mêmes places', () => {
    const run = () => {
      const { physics, desk } = setup();
      dragTo(physics, desk, 'laptop', 0.5, 0.9, { withThrow: true });
      physics.settle(desk);
      return BODY_IDS.map((id) => [desk[id].x, desk[id].y, desk[id].z]);
    };
    expect(run()).toEqual(run());
  });

  it('se pose vite après un glisser joué en temps réel : tout dort en moins de 4 s', () => {
    const { physics, desk } = setup();
    expect(physics.grab('laptop', desk.laptop.x, desk.laptop.z)).toBe(true);
    physics.aim(-0.3, 2.15);
    for (let i = 0; i < 240; i++) {
      physics.advance(FIXED_STEP, desk);
      if (Math.hypot(desk.laptop.x + 0.3, desk.laptop.z - 2.15) < 0.02) break;
    }
    physics.release(false);
    let settledAfter = -1;
    for (let i = 0; i < 240 && settledAfter < 0; i++) {
      if (physics.advance(FIXED_STEP, desk).settled) settledAfter = i;
    }
    expect(settledAfter).toBeGreaterThan(0);
    expect(physics.anyAwake()).toBe(false);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
  });

  it('pose le bureau resserré du portrait sans interpénétration', () => {
    const { physics, desk } = setup(true);
    physics.stepMany(desk, 1);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
  });
});
