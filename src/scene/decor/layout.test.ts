import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { ARRIVAL, BOUNDS_PORTRAIT, DESK, DESK_PORTRAIT_Z1, WALL_Z, WIN } from '../core/constants';
import {
  FIGURES,
  KEY_COLORS,
  KEY_COUNT,
  KEY_DIP_TIME,
  MANGA,
  MANGA_SIZE,
  MANGA_TOP,
  SPINE_PALETTE,
  STEAM_COUNT,
  TYPING_END_ESTIMATE,
  WINDOW_BACKSTOP,
  WINDOW_SKY,
  damped,
  hop,
  keyColor,
  keyDips,
  keyForChar,
  keyLayout,
  leafLayout,
  mangaStack,
  ropeCoil,
  rumble,
  shake,
  spineSpec,
  springPoints,
  steamPuff,
  sway,
  type SteamPuff,
} from './layout';
import {
  DECOR_OBSTACLES,
  DECOR_OBSTACLES_PORTRAIT,
  decorExtentPortrait,
  decorObstacles,
  obstaclePiece,
  obstacleTurn,
} from './obstacles';
import {
  DECOR_ANCHORS,
  DECOR_PIECE_IDS,
  decorPieceTransform,
  decorPlacement,
  placeDecorPoint,
  PORTRAIT_DECOR,
} from '../core/decorPlaces';
import { SPINE_ATLAS, spineRowV } from './paint';

/** Un instant après l'arrivée. */
const SETTLED = 11;

const onDesk = (x: number, z: number, margin = 0) =>
  x >= DESK.x0 + margin && x <= DESK.x1 - margin && z >= DESK.z0 + margin && z <= DESK.z1 - margin;

describe('le clavier', () => {
  it('a 75 touches distinctes, toutes sur le boîtier', () => {
    const keys = keyLayout();
    expect(keys).toHaveLength(KEY_COUNT);
    expect(new Set(keys.map((k) => `${k.x.toFixed(3)}|${k.z.toFixed(3)}`)).size).toBe(KEY_COUNT);
    for (const key of keys) {
      expect(Math.abs(key.x)).toBeLessThan(2.1 - 0.11);
      expect(key.z).toBeGreaterThan(-0.75);
      expect(key.z).toBeLessThan(0.69 - 0.11);
    }
  });

  it('garde ses accents de couleur', () => {
    expect(keyColor(0, 0)).toBe(KEY_COLORS.red);
    expect(keyColor(4, 13)).toBe(KEY_COLORS.green);
    expect(keyColor(4, 7)).toBe(KEY_COLORS.base);
    expect(keyColor(2, 13)).toBe(KEY_COLORS.side);
  });

  it('choisit des touches valides et stables pour chaque caractère', () => {
    for (let n = 0; n < 500; n++) {
      const k = keyForChar(n);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(KEY_COUNT);
      expect(keyForChar(n)).toBe(k);
    }
    // Les frappes se répartissent sur le clavier.
    expect(new Set(Array.from({ length: 300 }, (_, n) => keyForChar(n))).size).toBeGreaterThan(40);
  });

  it('enfonce des touches seulement pendant la frappe', () => {
    const dips = new Float32Array(KEY_COUNT);
    expect(keyDips(ARRIVAL.typingStart - 0.5, dips)).toBe(false);
    expect(Math.max(...dips)).toBe(0);

    expect(keyDips(ARRIVAL.typingStart + 1, dips)).toBe(true);
    const max = Math.max(...dips);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(1);

    // Entre la fin du code et la ligne finale, plus rien ne bouge.
    expect(keyDips(TYPING_END_ESTIMATE + KEY_DIP_TIME + 0.05, dips)).toBe(false);
    expect(keyDips(ARRIVAL.extraLineStart - 0.2, dips)).toBe(false);
    // La ligne finale se tape, puis reste affichée sans frappe.
    expect(keyDips(ARRIVAL.extraLineStart + 1.5, dips)).toBe(true);
    expect(keyDips(ARRIVAL.extraLineStart + 5, dips)).toBe(false);
  });

  it('se cale sur la fin exacte de la frappe donnée par l’écran', () => {
    const dips = new Float32Array(KEY_COUNT);
    const end = ARRIVAL.typingStart + 2;
    expect(keyDips(end - 0.1, dips, end)).toBe(true);
    expect(keyDips(end + KEY_DIP_TIME + 0.05, dips, end)).toBe(false);
  });

  it('est une fonction pure du temps (figée par ?fige)', () => {
    const a = new Float32Array(KEY_COUNT);
    const b = new Float32Array(KEY_COUNT);
    keyDips(4.237, a);
    keyDips(4.237, b);
    expect([...a]).toEqual([...b]);
  });
});

describe('les petites animations', () => {
  it('ne bougent pas sans clic ni en mouvement réduit', () => {
    expect(damped(12, null, 1, false)).toBe(0);
    expect(damped(12, 11, 1, true)).toBe(0);
    expect(hop(12, null, false)).toEqual({ y: 0, spin: 0 });
    expect(hop(11.3, 11, true)).toEqual({ y: 0, spin: 0 });
    expect(shake(11.3, 11, true)).toBe(0);
    expect(rumble(11.3, 11, true)).toBe(0);
    expect(sway(12, 1, 0, 0.1, true)).toBe(0);
  });

  it('s’amortissent puis s’arrêtent', () => {
    expect(Math.abs(damped(11.5, 11, 1, false))).toBeGreaterThan(0.1);
    expect(Math.abs(damped(17, 11, 1, false))).toBeLessThan(0.05);
    expect(damped(30, 11, 1, false)).toBe(0);
    expect(hop(11.3, 11, false).y).toBeGreaterThan(0.3);
    expect(hop(11.7, 11, false)).toEqual({ y: 0, spin: 0 });
    expect(shake(12.5, 11, false)).toBe(0);
    expect(rumble(11.1, 11, false)).toBeGreaterThan(0);
    expect(rumble(11.7, 11, false)).toBe(0);
  });

  it('fait monter la vapeur seulement quand il y a de la lumière', () => {
    const puff: SteamPuff = { x: 0, y: 0, z: 0, scale: 0, opacity: 0 };
    for (let i = 0; i < STEAM_COUNT; i++) {
      expect(steamPuff(0.5, i, 0, null, false, puff).opacity).toBe(0);
      const lit = steamPuff(SETTLED, i, 1.5, null, false, puff);
      expect(lit.opacity).toBeGreaterThanOrEqual(0);
      expect(lit.opacity).toBeLessThanOrEqual(0.16 * 1.8);
      expect(lit.y).toBeGreaterThanOrEqual(0.6);
      expect(lit.y).toBeLessThanOrEqual(2.1);
    }
    // En mouvement réduit, la vapeur ne bouge plus.
    const a = { ...steamPuff(11, 2, 1, null, true, puff) };
    const b = { ...steamPuff(14, 2, 1, null, true, puff) };
    expect(a).toEqual(b);
  });
});

describe('la place du décor', () => {
  it('laisse au ciel un emplacement derrière la fenêtre', () => {
    const [x, y, z] = WINDOW_SKY.position;
    expect(x).toBeCloseTo((WIN.x0 + WIN.x1) / 2);
    expect(y).toBeCloseTo((WIN.y0 + WIN.y1) / 2);
    expect(z).toBeLessThan(WALL_Z);
    expect(WINDOW_SKY.size[0]).toBeGreaterThan(WIN.x1 - WIN.x0);
    expect(WINDOW_SKY.size[1]).toBeGreaterThan(WIN.y1 - WIN.y0);
    // Le fond de secours est derrière le ciel, et plus grand.
    expect(WINDOW_BACKSTOP.position[2]).toBeLessThan(z);
    expect(WINDOW_BACKSTOP.size[0]).toBeGreaterThan(WINDOW_SKY.size[0]);
  });

  it('pose tout sur le plateau', () => {
    for (const obstacle of DECOR_OBSTACLES) {
      expect(onDesk(obstacle.x, obstacle.z), obstacle.id).toBe(true);
    }
    for (const [x, , z] of ropeCoil()) expect(onDesk(x, z, 0.05)).toBe(true);
  });

  // Que rien ne se chevauche (décor, objets du CV, tasse, manette), en
  // paysage comme en portrait : core/bodies.test.ts.

  it('dessine des ressorts qui suivent leur axe', () => {
    const points = springPoints([0, 0, 0], [0, 2, 0], 0.05, 4, 8);
    expect(points).toHaveLength(33);
    expect(points[0]?.[1]).toBeCloseTo(0);
    expect(points.at(-1)?.[1]).toBeCloseTo(2);
    for (const [x, , z] of points) expect(Math.hypot(x, z)).toBeCloseTo(0.05);
  });
});

describe('les mangas et les figurines', () => {
  it('empile sept tomes, et le robot se tient dessus', () => {
    const stack = mangaStack();
    expect(stack).toHaveLength(MANGA.count);
    stack.slice(1).forEach((book, i) => expect(book.y).toBeGreaterThan(stack[i]?.y ?? 0));
    const top = (stack.at(-1)?.y ?? 0) + MANGA_SIZE.h / 2;
    expect(MANGA_TOP).toBeCloseTo(top);
    const robot = FIGURES.find((figure) => figure.kind === 'robot');
    expect(robot?.position[1]).toBeCloseTo(MANGA_TOP);
  });

  it('peint des dos inventés et toujours les mêmes', () => {
    for (let i = 0; i < MANGA.count; i++) {
      const spec = spineSpec(100 + i);
      expect(spineSpec(100 + i)).toEqual(spec);
      expect(SPINE_PALETTE).toContain(spec.back);
      expect(SPINE_PALETTE).toContain(spec.band);
      expect(spec.volume).toBeGreaterThanOrEqual(1);
      expect(spec.volume).toBeLessThanOrEqual(12);
    }
  });

  it('range l’atlas des dos en rangées qui ne se chevauchent pas', () => {
    let previousLow = 1;
    for (let row = 0; row < SPINE_ATLAS.rows; row++) {
      const [low, high] = spineRowV(row);
      expect(high).toBeCloseTo(previousLow);
      expect(low).toBeLessThan(high);
      previousLow = low;
    }
    expect(previousLow).toBeCloseTo(0);
  });

  it('donne à la plante des feuilles en deux verts', () => {
    const leaves = leafLayout();
    expect(leaves).toHaveLength(11);
    expect(new Set(leaves.map((leaf) => leaf.shade))).toEqual(new Set([0, 1]));
  });
});

describe('le décor du bureau resserré (portrait)', () => {
  /** Un point dessiné en paysage, posé par les groupes de DecorPiece (three). */
  function drawnAt(id: (typeof DECOR_PIECE_IDS)[number], point: readonly [number, number, number]) {
    const { position, ry, offset } = decorPieceTransform(id, true);
    const outer = new Group();
    outer.position.set(...position);
    outer.rotation.y = ry;
    const inner = new Group();
    inner.position.set(...offset);
    outer.add(inner);
    outer.updateMatrixWorld(true);
    return inner.localToWorld(new Vector3(...point));
  }

  it('ne change rien en paysage', () => {
    expect(decorObstacles(false)).toBe(DECOR_OBSTACLES);
    for (const id of DECOR_PIECE_IDS) {
      const { position, ry, offset, hidden } = decorPieceTransform(id, false);
      expect(ry).toBe(0);
      expect(hidden).toBe(false);
      expect(position[0] + offset[0]).toBe(0);
      expect(position[2] + offset[2]).toBe(0);
      expect(placeDecorPoint(id, false, [1, 2, 3])).toEqual([1, 2, 3]);
    }
  });

  it('pose les obstacles là où le décor est dessiné', () => {
    for (const obstacle of DECOR_OBSTACLES) {
      const piece = obstaclePiece(obstacle.id);
      const placed = DECOR_OBSTACLES_PORTRAIT.find(({ id }) => id === obstacle.id);
      if (piece && decorPlacement(piece, true).hidden) {
        expect(placed, obstacle.id).toBeUndefined();
        continue;
      }
      expect(placed, obstacle.id).toBeDefined();
      // Le centre de l'obstacle suit le groupe qui porte le dessin.
      const drawn = piece
        ? drawnAt(piece, [obstacle.x, 0, obstacle.z])
        : new Vector3(obstacle.x, 0, obstacle.z);
      expect(placed!.x, obstacle.id).toBeCloseTo(drawn.x, 6);
      expect(placed!.z, obstacle.id).toBeCloseTo(drawn.z, 6);
      expect(placed!.ry, obstacle.id).toBeCloseTo(
        obstacle.ry + (piece ? obstacleTurn(obstacle.id, decorPlacement(piece, true).ry) : 0),
        6,
      );
    }
  });

  it('tourne chaque morceau autour de son ancre, comme three', () => {
    for (const id of DECOR_PIECE_IDS) {
      const [ax, az] = DECOR_ANCHORS[id];
      for (const point of [
        [ax, 0, az],
        [ax + 1, 0.5, az - 0.7],
      ] as const) {
        const drawn = drawnAt(id, point);
        const [x, y, z] = placeDecorPoint(id, true, point);
        expect(x, id).toBeCloseTo(drawn.x, 6);
        expect(y, id).toBeCloseTo(drawn.y, 6);
        expect(z, id).toBeCloseTo(drawn.z, 6);
      }
      // L'ancre arrive sur sa place portrait.
      const [x, , z] = placeDecorPoint(id, true, [ax, 0, az]);
      expect(x).toBeCloseTo(PORTRAIT_DECOR[id].x, 6);
      expect(z).toBeCloseTo(PORTRAIT_DECOR[id].z, 6);
    }
  });

  it('garde le décor visible sur le plateau allongé, près de la zone resserrée', () => {
    const portraitDesk = (x: number, z: number) =>
      x >= DESK.x0 && x <= DESK.x1 && z >= DESK.z0 && z <= DESK_PORTRAIT_Z1;
    for (const [x, , z] of decorExtentPortrait()) {
      expect(portraitDesk(x, z)).toBe(true);
      // Le décor posé reste dans la largeur de la zone, à 0.2 près (le cadrage le fait tenir).
      expect(x).toBeGreaterThanOrEqual(BOUNDS_PORTRAIT.x0 - 0.2);
      expect(x).toBeLessThanOrEqual(BOUNDS_PORTRAIT.x1 + 0.2);
    }
  });

  it('ne cache que du décor qui ne trouve pas sa place, jamais la lampe ni la plante', () => {
    const hidden = DECOR_PIECE_IDS.filter((id) => decorPlacement(id, true).hidden);
    expect(hidden).toEqual(['rope', 'wraps', 'fox', 'wanderer']);
  });
});
