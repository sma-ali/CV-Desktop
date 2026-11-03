import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDeskBodies, homePose, MOVED, type DeskBodies } from '../core/bodies';
import { BODY_IDS, type BodyId } from '../core/ids';
import { DeskPhysics, FIXED_STEP } from '../physics/world';
import { FALL_RETURN, scatterPoses, TIDY, TidyDirector, type TidyContext } from './director';
import { disorderScore, DISORDER } from './disorder';

// Le metteur en ordre avec le vrai moteur (Rapier en Node) : retour d'un
// corps tombé, rangement animé, rangement d'un coup (mouvement réduit,
// &fige), corps saisi ou présenté laissé au visiteur, ?desordre.

beforeAll(async () => {
  await RAPIER.init();
});

function setup(portrait = false) {
  const world = new RAPIER.World({ x: 0, y: -60, z: 0 });
  const physics = new DeskPhysics(RAPIER, world, portrait);
  const desk = createDeskBodies(portrait);
  const director = new TidyDirector();
  const out = new Set<BodyId>();
  const ctx: TidyContext = {
    physics,
    desk,
    portrait,
    isOut: (id) => out.has(id),
    instant: false,
    frozen: false,
  };
  return { physics, desk, director, ctx, out };
}

/** Glisse un corps vers (x, z) puis le lâche sans élan, et laisse tout se poser. */
function dragTo(physics: DeskPhysics, desk: DeskBodies, id: BodyId, x: number, z: number) {
  const start = { x: desk[id].x, z: desk[id].z };
  expect(physics.grab(id, start.x, start.z)).toBe(true);
  const steps = Math.round(1.5 / FIXED_STEP);
  for (let i = 1; i <= steps; i++) {
    const k = Math.min(1, i / (steps * 0.6));
    physics.aim(start.x + (x - start.x) * k, start.z + (z - start.z) * k);
    physics.stepMany(desk, 1);
  }
  physics.release(false);
  physics.settle(desk);
}

/** Une image de la scène : le metteur en ordre (avant le pas), puis le monde. */
function frame(director: TidyDirector, ctx: TidyContext, physics: DeskPhysics, dt = FIXED_STEP) {
  const report = director.update(ctx, dt);
  physics.advance(dt, ctx.desk);
  return report;
}

function distanceHome(desk: DeskBodies, id: BodyId) {
  const home = homePose(id, false);
  return Math.hypot(desk[id].x - home.x, desk[id].y - home.y, desk[id].z - home.z);
}

describe('le metteur en ordre du bureau', () => {
  it('ramène en douceur un corps tombé, après un délai, à sa place exacte', () => {
    const { physics, desk, director, ctx } = setup();
    dragTo(physics, desk, 'book', -8.5, 1.4);
    expect(desk.book.fallen).toBe(true);
    // Avant le délai, il reste par terre.
    const before = Math.round((FALL_RETURN.delay - 0.2) / FIXED_STEP);
    for (let i = 0; i < before; i++) frame(director, ctx, physics);
    expect(desk.book.fallen).toBe(true);
    expect(director.busy).toBe(false);
    // Puis il rentre : en l'air pendant le trajet, au-dessus du plateau.
    let highest = -Infinity;
    let changed = false;
    for (let i = 0; i < Math.round((0.2 + FALL_RETURN.duration + 1.5) / FIXED_STEP); i++) {
      changed = frame(director, ctx, physics).changed || changed;
      highest = Math.max(highest, desk.book.y);
    }
    expect(changed).toBe(true);
    expect(highest).toBeGreaterThan(0.5);
    expect(desk.book.fallen).toBe(false);
    expect(desk.book.moved).toBe(false);
    // À sa place (un voisin réveillé par l'atterrissage peut le tasser d'un cheveu).
    expect(distanceHome(desk, 'book')).toBeLessThan(MOVED.distance);
    expect(physics.isAwake('book')).toBe(false);
  });

  it('ramène les corps tombés un par un', () => {
    const { physics, desk, director, ctx } = setup();
    dragTo(physics, desk, 'book', -8.5, 1.4);
    dragTo(physics, desk, 'badge', -8.5, 2.6);
    let both = false;
    let flown = new Set<BodyId>();
    for (let i = 0; i < Math.round(12 / FIXED_STEP); i++) {
      frame(director, ctx, physics);
      const flying = (['book', 'badge'] as const).filter((id) => director.isFlying(id));
      if (flying.length > 1) both = true;
      flown = new Set([...flown, ...flying]);
      if (flown.size === 2 && !director.busy && !physics.anyAwake()) break;
    }
    expect(both).toBe(false);
    expect(flown.size).toBe(2);
    expect(desk.book.moved || desk.badge.moved).toBe(false);
  });

  it('ramène un corps tombé tout de suite à sa place en mouvement réduit', () => {
    const { physics, desk, director, ctx } = setup();
    ctx.instant = true;
    dragTo(physics, desk, 'book', -8.5, 1.4);
    for (let i = 0; i < Math.round((FALL_RETURN.delay + 0.1) / FIXED_STEP); i++) {
      frame(director, ctx, physics);
      expect(director.busy).toBe(false);
    }
    expect(distanceHome(desk, 'book')).toBeLessThan(MOVED.distance);
    expect(desk.book.moved).toBe(false);
  });

  it('laisse par terre un corps tombé sous &fige (le monde est arrêté)', () => {
    const { physics, desk, director, ctx } = setup();
    ctx.frozen = true;
    dragTo(physics, desk, 'book', -8.5, 1.4);
    for (let i = 0; i < 400; i++) director.update(ctx, FIXED_STEP);
    expect(desk.book.fallen).toBe(true);
  });

  it('range un bureau dispersé, objet par objet, sans interpénétration', () => {
    const { physics, desk, director, ctx } = setup();
    dragTo(physics, desk, 'laptop', -0.3, 2.15);
    dragTo(physics, desk, 'mug', 4.9, 0);
    dragTo(physics, desk, 'chest', -2, 1.5);
    dragTo(physics, desk, 'lamp', 0, -1);
    const moved = BODY_IDS.filter((id) => desk[id].moved);
    expect(moved.length).toBeGreaterThanOrEqual(4);
    expect(director.tidy(ctx).finished).toBe(false);
    expect(director.tidying).toBe(true);
    // Pas tous à la fois : au début, un seul est parti.
    const before = new Map(moved.map((id) => [id, { ...desk[id] }]));
    for (let i = 0; i < 3; i++) frame(director, ctx, physics);
    const started = moved.filter((id) => {
      const was = before.get(id)!;
      return Math.hypot(desk[id].x - was.x, desk[id].y - was.y, desk[id].z - was.z) > 1e-4;
    });
    expect(started).toHaveLength(1);
    expect(BODY_IDS.filter((id) => director.isFlying(id)).length).toBe(moved.length);
    let finished = false;
    let frames = 3;
    const limit = Math.round((moved.length * TIDY.stagger + TIDY.duration + 1) / FIXED_STEP);
    while (!finished && frames < limit) {
      finished = frame(director, ctx, physics).finished;
      frames += 1;
    }
    expect(finished).toBe(true);
    expect(director.tidying).toBe(false);
    // L'un après l'autre : plus long qu'un seul trajet.
    expect(frames * FIXED_STEP).toBeGreaterThan(TIDY.duration + TIDY.stagger * (moved.length - 1));
    physics.settle(desk);
    for (const id of BODY_IDS) expect(desk[id].moved, id).toBe(false);
    expect(disorderScore(desk, false)).toBe(0);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
    expect(physics.anyAwake()).toBe(false);
  });

  it('range d’un coup en mouvement réduit et sous &fige', () => {
    for (const mode of ['instant', 'frozen'] as const) {
      const { physics, desk, director, ctx } = setup();
      ctx[mode] = true;
      dragTo(physics, desk, 'laptop', -0.3, 2.15);
      dragTo(physics, desk, 'book', -8.5, 1.4);
      const report = director.tidy(ctx);
      expect(report.finished, mode).toBe(true);
      expect(director.busy, mode).toBe(false);
      for (const id of BODY_IDS) expect(desk[id].moved, `${mode} ${id}`).toBe(false);
      expect(physics.anyAwake(), mode).toBe(false);
    }
  });

  it('laisse au visiteur le corps qu’il tient, et pose sur-le-champ celui qu’il présente', () => {
    const { physics, desk, director, ctx, out } = setup();
    dragTo(physics, desk, 'laptop', -0.3, 2.15);
    dragTo(physics, desk, 'card', 3, 2.6);
    dragTo(physics, desk, 'mug', 4.9, 0);
    expect(physics.grab('mug', desk.mug.x, desk.mug.z)).toBe(true);
    director.tidy(ctx);
    expect(director.isFlying('mug')).toBe(false);
    // La carte est présentée pendant le rangement : elle rentre aussitôt.
    frame(director, ctx, physics);
    out.add('card');
    frame(director, ctx, physics);
    expect(director.isFlying('card')).toBe(false);
    expect(desk.card.moved).toBe(false);
    let finished = false;
    for (let i = 0; i < 300 && !finished; i++) finished = frame(director, ctx, physics).finished;
    expect(finished).toBe(true);
    // Le corps tenu n'a pas été repris.
    expect(physics.grabbed).toBe('mug');
    expect(desk.mug.moved).toBe(true);
  });

  it('disperse le bureau avec ?desordre : assez pour proposer le rangement', () => {
    const { physics, desk, director, ctx } = setup();
    ctx.frozen = true;
    director.scatter(ctx);
    // Comme sous &fige dans la scène : chaque image, le monde se pose d'un coup.
    for (let i = 0; i < 3; i++) {
      director.update(ctx, FIXED_STEP);
      physics.settle(desk);
    }
    const score = disorderScore(desk, false);
    expect(score).toBeGreaterThanOrEqual(DISORDER.offer);
    expect(BODY_IDS.some((id) => desk[id].fallen)).toBe(true);
    expect(physics.maxPenetration()).toBeLessThan(0.05);
  });

  it('disperse toujours de la même façon (graine fixe)', () => {
    const a = scatterPoses();
    const b = scatterPoses();
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.size).toBe(BODY_IDS.length);
  });
});
