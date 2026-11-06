import { describe, expect, it } from 'vitest';
import { clamp, damp, ease, easeOut, lerp, seg, smooth } from './math';

describe('les maths de la scène', () => {
  it('bornent une valeur', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(3, 0, 1)).toBe(1);
  });

  it('interpolent et mesurent un avancement borné', () => {
    expect(lerp(2, 4, 0.25)).toBe(2.5);
    expect(lerp(2, 4, 2)).toBe(6);
    expect(seg(5, 4, 6)).toBe(0.5);
    expect(seg(1, 4, 6)).toBe(0);
    expect(seg(9, 4, 6)).toBe(1);
  });

  it('adoucissent de 0 à 1 sans sortir des bornes', () => {
    for (const curve of [ease, easeOut, smooth]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
      for (let t = 0; t <= 1; t += 0.05) {
        expect(curve(t)).toBeGreaterThanOrEqual(0);
        expect(curve(t)).toBeLessThanOrEqual(1);
      }
    }
    expect(ease(0.5)).toBeCloseTo(0.5, 9);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(easeOut(0.1)).toBeGreaterThan(0.1);
  });

  it('lissent pareil à 30 et à 120 images par seconde', () => {
    const run = (fps: number) => {
      let value = 0;
      for (let i = 0; i < fps; i++) value = lerp(value, 1, damp(0.02, 1 / fps));
      return value;
    };
    // Au bout d'une seconde, il reste keep de l'écart, quel que soit le rythme.
    expect(run(30)).toBeCloseTo(0.98, 9);
    expect(run(120)).toBeCloseTo(0.98, 9);
    expect(damp(0.02, 0)).toBe(0);
  });
});
