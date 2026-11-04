import { describe, expect, it } from 'vitest';
import { beltLap, cassetteAt, CASSETTES, puffAt, PUFFS } from './factory';

const calm = { period: 3.4, strength: 0.35 };
const busy = { period: 1.6, strength: 1 };

describe('la mini usine', () => {
  it('fait tourner le tapis plus vite quand l’usine est active', () => {
    expect(beltLap(busy)).toBeLessThan(beltLap(calm));
    expect(beltLap(calm)).toBe(5.5);
    expect(beltLap(busy)).toBe(3);
  });

  it('espace régulièrement les cassettes et les fait boucler', () => {
    const positions = Array.from({ length: CASSETTES }, (_, i) => cassetteAt(0, i, calm));
    expect(positions).toEqual([0, 1 / 3, 2 / 3]);
    for (let t = 0; t < 20; t += 0.37) {
      const u = cassetteAt(t, 1, busy);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    expect(cassetteAt(beltLap(calm), 0, calm)).toBeCloseTo(0);
  });

  it('fait monter, grossir puis disparaître la fumée', () => {
    const start = puffAt(0, 0, calm);
    expect(start.opacity).toBe(0);
    const cycle = 2.4 + calm.period * 0.4;
    const mid = puffAt(cycle / 2, 0, calm);
    expect(mid.rise).toBeGreaterThan(start.rise);
    expect(mid.scale).toBeGreaterThan(start.scale);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(puffAt(cycle * 0.999, 0, calm).opacity).toBeLessThan(0.01);
    expect(PUFFS).toBeGreaterThan(1);
  });

  it('fume plus dense quand l’usine est active', () => {
    const peak = (pulse: typeof calm) =>
      Math.max(...Array.from({ length: 400 }, (_, i) => puffAt(i * 0.01, 0, pulse).opacity));
    expect(peak(busy)).toBeGreaterThan(peak(calm));
  });
});
