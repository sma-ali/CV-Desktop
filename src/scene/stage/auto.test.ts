import { describe, expect, it } from 'vitest';
import { AUTO_SEQ, AUTO_START, AUTO_TIMING, IDLE_DELAY } from '../core/constants';
import type { ItemId } from '../core/ids';
import type { PresentSource } from '../core/store';
import {
  autoWanted,
  createAutoTour,
  holdDuration,
  resetAutoTour,
  stepAutoTour,
  type AutoTourCommand,
  type AutoTourInput,
} from './auto';

// Un petit store simulé : applique les ordres de la visite comme AutoTour.
function simulate({
  from = 0,
  to,
  allowed = true,
  lastUserAt = -Infinity,
  dt = 1 / 30,
  onFrame,
}: {
  from?: number;
  to: number;
  allowed?: boolean;
  lastUserAt?: number;
  dt?: number;
  onFrame?: (t: number, world: World) => void;
}) {
  const tour = createAutoTour();
  const world: World = { presented: null, presentedBy: null, autoOn: false, lastUserAt, log: [] };
  for (let t = from; t <= to; t += dt) {
    onFrame?.(t, world);
    const input: AutoTourInput = {
      t,
      allowed,
      lastUserAt: world.lastUserAt,
      presented: world.presented,
      presentedBy: world.presentedBy,
    };
    const command = stepAutoTour(tour, input);
    if (command) apply(world, command, t);
  }
  return world;
}

interface World {
  presented: ItemId | null;
  presentedBy: PresentSource | null;
  autoOn: boolean;
  lastUserAt: number;
  log: { t: number; command: AutoTourCommand }[];
}

function apply(world: World, command: AutoTourCommand, t: number) {
  world.log.push({ t, command });
  if (command.type === 'start') world.autoOn = true;
  if (command.type === 'stop') {
    world.autoOn = false;
    if (world.presentedBy === 'auto') world.presented = world.presentedBy = null;
  }
  if (command.type === 'present') {
    world.presented = command.item;
    world.presentedBy = 'auto';
  }
  if (command.type === 'putBack' && world.presentedBy === 'auto') {
    world.presented = world.presentedBy = null;
  }
}

/** markUser() du store. */
function userAction(world: World, t: number) {
  world.lastUserAt = t;
  world.autoOn = false;
  if (world.presentedBy === 'auto') world.presented = world.presentedBy = null;
}

const presentedItems = (world: World) =>
  world.log.flatMap(({ command }) => (command.type === 'present' ? [command.item] : []));

describe('la visite automatique', () => {
  it('démarre à AUTO_START et présente les objets dans l’ordre', () => {
    const world = simulate({ to: 70 });
    const first = world.log[0];
    expect(first?.command.type).toBe('start');
    expect(first?.t).toBeGreaterThanOrEqual(AUTO_START);
    expect(first?.t).toBeLessThan(AUTO_START + 0.05);
    expect(presentedItems(world).slice(0, AUTO_SEQ.length)).toEqual([...AUTO_SEQ]);
  });

  it('tient chaque objet le temps prévu, puis marque une pause', () => {
    const world = simulate({ to: 40 });
    const presents = world.log.filter(({ command }) => command.type === 'present');
    const putBacks = world.log.filter(({ command }) => command.type === 'putBack');
    const [book, postit] = presents;
    const [bookBack] = putBacks;
    expect(book && bookBack).toBeTruthy();
    expect(bookBack!.t - book!.t).toBeCloseTo(holdDuration('book'), 1);
    expect(postit!.t - bookBack!.t).toBeCloseTo(AUTO_TIMING.gap, 1);
    expect(holdDuration('chest')).toBe(AUTO_TIMING.hold.chest);
    expect(holdDuration('laptop')).toBe(AUTO_TIMING.hold.default);
  });

  it('reprend la boucle au début après une pause plus longue', () => {
    const world = simulate({ to: 80 });
    const items = presentedItems(world);
    expect(items.length).toBeGreaterThan(AUTO_SEQ.length);
    expect(items[AUTO_SEQ.length]).toBe(AUTO_SEQ[0]);
    const chestBack = world.log.filter(({ command }) => command.type === 'putBack')[
      AUTO_SEQ.length - 1
    ];
    const restart = world.log.filter(({ command }) => command.type === 'present')[AUTO_SEQ.length];
    expect(restart!.t - chestBack!.t).toBeCloseTo(AUTO_TIMING.loopPause, 1);
  });

  it('s’arrête à la première action du visiteur et reprend après IDLE_DELAY', () => {
    const actionAt = 15;
    let acted = false;
    const world = simulate({
      to: 40,
      onFrame: (t, w) => {
        if (!acted && t >= actionAt) {
          acted = true;
          userAction(w, t);
        }
      },
    });
    const stop = world.log.find(({ command }) => command.type === 'stop');
    expect(stop?.t).toBeGreaterThanOrEqual(actionAt);
    expect(stop!.t).toBeLessThan(actionAt + 0.1);
    const restart = world.log.find(({ command, t }) => command.type === 'start' && t > actionAt);
    expect(restart!.t - actionAt).toBeGreaterThan(IDLE_DELAY);
    expect(restart!.t - actionAt).toBeLessThan(IDLE_DELAY + 0.1);
    // Le premier objet après la reprise arrive AUTO_TIMING.resume plus tard.
    const next = world.log.find(({ command, t }) => command.type === 'present' && t > restart!.t);
    expect(next!.t - restart!.t).toBeCloseTo(AUTO_TIMING.resume, 1);
  });

  it('ne démarre pas quand le visiteur tient un objet', () => {
    const world = simulate({
      to: 40,
      onFrame: (_t, w) => {
        w.presented = 'card';
        w.presentedBy = 'click';
      },
    });
    expect(world.log).toEqual([]);
  });

  it('ne démarre jamais avec ?auto=0, en mouvement réduit ou avec ?prendre=', () => {
    expect(simulate({ to: 40, allowed: false }).log).toEqual([]);
    expect(simulate({ to: 40, lastUserAt: Infinity }).log).toEqual([]);
  });

  it('autoWanted suit les règles de la visite', () => {
    const input = {
      t: AUTO_START,
      allowed: true,
      lastUserAt: -Infinity,
      presented: null,
      presentedBy: null,
    };
    expect(autoWanted(input)).toBe(true);
    expect(autoWanted({ ...input, t: AUTO_START - 0.01 })).toBe(false);
    expect(autoWanted({ ...input, t: 30, lastUserAt: 30 - IDLE_DELAY })).toBe(false);
    expect(autoWanted({ ...input, t: 30, lastUserAt: 30 - IDLE_DELAY - 0.01 })).toBe(true);
    expect(autoWanted({ ...input, presented: 'book', presentedBy: 'auto' })).toBe(true);
    expect(autoWanted({ ...input, presented: 'monitor', presentedBy: 'chip' })).toBe(false);
  });

  it('Rejouer remet la visite au premier objet', () => {
    const tour = createAutoTour();
    tour.on = true;
    tour.index = 3;
    tour.step = 'hold';
    tour.next = 99;
    expect(resetAutoTour(tour)).toEqual(createAutoTour());
  });
});
