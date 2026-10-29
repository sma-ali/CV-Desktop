import { describe, expect, it } from 'vitest';
import { spreadTags, TAG_EDGE, worstOverlap, type TagBox } from './tagSpread';

const box = (x: number, y: number, w = 100, h = 24): TagBox => ({ x, y, w, h });

describe('spreadTags', () => {
  it('ne touche pas aux étiquettes qui ne se chevauchent pas', () => {
    const boxes = [box(80, 300), box(260, 300), box(80, 400)];
    const before = boxes.map((b) => ({ ...b }));
    spreadTags(boxes, 390);
    expect(boxes).toEqual(before);
  });

  it('écarte en hauteur deux étiquettes qui se couvrent, de part et d’autre', () => {
    // Homelab et DEFI-METIERS en 390x844, à peu près.
    const boxes = [box(60, 548), box(110, 552)];
    spreadTags(boxes, 390);
    expect(worstOverlap(boxes)).toBe(0);
    expect(boxes[0]!.y).toBeLessThan(548);
    expect(boxes[1]!.y).toBeGreaterThan(552);
    // Le moins qu'il faut : 24 px de haut, 4 px d'écart.
    expect(boxes[1]!.y - boxes[0]!.y).toBeCloseTo(28, 5);
    expect(boxes[0]!.x).toBe(60);
  });

  it('défait une grappe de sept étiquettes sur un petit écran', () => {
    const boxes = Array.from({ length: 7 }, (_, i) => box(150 + (i % 3) * 20, 500 + i * 3, 110));
    spreadTags(boxes, 360);
    expect(worstOverlap(boxes)).toBe(0);
    for (const b of boxes) {
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(TAG_EDGE - 1e-9);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(360 - TAG_EDGE + 1e-9);
    }
  });

  it('garde les étiquettes dans la fenêtre', () => {
    const boxes = [box(10, 100), box(385, 200)];
    spreadTags(boxes, 390);
    expect(boxes[0]!.x).toBe(50 + TAG_EDGE);
    expect(boxes[1]!.x).toBe(390 - 50 - TAG_EDGE);
  });

  it('est déterministe', () => {
    const make = () => [box(100, 300), box(100, 300), box(120, 305)];
    const a = make();
    const b = make();
    spreadTags(a, 390);
    spreadTags(b, 390);
    expect(a).toEqual(b);
    expect(worstOverlap(a)).toBe(0);
  });
});
