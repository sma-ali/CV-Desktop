import { describe, expect, it } from 'vitest';
import { ARRIVAL, DROP } from './constants';
import { dropOffset, dropStart, DROP_END, DROP_ORDER, landingsBetween } from './drop';
import { BODY_IDS } from './ids';

describe('la chute de l’arrivée', () => {
  it('fait tomber chaque corps une fois, sauf le casque pendu à son support', () => {
    expect(new Set(DROP_ORDER).size).toBe(DROP_ORDER.length);
    expect([...DROP_ORDER, 'headset'].sort()).toEqual([...BODY_IDS].sort());
  });

  it('pose la lampe en dernier, juste avant qu’elle s’allume', () => {
    expect(DROP_ORDER.at(-1)).toBe('lamp');
    expect(DROP_END).toBeLessThanOrEqual(ARRIVAL.lampOn);
    expect(ARRIVAL.lampOn - DROP_END).toBeLessThan(0.4);
  });

  it('cache un corps avant son départ, le fait tomber, rebondir, puis le pose', () => {
    const i = 3;
    const at = dropStart(i);
    expect(dropOffset(at - 0.01, i)).toBeNull();
    expect(dropOffset(at, i)).toEqual({ dy: DROP.height, tilt: DROP.tilt });
    const mid = dropOffset(at + DROP.fall / 2, i)!;
    expect(mid.dy).toBeGreaterThan(0);
    expect(mid.dy).toBeLessThan(DROP.height);
    const bounce = dropOffset(at + DROP.fall + DROP.bounce / 2, i)!;
    expect(bounce.dy).toBeCloseTo(DROP.rebound);
    expect(dropOffset(at + DROP.fall + DROP.bounce, i)).toEqual({ dy: 0, tilt: 0 });
  });

  it('tombe en accélérant', () => {
    const at = dropStart(0);
    const h = (s: number) => dropOffset(at + s, 0)!.dy;
    const first = DROP.height - h(DROP.fall / 2);
    const second = h(DROP.fall / 2) - h(DROP.fall - 1e-6);
    expect(second).toBeGreaterThan(first);
  });

  it('compte chaque atterrissage une seule fois', () => {
    const hits: number[] = [];
    for (let t = 0; t < DROP_END + 0.1; t += 1 / 60) hits.push(...landingsBetween(t, t + 1 / 60));
    expect(hits).toEqual(DROP_ORDER.map((_, i) => i));
    expect(landingsBetween(2, 1)).toEqual([]);
  });
});
