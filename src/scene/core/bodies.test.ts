import { describe, expect, it } from 'vitest';
import { DECOR_OBSTACLES } from '../decor/layout';
import {
  BODY_FOOTPRINTS,
  bodyObb,
  createDeskBodies,
  FIXED_ITEM_OBSTACLES,
  formatPlaces,
  homePlace,
  movedPlaces,
  obbCorners,
  obbOutside,
  obbPenetration,
  resetDeskBodies,
  syncDeskBodies,
  type Obb,
} from './bodies';
import { BOUNDS, ITEM_POSES } from './constants';
import { BODY_IDS, ITEM_IDS } from './ids';

// La disposition du plateau vue de dessus : chaque corps glissable et
// chaque obstacle fixe a son rectangle, et rien ne se chevauche au repos,
// en paysage comme en portrait.

/** Écart minimal entre deux encombrements au repos. */
const GAP = 0.02;

const obstacles = [...DECOR_OBSTACLES, ...FIXED_ITEM_OBSTACLES];

describe.each([
  ['paysage', false],
  ['portrait', true],
] as const)('la disposition en %s', (_, portrait) => {
  const bodies = BODY_IDS.map((id) => ({ id, box: bodyObb(id, homePlace(id, portrait)) }));

  it('garde chaque corps dans les limites du plateau', () => {
    for (const { id, box } of bodies) expect(obbOutside(box, BOUNDS), id).toBeLessThanOrEqual(0);
  });

  it('ne pose aucun corps sur le décor ni sur l’écran ou le casque', () => {
    for (const { id, box } of bodies) {
      for (const obstacle of obstacles) {
        expect(obbPenetration(box, obstacle, GAP), `${id} / ${obstacle.id}`).toBe(0);
      }
    }
  });

  it('ne pose aucun corps sur un autre', () => {
    for (const [i, a] of bodies.entries()) {
      for (const b of bodies.slice(i + 1)) {
        expect(obbPenetration(a.box, b.box, GAP), `${a.id} / ${b.id}`).toBe(0);
      }
    }
  });
});

describe('les corps du plateau', () => {
  it('reprennent les poses des objets du CV', () => {
    for (const id of BODY_IDS) {
      if (id === 'mug' || id === 'pad') continue;
      const { x, z, ry } = ITEM_POSES[id];
      expect(homePlace(id, false)).toEqual({ x, z, ry });
      expect(BODY_FOOTPRINTS[id].hw).toBeGreaterThan(0);
    }
    // Le post-it, le casque et l'écran ne glissent pas.
    expect(ITEM_IDS.filter((id) => !(BODY_IDS as readonly string[]).includes(id))).toEqual([
      'postit',
      'headset',
      'monitor',
    ]);
  });

  it('suivent le format tant que personne ne les a déplacés', () => {
    const desk = createDeskBodies(false);
    desk.book.x = 1;
    desk.book.moved = true;
    desk.chest.x = 3;
    syncDeskBodies(desk, true);
    expect(desk.chest).toMatchObject(homePlace('chest', true));
    expect(desk.book.x).toBe(1);
    expect(movedPlaces(desk)).toEqual({ book: { x: 1, z: desk.book.z, ry: desk.book.ry } });
    resetDeskBodies(desk, false);
    expect(desk.book).toMatchObject({ ...homePlace('book', false), moved: false, lift: 0 });
    expect(movedPlaces(desk)).toEqual({});
  });

  it('écrivent leurs places pour data-places', () => {
    expect(formatPlaces({ laptop: { x: -0.3, z: 2.154, ry: -0.12 } })).toBe(
      'laptop:-0.30,2.15,-0.12',
    );
    expect(formatPlaces({})).toBe('');
  });
});

describe('les rectangles orientés', () => {
  const unit: Obb = { x: 0, z: 0, ry: 0, hw: 1, hd: 1 };

  it('tournent comme three autour de y', () => {
    const corners = obbCorners({ x: 0, z: 0, ry: Math.PI / 2, hw: 2, hd: 1 });
    // Un quart de tour : l'axe local x part vers -z.
    expect(corners[1]?.[0]).toBeCloseTo(-1);
    expect(corners[1]?.[1]).toBeCloseTo(-2);
  });

  it('mesurent leur chevauchement', () => {
    expect(obbPenetration(unit, { ...unit, x: 1.5 })).toBeCloseTo(0.5);
    expect(obbPenetration(unit, { ...unit, x: 2.5 })).toBe(0);
    // Tourné de 45°, le coin avance de racine de 2 : il touche à 2.3.
    expect(obbPenetration(unit, { ...unit, x: 2.3, ry: Math.PI / 4 })).toBeGreaterThan(0);
    expect(obbPenetration(unit, { ...unit, x: 2.5, ry: Math.PI / 4 })).toBe(0);
    expect(obbPenetration(unit, { ...unit, x: 2.05 }, 0.1)).toBeCloseTo(0.05);
  });

  it('suivent le décalage de leur encombrement', () => {
    const box = bodyObb('chest', { x: 0, z: 0, ry: 0 });
    expect(box.z).toBeCloseTo(BODY_FOOTPRINTS.chest.cz);
  });
});
