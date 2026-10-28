import { describe, expect, it } from 'vitest';
import { activityPulse, type LifeSigns } from '@/lib/life-signs/types';
import { breath, heartbeat, rattleStarts } from './beats';

const signs = (activity: number[]): LifeSigns => ({
  running: 3,
  lastActivityAt: '2026-10-28T10:00:00.000Z',
  since: '2026-09-11T10:00:00.000Z',
  activity,
  measuredAt: '2026-10-28T12:00:00.000Z',
  sample: true,
});

/** Les instants où le cœur bat (montée au-dessus de la moitié de sa force). */
function beats(pulse: { period: number; strength: number }, from: number, to: number) {
  const times: number[] = [];
  let previous = 0;
  for (let t = from; t < to; t += 0.005) {
    const level = heartbeat(t, pulse) / pulse.strength;
    if (previous < 0.5 && level >= 0.5) times.push(t);
    previous = level;
  }
  return times;
}

describe('le cœur du coffret', () => {
  it('bat deux fois par période : un coup, puis un plus faible', () => {
    const pulse = { period: 2, strength: 1 };
    const times = beats(pulse, 10, 20);
    // Deux montées par période de 2 s, sur 10 s.
    expect(times.length).toBe(10);
    const peaks = [0.08, 0.24].map((phase) => heartbeat(10 + phase * 2, pulse));
    expect(peaks[0]).toBeGreaterThan(peaks[1]!);
    expect(heartbeat(10 + 0.6 * 2, pulse)).toBeLessThan(0.01);
  });

  it('bat plus vite et plus fort quand les derniers jours sont actifs', () => {
    const calm = activityPulse(signs([9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0]));
    const busy = activityPulse(signs([1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9]));
    expect(busy.period).toBeLessThan(calm.period);
    expect(busy.strength).toBeGreaterThan(calm.strength);
    expect(beats(busy, 10, 30).length).toBeGreaterThan(beats(calm, 10, 30).length);
    const max = (pulse: typeof calm) =>
      Math.max(...Array.from({ length: 400 }, (_, i) => heartbeat(10 + i * 0.01, pulse)));
    expect(max(busy)).toBeGreaterThan(max(calm));
  });

  it('bat au plus calme sans signes de vie', () => {
    expect(activityPulse(null)).toEqual({ period: 3.4, strength: 0.35 });
    expect(heartbeat(10, activityPulse(null))).toBeLessThanOrEqual(0.35);
  });

  it('ne dépend que de T, aussi avant zéro', () => {
    const pulse = { period: 2.4, strength: 0.8 };
    expect(heartbeat(12.3, pulse)).toBe(heartbeat(12.3, pulse));
    expect(heartbeat(-0.2, pulse)).toBeCloseTo(heartbeat(2.2, pulse), 10);
  });
});

describe('le bocal de Netherbrain', () => {
  it('respire entre 0 et 1', () => {
    expect(breath(0)).toBeCloseTo(0, 10);
    expect(breath(2.2)).toBeCloseTo(1, 10);
    for (let t = 0; t < 10; t += 0.1) {
      expect(breath(t)).toBeGreaterThanOrEqual(0);
      expect(breath(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe('le coffret présenté', () => {
  it('fait un bruit au début de chaque à-coup, une seule fois', () => {
    let count = 0;
    for (let t = 10; t < 10 + (2 * Math.PI) / 1.7; t += 1 / 60) {
      if (rattleStarts(t, t + 1 / 60)) count++;
    }
    expect(count).toBe(1);
    // Horloge gelée : rien.
    expect(rattleStarts(12, 12)).toBe(false);
  });
});
