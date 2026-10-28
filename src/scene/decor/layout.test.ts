import { describe, expect, it } from 'vitest';
import { ARRIVAL, DESK, ITEM_POSES, STAND, WALL_Z, WIN } from '../core/constants';
import {
  DECK_PALETTE,
  DECOR_FOOTPRINTS,
  FIGURES,
  KEY_COLORS,
  KEY_COUNT,
  KEY_DIP_TIME,
  MANGA,
  MANGA_SIZE,
  MANGA_TOP,
  MIC,
  MIC_LOCAL,
  SPINE_PALETTE,
  STEAM_COUNT,
  TYPING_END_ESTIMATE,
  WINDOW_BACKSTOP,
  WINDOW_SKY,
  damped,
  deckButtonLevel,
  deckLayout,
  hop,
  keyColor,
  keyDips,
  keyForChar,
  keyLayout,
  leafLayout,
  mangaStack,
  micPoint,
  micRingColor,
  panelLevel,
  ropeCoil,
  rumble,
  shake,
  spineSpec,
  springPoints,
  steamPuff,
  sway,
  type SteamPuff,
} from './layout';
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

describe('le pavé de boutons', () => {
  it('a 15 boutons aux couleurs de la palette', () => {
    const buttons = deckLayout();
    expect(buttons).toHaveLength(15);
    for (const button of buttons) expect(DECK_PALETTE).toContain(button.color);
  });

  it('s’allume bouton par bouton pendant l’arrivée', () => {
    expect(deckButtonLevel(ARRIVAL.deckLedsStart - 0.01, 0, null, false)).toBe(0);
    expect(deckButtonLevel(ARRIVAL.deckLedsStart + 0.01, 0, null, false)).toBeGreaterThan(0.4);
    expect(deckButtonLevel(ARRIVAL.deckLedsStart + 0.01, 14, null, false)).toBe(0);
    expect(deckButtonLevel(SETTLED, 14, null, false)).toBeGreaterThan(0.4);
  });

  it('respire sauf en mouvement réduit, et réagit au clic', () => {
    const values = [11, 11.5, 12, 12.5].map((t) => deckButtonLevel(t, 3, null, false));
    expect(new Set(values).size).toBeGreaterThan(1);
    const reduced = [11, 11.5, 12].map((t) => deckButtonLevel(t, 3, null, true));
    expect(new Set(reduced).size).toBe(1);
    const at = 20;
    expect(deckButtonLevel(at + 0.05, 0, at, false)).toBeGreaterThan(
      deckButtonLevel(at + 0.05, 0, null, false),
    );
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

  it('allument le panneau et l’anneau du micro à leur heure', () => {
    expect(panelLevel(ARRIVAL.panelOn - 0.1)).toBe(0);
    expect(panelLevel(ARRIVAL.panelFull + 0.1)).toBe(1);
    expect(micRingColor(ARRIVAL.micRing - 0.1, false)).toEqual([0, 0, 0]);
    const [closedR] = micRingColor(ARRIVAL.micRing + 0.1, false);
    const [openR, openG] = micRingColor(ARRIVAL.micRing + 0.1, true);
    expect(openR).toBeGreaterThan(closedR);
    expect(openG).toBeLessThan(0.3);
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

  it('pose tout sur le plateau, sauf le pied des gants', () => {
    for (const footprint of DECOR_FOOTPRINTS) {
      expect(onDesk(footprint.x, footprint.z), footprint.id).toBe(true);
    }
    for (const [x, , z] of ropeCoil()) expect(onDesk(x, z, 0.05)).toBe(true);
    expect(STAND[0]).toBeGreaterThan(DESK.x1);
  });

  it('ne pose rien sur les objets du CV', () => {
    // Encombrement au repos des objets posés à plat : demi-largeur et demi-profondeur.
    const items = [
      { id: 'book', hw: 0.95, hd: 1.25 },
      { id: 'badge', hw: 0.43, hd: 0.62 },
      { id: 'laptop', hw: 1.35, hd: 0.93 },
      { id: 'card', hw: 0.85, hd: 0.5 },
      { id: 'chest', hw: 0.63, hd: 0.43 },
      { id: 'monitor', hw: 0.75, hd: 0.48 },
    ] as const;
    for (const { id, hw, hd } of items) {
      const { x, z, ry } = ITEM_POSES[id];
      for (const footprint of DECOR_FOOTPRINTS) {
        // Le centre du cercle dans le repère de l'objet (rotation inverse autour de y).
        const dx = footprint.x - x;
        const dz = footprint.z - z;
        const lx = dx * Math.cos(ry) - dz * Math.sin(ry);
        const lz = dx * Math.sin(ry) + dz * Math.cos(ry);
        const ox = Math.max(0, Math.abs(lx) - hw);
        const oz = Math.max(0, Math.abs(lz) - hd);
        expect(Math.hypot(ox, oz), `${id} / ${footprint.id}`).toBeGreaterThan(footprint.r);
      }
    }
  });

  it('suspend le micro à gauche du coffret, au-dessus du plateau', () => {
    const tip = micPoint(MIC_LOCAL.tipY);
    const back = micPoint(MIC_LOCAL.backY);
    // Il pointe vers l'avant et vers la droite (la chaise), en descendant un peu.
    expect(tip[0]).toBeGreaterThan(back[0]);
    expect(tip[2]).toBeGreaterThan(back[2]);
    expect(tip[1]).toBeLessThan(back[1]);
    expect(tip[1]).toBeGreaterThan(1.5);
    // De haut, il reste à gauche du coffret.
    expect(tip[0]).toBeLessThan(ITEM_POSES.chest.x - 0.3);
    // La pince tient sur le bord gauche.
    expect(MIC.clamp[0]).toBeLessThan(DESK.x0 + 0.3);
  });

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
