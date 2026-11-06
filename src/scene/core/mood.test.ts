import { describe, expect, it } from 'vitest';
import { hourOffset, moodOfHour, visitorNow } from './mood';
import { blendMoodValues, hexToRgb, moodValues } from './mood-values';

describe("l'ambiance selon l'heure", () => {
  it('change aux heures prévues', () => {
    expect([6, 7, 10, 11, 17, 18, 21, 22, 0].map(moodOfHour)).toEqual([
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
      'night',
      'night',
    ]);
  });

  it('décale l’horloge du visiteur sur ?heure=', () => {
    const now = new Date(2026, 9, 28, 9, 12, 30);
    const offset = hourOffset(23, now);
    const shifted = visitorNow(offset, now.getTime());
    expect([shifted.getHours(), shifted.getMinutes()]).toEqual([23, 0]);
    expect(hourOffset(null, now)).toBe(0);
    const half = visitorNow(hourOffset(14.5, now), now.getTime());
    expect([half.getHours(), half.getMinutes()]).toEqual([14, 30]);
  });
});

describe('les valeurs des ambiances', () => {
  it('lisent les couleurs en sRGB', () => {
    expect(hexToRgb(0xff8000)).toEqual({ r: 1, g: 128 / 255, b: 0 });
  });

  it('normalisent la direction du soleil', () => {
    const { dir } = moodValues('afternoon');
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1);
    expect(dir.y).toBeLessThan(0);
  });

  it("s'interpolent d'une ambiance à l'autre", () => {
    const night = moodValues('night');
    const morning = moodValues('morning');
    const out = moodValues('afternoon');
    expect(blendMoodValues(night, morning, 0, out)).toEqual(night);
    expect(blendMoodValues(night, morning, 1, out).lamp).toBeCloseTo(morning.lamp);
    expect(blendMoodValues(night, morning, 0.5, out).sun).toBeCloseTo(
      (night.sun + morning.sun) / 2,
    );
  });
});
