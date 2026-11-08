import { describe, expect, it } from 'vitest';
import { autoScroll, autoScrollTime, clampScroll, LAPTOP_SCROLL } from './laptopScroll';

const range = 550;
const { dwell, speed } = LAPTOP_SCROLL;
const travel = range / speed;

describe('le défilement de l’écran du portable', () => {
  it('montre le haut, descend jusqu’en bas, s’y arrête puis remonte', () => {
    expect(autoScroll(0, range)).toBe(0);
    expect(autoScroll(dwell * 0.9, range)).toBe(0);
    const mid = autoScroll(dwell + travel / 2, range);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(range);
    expect(autoScroll(dwell + travel + dwell / 2, range)).toBe(range);
    expect(autoScroll(2 * dwell + travel + travel / 2, range)).toBeLessThan(range);
    expect(autoScroll(2 * (dwell + travel) + 0.1, range)).toBe(0);
  });

  it('descend sans à-coup et ne sort jamais de l’écran', () => {
    let previous = 0;
    for (let t = 0; t < dwell + travel; t += 0.05) {
      const offset = autoScroll(t, range);
      expect(offset).toBeGreaterThanOrEqual(previous);
      expect(offset).toBeLessThanOrEqual(range);
      previous = offset;
    }
  });

  it('ne bouge pas quand tout tient à l’écran', () => {
    expect(autoScroll(10, 0)).toBe(0);
  });

  it('reprend après la molette là où elle s’est arrêtée', () => {
    for (const offset of [0, 120, 400, range]) {
      expect(autoScroll(autoScrollTime(offset, range), range)).toBeCloseTo(offset, 1);
    }
  });

  it('garde la molette dans l’écran', () => {
    expect(clampScroll(-20, range)).toBe(0);
    expect(clampScroll(900, range)).toBe(range);
    expect(clampScroll(200, range)).toBe(200);
  });
});
