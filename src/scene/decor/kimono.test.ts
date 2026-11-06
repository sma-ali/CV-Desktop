import { Euler, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bodyObb, homePlace, obbPenetration } from '../core/bodies';
import { DECOR_BODY_SPECS } from '../physics/decorShapes';
import { BELT, KIMONO_COLORS, KIMONO_SIZE, KIMONO_TOP, kimonoBlocks } from './kimono';
import { KIMONO, KIMONO_FOOTPRINT } from './layout';
import { DECOR_OBSTACLES, DECOR_OBSTACLES_PORTRAIT } from './obstacles';
import { PORTRAIT_DECOR } from '../core/decorPlaces';

/** Les huit coins d'une pièce, dans le repère du kimono (avant sa rotation). */
function corners(block: ReturnType<typeof kimonoBlocks>[number]): Vector3[] {
  const [w, h, d] = block.size;
  const turn = new Quaternion().setFromEuler(new Euler(...(block.rotation ?? [0, 0, 0])));
  const points: Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        points.push(
          new Vector3((sx * w) / 2, (sy * h) / 2, (sz * d) / 2)
            .applyQuaternion(turn)
            .add(new Vector3(...block.at)),
        );
      }
  return points;
}

/** Luminance relative (sRGB) d'une couleur 0xRRGGBB. */
function luminance(color: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((color >> 16) & 0xff) +
    0.7152 * channel((color >> 8) & 0xff) +
    0.0722 * channel(color & 0xff)
  );
}

describe('le kimono plié', () => {
  const blocks = kimonoBlocks();

  it('tient tout entier dans son encombrement et sa forme de collision', () => {
    const [shape] = DECOR_BODY_SPECS.kimono.shapes;
    expect(shape?.kind).toBe('box');
    if (shape?.kind !== 'box') return;
    expect(shape.half[0]).toBeCloseTo(KIMONO_FOOTPRINT.hw, 6);
    expect(shape.half[2]).toBeCloseTo(KIMONO_FOOTPRINT.hd, 6);
    expect(shape.half[1] * 2).toBeCloseTo(KIMONO_FOOTPRINT.height, 6);
    for (const block of blocks) {
      for (const point of corners(block)) {
        expect(Math.abs(point.x), block.name).toBeLessThanOrEqual(KIMONO_FOOTPRINT.hw + 1e-6);
        expect(Math.abs(point.z), block.name).toBeLessThanOrEqual(KIMONO_FOOTPRINT.hd + 1e-6);
        expect(point.y, block.name).toBeGreaterThanOrEqual(-1e-6);
        expect(point.y, block.name).toBeLessThanOrEqual(KIMONO_TOP + 0.01);
      }
    }
  });

  it('est bleu marine, et sa ceinture claire se détache dessus', () => {
    for (const key of ['pants', 'jacket', 'sleeves', 'collar'] as const) {
      const color = KIMONO_COLORS[key];
      const [r, g, b] = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
      // Du bleu nuit : le bleu domine, et c'est sombre.
      expect(b, key).toBeGreaterThan(r);
      expect(b, key).toBeGreaterThan(g);
      expect(luminance(color), key).toBeLessThan(0.05);
    }
    const contrast =
      (luminance(KIMONO_COLORS.belt) + 0.05) / (luminance(KIMONO_COLORS.sleeves) + 0.05);
    expect(contrast).toBeGreaterThan(7);
  });

  it('se lit vu de dessus : le col en V, la ceinture qui traverse, nouée, ses deux pans', () => {
    const names = blocks.map((block) => block.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'pants',
        'jacket',
        'sleeves',
        'collar-left',
        'collar-right',
        'belt-top',
        'belt-front',
        'belt-back',
        'belt-knot',
        'belt-tail-left',
        'belt-tail-right',
      ]),
    );
    const top = blocks.find((block) => block.name === 'belt-top')!;
    // La ceinture fait toute la profondeur du paquet, sur le dessus.
    expect(top.size[2]).toBeGreaterThan(KIMONO_SIZE.d * 0.9);
    expect(top.at[0]).toBe(BELT.x);
    expect(top.at[1]).toBeGreaterThanOrEqual(KIMONO_SIZE.h);
    // Les pans partent du nœud vers le visiteur, en s'écartant.
    const left = blocks.find((block) => block.name === 'belt-tail-left')!;
    const right = blocks.find((block) => block.name === 'belt-tail-right')!;
    expect(left.at[2]).toBeGreaterThan(0);
    expect(right.at[2]).toBeGreaterThan(0);
    expect(left.at[0]).toBeLessThan(BELT.x);
    expect(right.at[0]).toBeGreaterThan(BELT.x);
    // Le col est du côté opposé à la ceinture : les deux ne se recouvrent pas.
    for (const name of ['collar-left', 'collar-right']) {
      const collar = blocks.find((block) => block.name === name)!;
      const xs = corners(collar).map((point) => point.x);
      expect(Math.max(...xs), name).toBeLessThan(BELT.x - BELT.width / 2);
    }
  });

  it('ne porte que des pièces de tissu : aucune marque, aucun écusson', () => {
    const allowed = new Set<number>(Object.values(KIMONO_COLORS));
    for (const block of blocks) expect(allowed.has(block.color), block.name).toBe(true);
  });
});

describe('la place du kimono', () => {
  it('reprend son encombrement dans les obstacles du décor, dans les deux formats', () => {
    for (const obstacles of [DECOR_OBSTACLES, DECOR_OBSTACLES_PORTRAIT]) {
      const kimono = obstacles.find((obstacle) => obstacle.id === 'kimono');
      expect(kimono?.hw).toBe(KIMONO_FOOTPRINT.hw);
      expect(kimono?.hd).toBe(KIMONO_FOOTPRINT.hd);
    }
  });

  it('se pose à gauche du clavier en paysage, derrière lui en portrait, droit sur le plateau', () => {
    const landscape = homePlace('kimono', false);
    expect(landscape.x).toBe(KIMONO.position[0]);
    expect(landscape.z).toBe(KIMONO.position[2]);
    const portrait = homePlace('kimono', true);
    expect(portrait.x).toBe(PORTRAIT_DECOR.kimono.x);
    // Le portrait le remet d'équerre (sa rotation de paysage est compensée).
    expect(KIMONO.ry + portrait.ry).toBeCloseTo(0, 6);
  });

  it('ne touche ni le clavier ni le livre, dans les deux formats', () => {
    for (const portrait of [false, true]) {
      const obstacles = portrait ? DECOR_OBSTACLES_PORTRAIT : DECOR_OBSTACLES;
      const kimono = obstacles.find((obstacle) => obstacle.id === 'kimono')!;
      const keyboard = obstacles.find((obstacle) => obstacle.id === 'keyboard')!;
      expect(obbPenetration(kimono, keyboard), `clavier (${portrait})`).toBe(0);
      expect(obbPenetration(kimono, bodyObb('book', homePlace('book', portrait)))).toBe(0);
    }
  });
});
