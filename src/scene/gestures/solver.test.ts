import { describe, expect, it } from 'vitest';
import {
  bodyObb,
  createDeskBodies,
  obbOutside,
  obbPenetration,
  type DeskBodies,
  type Obb,
} from '../core/bodies';
import { BOUNDS } from '../core/constants';
import { BODY_IDS, type BodyId } from '../core/ids';
import { rng } from '../core/rng';
import { DESK_WORLD } from './drag';
import {
  intoBounds,
  moveBody,
  overlapScore,
  relax,
  separate,
  settleBodies,
  type SolverWorld,
} from './solver';

// Le solveur des collisions : rectangles orientés, poussée en chaîne,
// décor et bords qui bloquent, aucun recouvrement laissé, aucun tunnel,
// aucun NaN. Tout est déterministe : mêmes entrées, mêmes places.

const ALL: readonly BodyId[] = BODY_IDS;

/** Aucun recouvrement (au-delà des arrondis) entre corps, avec le décor, hors des bords. */
function expectValid(desk: DeskBodies, active: readonly BodyId[] = ALL, label = '') {
  for (const id of active) {
    expect(Number.isFinite(desk[id].x) && Number.isFinite(desk[id].z), `${label} ${id} NaN`).toBe(
      true,
    );
  }
  for (const [i, a] of active.entries()) {
    const boxA = bodyObb(a, desk[a]);
    expect(obbOutside(boxA, BOUNDS), `${label} ${a} hors du plateau`).toBeLessThanOrEqual(1e-6);
    for (const obstacle of DESK_WORLD.obstacles) {
      expect(
        obbPenetration(boxA, obstacle),
        `${label} ${a} / ${(obstacle as Obb & { id: string }).id}`,
      ).toBeLessThan(1e-4);
    }
    for (const b of active.slice(i + 1)) {
      expect(obbPenetration(boxA, bodyObb(b, desk[b])), `${label} ${a} / ${b}`).toBeLessThan(1e-4);
    }
  }
}

describe('separate', () => {
  it('s’accorde avec l’axe séparateur du socle, et sa poussée sépare', () => {
    const random = rng(7);
    for (let i = 0; i < 400; i++) {
      const box = (): Obb => ({
        x: random() * 3 - 1.5,
        z: random() * 3 - 1.5,
        ry: random() * Math.PI * 2,
        hw: 0.1 + random(),
        hd: 0.1 + random(),
      });
      const a = box();
      const b = box();
      const hit = separate(a, b);
      const depth = obbPenetration(a, b);
      if (depth === 0) {
        expect(hit).toBeNull();
        continue;
      }
      // Le socle mesure le recouvrement des projections ; la séparation est
      // la poussée qui les écarte, au moins aussi longue (un rectangle peut
      // en déborder un autre des deux côtés).
      expect(hit!.depth).toBeGreaterThanOrEqual(depth - 1e-9);
      a.x += hit!.nx * (hit!.depth + 1e-6);
      a.z += hit!.nz * (hit!.depth + 1e-6);
      expect(obbPenetration(a, b)).toBe(0);
    }
  });

  it('pousse le premier rectangle hors du second, le long de l’axe le plus court', () => {
    const a: Obb = { x: 0.9, z: 0, ry: 0, hw: 0.5, hd: 0.5 };
    const b: Obb = { x: 0, z: 0, ry: 0, hw: 0.5, hd: 2 };
    const hit = separate(a, b)!;
    expect(hit.depth).toBeCloseTo(0.1);
    expect(hit.nx).toBeCloseTo(1);
    expect(hit.nz).toBeCloseTo(0);
    a.x += hit.nx * hit.depth;
    expect(separate(a, b)).toBeNull();
  });

  it('tient compte de la rotation : deux carrés tournés de 45° se touchent par la pointe', () => {
    const a: Obb = { x: 0, z: 0, ry: Math.PI / 4, hw: 0.5, hd: 0.5 };
    const b: Obb = { x: 1.2, z: 0, ry: 0, hw: 0.5, hd: 0.5 };
    // La pointe de a va jusqu'à x = 0.707 : elle entre dans b (qui commence à 0.7).
    expect(separate(a, b)?.depth).toBeCloseTo(Math.SQRT1_2 - 0.7, 6);
    b.x = 1.22;
    expect(separate(a, b)).toBeNull();
    // Sans rotation, ils seraient écartés.
    expect(separate({ ...a, ry: 0 }, { ...b, x: 1.2 })).toBeNull();
  });

  it('ajoute la marge demandée', () => {
    const a: Obb = { x: 0, z: 0, ry: 0, hw: 0.5, hd: 0.5 };
    const b: Obb = { x: 1.005, z: 0, ry: 0, hw: 0.5, hd: 0.5 };
    expect(separate(a, b)).toBeNull();
    expect(separate(a, b, 0.01)?.depth).toBeCloseTo(0.005);
  });
});

describe('intoBounds', () => {
  it('ramène un rectangle tourné dans les limites', () => {
    const box: Obb = { x: 6.1, z: 3, ry: 0.6, hw: 0.8, hd: 0.5 };
    const [dx, dz] = intoBounds(box, BOUNDS);
    expect(dx).toBeLessThan(0);
    expect(dz).toBeLessThan(0);
    expect(obbOutside({ ...box, x: box.x + dx, z: box.z + dz }, BOUNDS)).toBeLessThanOrEqual(1e-9);
    expect(intoBounds({ ...box, x: 0, z: 0 }, BOUNDS)).toEqual([0, 0]);
  });
});

describe('le plateau au repos', () => {
  it.each([false, true])('n’a aucun recouvrement (portrait : %s)', (portrait) => {
    const desk = createDeskBodies(portrait);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBe(0);
    expectValid(desk);
    // La relaxation ne déplace rien qui n'en a pas besoin.
    expect(relax(desk, ALL, DESK_WORLD)).toEqual([]);
    expect(BODY_IDS.some((id) => desk[id].moved)).toBe(false);
  });
});

describe('moveBody', () => {
  it('glisse librement un corps sur une place libre', () => {
    const desk = createDeskBodies();
    const result = moveBody(desk, 'mug', 4.9, 0, ALL, DESK_WORLD);
    expect(result.blocked).toBe(false);
    expect(desk.mug.x).toBeCloseTo(4.9, 9);
    expect(desk.mug.z).toBeCloseTo(0, 9);
    expect(desk.mug.moved).toBe(true);
    expect(result.pushed.size).toBe(0);
    expectValid(desk);
  });

  it('le portable poussé sur la carte ne la chevauche jamais (?glisse du prototype)', () => {
    const desk = createDeskBodies();
    moveBody(desk, 'laptop', -0.3, 2.15, ALL, DESK_WORLD);
    expectValid(desk, ALL, '?glisse');
    expect(obbPenetration(bodyObb('laptop', desk.laptop), bodyObb('card', desk.card))).toBe(0);
    // La carte a été poussée devant le portable, et marquée déplacée.
    expect(desk.card.moved).toBe(true);
    expect(desk.card.x).toBeLessThan(0.52);
    expect(desk.laptop.x).toBeLessThan(2.95);
  });

  it('pousse en chaîne : le portable pousse la carte qui pousse le badge', () => {
    const desk = createDeskBodies();
    const result = moveBody(desk, 'laptop', -1.5, 2.1, ALL, DESK_WORLD);
    expectValid(desk);
    expect(result.pushed.has('card')).toBe(true);
    expect(desk.badge.moved).toBe(true);
    expect(desk.badge.x).toBeLessThan(-1.25);
  });

  it('arrête un corps contre un obstacle sans le traverser, même d’un seul grand pas', () => {
    const desk = createDeskBodies();
    // La carte part vers le fond, à travers le bocal et le clavier.
    const result = moveBody(desk, 'card', 0.52, -2.0, ALL, DESK_WORLD);
    expect(result.blocked).toBe(true);
    expectValid(desk);
    // Elle reste devant le clavier (qui finit en z = 0.14).
    expect(desk.card.z - 0.5).toBeGreaterThan(0.14);
  });

  it('ne passe pas à travers un obstacle mince à grande vitesse', () => {
    const world: SolverWorld = {
      obstacles: [{ x: 0, z: 0, ry: 0, hw: 0.05, hd: 3 }],
      bounds: { x0: -6, x1: 6, z0: -4, z1: 4 },
    };
    const desk = createDeskBodies();
    Object.assign(desk.mug, { x: -2, z: 0 });
    moveBody(desk, 'mug', 5, 0, ['mug'], world);
    expect(desk.mug.x).toBeLessThan(0);
    expect(overlapScore(desk, ['mug'], world)).toBe(0);
  });

  it('glisse le long d’un mur au lieu de s’y coller', () => {
    const world: SolverWorld = { obstacles: [], bounds: { x0: -3, x1: 3, z0: -3, z1: 3 } };
    const desk = createDeskBodies();
    Object.assign(desk.mug, { x: 0, z: 0 });
    // Tirée vers la gauche et un peu vers l'avant : elle bute sur le bord
    // gauche mais continue vers l'avant.
    const result = moveBody(desk, 'mug', -9, 0.6, ['mug'], world);
    expect(result.blocked).toBe(true);
    expect(desk.mug.z).toBeCloseTo(0.6, 6);
    expect(obbOutside(bodyObb('mug', desk.mug), world.bounds)).toBeCloseTo(0, 6);
  });

  it('coince un corps dans un coin sans le faire sortir du plateau', () => {
    const desk = createDeskBodies();
    for (const [x, z] of [
      [9, 9],
      [-9, 9],
      [9, -9],
      [-9, -9],
    ] as const) {
      moveBody(desk, 'pad', x, z, ALL, DESK_WORLD);
      expectValid(desk, ALL, `coin ${x},${z}`);
    }
    // Revenu au coin avant droit, libre : la manette s'y cale contre les deux bords.
    moveBody(desk, 'pad', 9, 9, ALL, DESK_WORLD);
    expectValid(desk);
    expect(obbOutside(bodyObb('pad', desk.pad), BOUNDS)).toBeGreaterThan(-0.05);
  });

  it('un corps poussé contre un bord bloque celui qui pousse', () => {
    const world: SolverWorld = { obstacles: [], bounds: { x0: -3, x1: 3, z0: -3, z1: 3 } };
    const desk = createDeskBodies();
    Object.assign(desk.pad, { x: 0, z: 0, ry: 0 });
    Object.assign(desk.mug, { x: -2, z: 0 });
    moveBody(desk, 'pad', 9, 0, ['pad'], world);
    const padX = desk.pad.x;
    expect(padX).toBeCloseTo(3 - 0.68, 6);
    // La tasse pousse la manette, déjà au bord : elle s'arrête contre elle.
    const result = moveBody(desk, 'mug', 9, 0, ['mug', 'pad'], world);
    expect(result.blocked).toBe(true);
    expect(desk.pad.x).toBeCloseTo(padX, 6);
    expect(overlapScore(desk, ['mug', 'pad'], world)).toBe(0);
    // Arrêtée à moins d'un dixième de pas du contact.
    const gap = desk.pad.x - 0.68 - (desk.mug.x + 0.08 + 0.4);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(0.03);
  });

  it('garde la rotation de chaque corps', () => {
    const desk = createDeskBodies();
    const before = BODY_IDS.map((id) => desk[id].ry);
    moveBody(desk, 'laptop', -0.3, 2.15, ALL, DESK_WORLD);
    moveBody(desk, 'book', 3, -2, ALL, DESK_WORLD);
    expect(BODY_IDS.map((id) => desk[id].ry)).toEqual(before);
  });

  it('ignore les corps qui ne sont pas sur le plateau (présentés)', () => {
    const desk = createDeskBodies();
    const active = ALL.filter((id) => id !== 'card');
    moveBody(desk, 'laptop', 0.52, 2.1, active, DESK_WORLD);
    expect(desk.card).toMatchObject({ x: 0.52, z: 2.1, moved: false });
    expectValid(desk, active);
  });

  it('refuse une cible qui n’est pas un nombre', () => {
    const desk = createDeskBodies();
    const result = moveBody(desk, 'mug', Number.NaN, 0, ALL, DESK_WORLD);
    expect(result.blocked).toBe(true);
    expect(desk.mug).toMatchObject({ x: 4.55, z: -0.62 });
  });

  it('est déterministe : mêmes glissers, mêmes places', () => {
    const run = () => {
      const desk = createDeskBodies();
      moveBody(desk, 'laptop', -0.3, 2.15, ALL, DESK_WORLD);
      moveBody(desk, 'chest', 2, 2.5, ALL, DESK_WORLD);
      return BODY_IDS.map((id) => [desk[id].x, desk[id].z]);
    };
    expect(run()).toEqual(run());
  });
});

describe('une série de glissers au hasard (graine fixe)', () => {
  it.each([1, 2, 3])(
    'ne laisse jamais de recouvrement ni de NaN (graine %i)',
    (seed) => {
      const random = rng(seed);
      const desk = createDeskBodies();
      for (let i = 0; i < 60; i++) {
        const id = BODY_IDS[Math.floor(random() * BODY_IDS.length)]!;
        const x = random() * 16 - 8;
        const z = random() * 8 - 4;
        // Grands pas d'un coup ou petits pas d'une main qui suit.
        if (random() < 0.5) moveBody(desk, id, x, z, ALL, DESK_WORLD);
        else {
          for (let k = 0; k < 12; k++) {
            const body = desk[id];
            moveBody(
              desk,
              id,
              body.x + (x - body.x) * 0.3,
              body.z + (z - body.z) * 0.3,
              ALL,
              DESK_WORLD,
            );
          }
        }
        expectValid(desk, ALL, `glisser ${i} (${id})`);
      }
    },
    30_000,
  );
});

describe('relax', () => {
  it('trouve une place à un objet reposé sur une place prise entre-temps', () => {
    const desk = createDeskBodies();
    // La carte présentée, le portable glissé à sa place, puis la carte revient.
    const active = ALL.filter((id) => id !== 'card');
    moveBody(desk, 'laptop', 0.52, 2.1, active, DESK_WORLD);
    expect(overlapScore(desk, ALL, DESK_WORLD)).toBeGreaterThan(0);
    const moved = settleBodies(desk, ALL, DESK_WORLD, ['card']);
    expect(moved).toContain('card');
    expectValid(desk);
    // La carte a trouvé une place libre près de la sienne ; le portable n'a pas bougé de plus d'un pas.
    expect(Math.hypot(desk.card.x - 0.52, desk.card.z - 2.1)).toBeLessThan(3);
  });

  it('garde un écart de contact entre deux corps séparés', () => {
    const desk = createDeskBodies();
    Object.assign(desk.mug, { x: 0, z: 2.6 });
    Object.assign(desk.pad, { x: 0.3, z: 2.6, ry: 0 });
    relax(desk, ['mug', 'pad'], DESK_WORLD);
    expect(separate(bodyObb('mug', desk.mug), bodyObb('pad', desk.pad))).toBeNull();
    expect(desk.mug.moved && desk.pad.moved).toBe(true);
  });
});
