import { describe, expect, it } from 'vitest';
import { createClock, MAX_DT } from './clock';

describe("l'horloge", () => {
  it('part de startAt et suit le temps réel', () => {
    const clock = createClock({ startAt: 11 });
    clock.tick(100);
    expect(clock.t).toBe(11);
    clock.tick(102.5);
    expect(clock.t).toBe(13.5);
    expect(clock.dt).toBe(MAX_DT);
  });

  it('reste gelée avec ?fige', () => {
    const clock = createClock({ startAt: 11, frozen: true });
    clock.tick(100);
    clock.tick(105);
    expect(clock.t).toBe(11);
  });

  it("s'arrête quand l'onglet est caché", () => {
    const clock = createClock();
    clock.tick(10);
    clock.tick(11);
    clock.pause(11);
    clock.tick(40);
    clock.resume(50);
    clock.tick(50.5);
    expect(clock.t).toBeCloseTo(1.5);
  });

  it('repart de zéro, dégelée, pour Rejouer', () => {
    const clock = createClock({ startAt: 11, frozen: true });
    clock.tick(100);
    clock.restart(200);
    clock.tick(203);
    expect(clock.frozen).toBe(false);
    expect(clock.t).toBe(3);
  });
});
