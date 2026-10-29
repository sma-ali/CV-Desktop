import { describe, expect, it } from 'vitest';
import {
  bodyObb,
  createDeskBodies,
  homePlace,
  obbOutside,
  syncDeskBodies,
  type DeskBodies,
} from '../core/bodies';
import { BODY_IDS, type BodyId } from '../core/ids';
import { rng } from '../core/rng';
import { DESK_WORLD, deskWorld, DRAG, DragSim, type StepOptions } from './drag';
import { moveBody, overlapScore } from './solver';

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

  it('écarte aussitôt un objet qui revient pendant le glisser d’un autre corps', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    const withoutCard = ALL.filter((id) => id !== 'card');
    sim.step(desk, options({ active: withoutCard }));
    sim.begin(desk, 'laptop', desk.laptop.x, desk.laptop.z);
    sim.aimCenter(0.52, 2.1);
    run(sim, desk, 90, { active: withoutCard });
    sim.release(desk, true);
    run(sim, desk, 5, { active: withoutCard });
    const laptop = { x: desk.laptop.x, z: desk.laptop.z };
    // On glisse la tasse, loin de là ; la carte revient pendant ce glisser.
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(4.7, -0.5);
    for (let i = 0; i < 30; i++) {
      sim.step(desk, options());
      expect(overlapScore(desk, ALL, DESK_WORLD)).toBe(0);
    }
    expect(sim.session?.id).toBe('mug');
    expect(desk.laptop).toMatchObject(laptop);
    expect(desk.card.moved).toBe(true);
  });

  it('au repos, ne revérifie pas le plateau à chaque image', () => {
    const desk = createDeskBodies();
    const sim = new DragSim();
    run(sim, desk, 2);
    // Un recouvrement posé à la main, sans que rien ne l'annonce : ignoré.
    desk.mug.x = desk.laptop.x;
    desk.mug.z = desk.laptop.z;
    run(sim, desk, 2);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBeGreaterThan(0);
    // Annoncé (changement de format), il se résout.
    sim.invalidate();
    run(sim, desk, 1);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBe(0);
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

describe('le téléphone qu’on tourne', () => {
  /** Ce que fait une image au changement de format : le socle, puis les gestes. */
  function turn(sim: DragSim, desk: DeskBodies, portrait: boolean) {
    syncDeskBodies(desk, portrait);
    sim.reframe(deskWorld(portrait), desk, portrait);
    return run(sim, desk, 2);
  }

  function expectTidy(desk: DeskBodies, portrait: boolean, label = '') {
    const world = deskWorld(portrait);
    expect(overlapScore(desk, ALL, world), label).toBeLessThan(1e-6);
    for (const id of ALL) {
      expect(obbOutside(bodyObb(id, desk[id]), world.bounds), id).toBeLessThanOrEqual(1e-6);
    }
  }

  it('pose les corps non déplacés à leur place du format, dans les deux sens', () => {
    const desk = createDeskBodies(false);
    const sim = new DragSim();
    run(sim, desk, 1);
    turn(sim, desk, true);
    for (const id of ALL) expect(desk[id]).toMatchObject(homePlace(id, true));
    expectTidy(desk, true);
    turn(sim, desk, false);
    for (const id of ALL) expect(desk[id]).toMatchObject(homePlace(id, false));
    expect(ALL.some((id) => desk[id].moved)).toBe(false);
  });

  it('ramène dans la zone resserrée un corps déplacé loin à droite', () => {
    const desk = createDeskBodies(false);
    const sim = new DragSim();
    sim.begin(desk, 'mug', desk.mug.x, desk.mug.z);
    sim.aim(5.6, -0.3);
    run(sim, desk, 90, { instant: true });
    sim.release(desk, true);
    run(sim, desk, 2);
    expect(desk.mug.x).toBeGreaterThan(deskWorld(true).bounds.x1);
    const { settled } = turn(sim, desk, true);
    expect(settled).toBe(true);
    expect(desk.mug.moved).toBe(true);
    expectTidy(desk, true);
    // Les autres n'ont pas bougé de leur place portrait.
    for (const id of ALL.filter((id) => id !== 'mug')) {
      expect(desk[id], id).toMatchObject(homePlace(id, true));
    }
    // Retour en paysage : la tasse garde sa place, rien ne se chevauche.
    // Retour en paysage : la tasse reste déplacée, près de sa place portrait
    // (écartée de la souris, qui est là en paysage), et rien ne se chevauche.
    const { x, z } = desk.mug;
    turn(sim, desk, false);
    expect(desk.mug.moved).toBe(true);
    expect(Math.hypot(desk.mug.x - x, desk.mug.z - z)).toBeLessThan(0.8);
    expectTidy(desk, false);
  });

  it('reste en ordre après des glissers au hasard et des tours répétés', () => {
    const random = rng(41);
    const desk = createDeskBodies(false);
    const sim = new DragSim();
    let portrait = false;
    for (let round = 0; round < 12; round++) {
      const world = deskWorld(portrait);
      for (let i = 0; i < 4; i++) {
        const id = ALL[Math.floor(random() * ALL.length)]!;
        moveBody(
          desk,
          id,
          world.bounds.x0 + random() * (world.bounds.x1 - world.bounds.x0),
          world.bounds.z0 + random() * (world.bounds.z1 - world.bounds.z0),
          ALL,
          world,
        );
      }
      expectTidy(desk, portrait, `tour ${round}, avant`);
      const untouched = ALL.filter((id) => !desk[id].moved);
      portrait = !portrait;
      turn(sim, desk, portrait);
      expectTidy(desk, portrait, `tour ${round}, après`);
      // Un corps que personne n'a déplacé est à sa place du format, sauf
      // s'il a fallu l'écarter (il compte alors comme déplacé).
      for (const id of untouched) {
        if (!desk[id].moved) expect(desk[id], id).toMatchObject(homePlace(id, portrait));
      }
    }
  });
});
