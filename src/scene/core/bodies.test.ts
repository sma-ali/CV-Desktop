import { describe, expect, it } from 'vitest';
import { decorObstacles } from '../decor/obstacles';
import {
  BODY_FOOTPRINTS,
  bodyHidden,
  bodyObb,
  createDeskBodies,
  fallenIds,
  FOOTPRINT_IDS,
  homePose,
  isMoved,
  fixedItemObstacles,
  formatPlaces,
  homePlace,
  movedPlaces,
  obbCorners,
  obbOutside,
  obbPenetration,
  resetDeskBodies,
  syncDeskBodies,
  yawOf,
  type Obb,
} from './bodies';
import { BOUNDS, BOUNDS_PORTRAIT, deskBounds, headsetPose, ITEM_POSES } from './constants';
import { BODY_IDS, ITEM_BODY_IDS, ITEM_IDS } from './ids';

// La disposition du plateau vue de dessus : chaque corps glissable et
// chaque obstacle fixe a son rectangle, et rien ne se chevauche au repos,
// en paysage comme en portrait.

/** Écart minimal entre deux encombrements au repos. */
const GAP = 0.02;

describe.each([
  ['paysage', false],
  ['portrait', true],
] as const)('la disposition en %s', (_, portrait) => {
  const bodies = FOOTPRINT_IDS.map((id) => ({ id, box: bodyObb(id, homePlace(id, portrait)) }));
  // Le décor et les objets fixes du format (le bureau resserré en portrait).
  const obstacles = [...decorObstacles(portrait), ...fixedItemObstacles(portrait)];

  it('garde chaque corps dans les limites du plateau du format', () => {
    const bounds = deskBounds(portrait);
    for (const { id, box } of bodies) expect(obbOutside(box, bounds), id).toBeLessThanOrEqual(0);
  });

  it('ne pose aucun obstacle fixe sur un autre (écart minimal du décor : 0)', () => {
    for (const [i, a] of obstacles.entries()) {
      for (const b of obstacles.slice(i + 1)) {
        expect(obbPenetration(a, b), `${a.id} / ${b.id}`).toBe(0);
      }
    }
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

describe('le bureau resserré du portrait', () => {
  it('range les corps sur une zone plus étroite et plus profonde que le paysage', () => {
    expect(BOUNDS_PORTRAIT.x1 - BOUNDS_PORTRAIT.x0).toBeLessThan((BOUNDS.x1 - BOUNDS.x0) * 0.65);
    expect(BOUNDS_PORTRAIT.z1 - BOUNDS_PORTRAIT.z0).toBeGreaterThan(BOUNDS.z1 - BOUNDS.z0);
    const span = (portrait: boolean) => {
      const xs = FOOTPRINT_IDS.flatMap((id) =>
        obbCorners(bodyObb(id, homePlace(id, portrait))).map(([x]) => x),
      );
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(true)).toBeLessThan(span(false) * 0.7);
  });

  it('ne change rien au paysage', () => {
    expect(deskBounds(false)).toBe(BOUNDS);
    expect(fixedItemObstacles(false).map(({ id }) => id)).toEqual([
      'monitor-stand',
      'headset-stand',
    ]);
  });

  it('pose le support du casque à droite de l’écran', () => {
    const stand = fixedItemObstacles(true).find(({ id }) => id === 'headset-stand');
    expect(stand?.x).toBeGreaterThan(2.8);
  });
});

describe('les corps du plateau', () => {
  it('reprennent les poses des objets du CV', () => {
    for (const id of ITEM_BODY_IDS) {
      const { x, y, z, ry } = id === 'headset' ? headsetPose(false) : ITEM_POSES[id];
      expect(homePose(id, false)).toEqual({ x, y, z, ry });
    }
    for (const id of FOOTPRINT_IDS) expect(BODY_FOOTPRINTS[id].hw).toBeGreaterThan(0);
    // Seuls le post-it (collé à l'écran) et l'écran ne sont pas des corps.
    expect(ITEM_IDS.filter((id) => !(BODY_IDS as readonly string[]).includes(id))).toEqual([
      'postit',
      'monitor',
    ]);
  });

  it('cachent en portrait le décor qui n’a pas de place, jamais un objet du CV', () => {
    for (const id of ITEM_BODY_IDS) expect(bodyHidden(id, true)).toBe(false);
    for (const id of BODY_IDS) expect(bodyHidden(id, false)).toBe(false);
    expect(BODY_IDS.filter((id) => bodyHidden(id, true))).toEqual([
      'manga',
      'fox',
      'wanderer',
      'rope',
      'wraps',
    ]);
  });

  it('suivent le format tant que personne ne les a déplacés', () => {
    const desk = createDeskBodies(false);
    desk.book.x = 1;
    desk.book.moved = true;
    desk.chest.x = 3;
    syncDeskBodies(desk, true);
    expect(desk.chest).toMatchObject(homePose('chest', true));
    expect(desk.book.x).toBe(1);
    expect(movedPlaces(desk)).toEqual({ book: { x: 1, z: desk.book.z, ry: desk.book.ry } });
    expect(desk.rope.hidden).toBe(true);
    resetDeskBodies(desk, false);
    expect(desk.book).toMatchObject({ ...homePose('book', false), moved: false, fallen: false });
    expect(desk.rope.hidden).toBe(false);
    expect(movedPlaces(desk)).toEqual({});
  });

  it('portent une orientation complète, droite au repos', () => {
    const desk = createDeskBodies(false);
    const { book } = desk;
    expect(yawOf(book.qx, book.qy, book.qz, book.qw)).toBeCloseTo(ITEM_POSES.book.ry);
    expect(isMoved(book, homePose('book', false))).toBe(false);
    // Renversé sur place : il a bougé.
    Object.assign(book, { qx: Math.SQRT1_2, qy: 0, qz: 0, qw: Math.SQRT1_2 });
    expect(isMoved(book, homePose('book', false))).toBe(true);
  });

  it('listent les corps tombés', () => {
    const desk = createDeskBodies(false);
    desk.mug.fallen = true;
    expect(fallenIds(desk)).toEqual(['mug']);
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
