import { describe, expect, it } from 'vitest';
import { createDeskBodies, type DeskBodies } from '../core/bodies';
import { BODY_IDS, type BodyId } from '../core/ids';
import { DESK_WORLD, DRAG, DragSim, type StepOptions } from './drag';
import { overlapScore } from './solver';

// Le glisser image par image : retard sur la main, soulèvement,
// inclinaison selon la vitesse, retombée avec rebond et choc, poussée des
// voisins, mouvement réduit et horloge gelée.

const ALL: readonly BodyId[] = BODY_IDS;
const options = (patch: Partial<StepOptions> = {}): StepOptions => ({
  dt: 1 / 60,
  active: ALL,
  reduced: false,
  instant: false,
  ...patch,
});

function run(sim: DragSim, desk: DeskBodies, frames: number, patch: Partial<StepOptions> = {}) {
  const thuds: number[] = [];
  let settled = false;
  for (let i = 0; i < frames; i++) {
    const events = sim.step(desk, options(patch));
    thuds.push(...events.thuds);
    settled ||= events.settled;
  }
  return { thuds, settled };
}

describe('DragSim', () => {
  it('suit la main avec un peu de retard, au décalage de prise près', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    // Prise à 0.2 à droite du centre de la tasse.
    sim.begin(desk, 'mug', desk.mug.x + 0.2, desk.mug.z);
    sim.aim(5.1, -0.05);
    sim.step(desk, options());
    // Une image : elle a fait une grande part du chemin, pas tout.
    expect(desk.mug.x).toBeGreaterThan(4.55);
    expect(desk.mug.x).toBeLessThan(4.9);
    run(sim, desk, 60);
    expect(desk.mug.x).toBeCloseTo(4.9, 3);
    expect(desk.mug.z).toBeCloseTo(-0.05, 3);
    expect(desk.mug.moved).toBe(true);
  });

  it('soulève et incline le corps glissé selon sa vitesse', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(5.1, 0.4);
    sim.step(desk, options());
    // Vers la droite : penché autour de z ; vers l'avant : autour de x.
    expect(desk.mug.tiltZ).toBeLessThan(0);
    expect(desk.mug.tiltX).toBeGreaterThan(0);
    expect(Math.abs(desk.mug.tiltZ)).toBeLessThanOrEqual(DRAG.maxTilt);
    run(sim, desk, 90);
    expect(desk.mug.lift).toBeCloseTo(DRAG.lift, 2);
    // Immobile sous la main : plus d'inclinaison.
    expect(Math.abs(desk.mug.tiltZ)).toBeLessThan(1e-3);
  });

  it('lâché, retombe, rebondit une fois en s’écrasant et fait sonner le choc', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(5, 0.2);
    run(sim, desk, 60);
    expect(sim.release(desk, false)).toBe('mug');
    let squashed = false;
    const thuds: number[] = [];
    for (let i = 0; i < 120; i++) {
      thuds.push(...sim.step(desk, options()).thuds);
      squashed ||= desk.mug.squash > 0.9;
    }
    expect(squashed).toBe(true);
    expect(thuds.length).toBeGreaterThanOrEqual(1);
    for (const strength of thuds) {
      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1);
    }
    expect(desk.mug).toMatchObject({ lift: 0, tiltX: 0, tiltZ: 0, squash: 0 });
  });

  it('en mouvement réduit : suit sans retard, sans inclinaison ni rebond', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(5, 0.2);
    sim.step(desk, options({ reduced: true }));
    expect(desk.mug.x).toBeCloseTo(5, 6);
    expect(desk.mug).toMatchObject({ tiltX: 0, tiltZ: 0 });
    sim.release(desk, true);
    const { thuds } = run(sim, desk, 30, { reduced: true });
    expect(thuds).toEqual([]);
    expect(desk.mug).toMatchObject({ lift: 0, squash: 0 });
  });

  it('sous horloge gelée, va droit à la cible sans s’incliner', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'laptop', desk.laptop.x, desk.laptop.z);
    sim.aimCenter(-0.3, 2.15);
    sim.step(desk, options({ instant: true }));
    expect(desk.laptop).toMatchObject({ tiltX: 0, tiltZ: 0 });
    expect(desk.laptop.x).toBeLessThan(2.95);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBe(0);
  });

  it('bute une seule fois par contact : un choc, puis le silence', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'pad', desk.pad.x, desk.pad.z);
    sim.aim(9, desk.pad.z);
    const { thuds } = run(sim, desk, 60);
    expect(thuds).toEqual([0.5]);
    expect(desk.pad.squash).toBeLessThan(0.6);
  });

  it('fait sauter un peu les corps qu’il pousse', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'laptop', desk.laptop.x, desk.laptop.z);
    sim.aimCenter(-0.3, 2.15);
    let hopped = false;
    for (let i = 0; i < 40; i++) {
      const { settled } = sim.step(desk, options());
      if (settled) hopped ||= desk.card.lift > 0;
    }
    expect(desk.card.moved).toBe(true);
    expect(hopped).toBe(true);
  });

  it('écarte un objet reposé sur une place prise pendant sa présentation', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    const withoutCard = ALL.filter((id) => id !== 'card');
    // La carte est présentée (hors du plateau) : le portable prend sa place.
    sim.step(desk, options({ active: withoutCard }));
    sim.begin(desk, 'laptop', desk.laptop.x, desk.laptop.z);
    sim.aimCenter(0.52, 2.1);
    run(sim, desk, 90, { active: withoutCard });
    sim.release(desk, true);
    const laptop = { x: desk.laptop.x, z: desk.laptop.z };
    // La carte revient : c'est elle qui trouve une autre place.
    const { settled } = run(sim, desk, 1);
    expect(settled).toBe(true);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBe(0);
    expect(desk.laptop).toMatchObject(laptop);
    expect(desk.card.moved).toBe(true);
  });

  it('s’arrête net (Rejouer) et pose tout à plat', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(5, 0.2);
    run(sim, desk, 10);
    sim.cancel(desk);
    sim.settle(desk);
    expect(sim.session).toBeNull();
    expect(desk.mug).toMatchObject({ lift: 0, tiltX: 0, tiltZ: 0, squash: 0 });
    const { thuds } = run(sim, desk, 30);
    expect(thuds).toEqual([]);
  });

  it('ignore une main qui n’est pas un nombre', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(Number.NaN, 0);
    run(sim, desk, 10);
    expect(Number.isFinite(desk.mug.x)).toBe(true);
    expect(desk.mug.x).toBeCloseTo(4.55, 6);
  });
});
