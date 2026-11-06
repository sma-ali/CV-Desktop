import { describe, expect, it } from 'vitest';
import { clockHold, TING_MS } from '@/scene/core/loading';
import { createIntroScene, hitSchedule, INTRO_FIRST_FRAME } from './introArt';

/** Un hasard reproductible (suite congruentielle). */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe("le dessin de l'écran de chargement", () => {
  it('rend la même première image au serveur et au client', () => {
    expect(createIntroScene({ still: true })(0, 0)).toBe(INTRO_FIRST_FRAME);
    expect(INTRO_FIRST_FRAME).not.toContain('ting');
  });

  it('frappe seulement sur les côtés de l’ordinateur, jamais derrière', () => {
    const hits = hitSchedule(seeded(7));
    expect(hits.length).toBeGreaterThan(5);
    for (const hit of hits) {
      expect(hit.x < 50 || hit.x > 150).toBe(true);
      expect(hit.t).toBeLessThan(7000 + 1300);
    }
  });

  it('montre la goutte de sueur à 70 %, une seule fois, et la garde', () => {
    const render = createIntroScene({ random: seeded(3) });
    expect(render(0.5, 1000)).not.toContain('#9ec9ff" stroke="#dfe9ff');
    const first = render(0.72, 2000);
    expect(first).toContain('#9ec9ff" stroke="#dfe9ff');
    expect(render(0.95, 6000)).toContain('#9ec9ff" stroke="#dfe9ff');
  });

  it('dit « ting ! » quand tout est prêt, verres blancs', () => {
    const render = createIntroScene({ random: seeded(5) });
    render(0.9, 1000);
    render(1, 2000);
    const frame = render(1, 2400);
    expect(frame).toContain('ting !');
    expect(frame).not.toContain('#161a24');
  });

  it('en mouvement réduit : ni frappes, ni « ting »', () => {
    const render = createIntroScene({ still: true, random: seeded(9) });
    expect(render(0.4, 3000)).toBe(render(0.4, 3500));
    render(1, 4000);
    expect(render(1, 5000)).not.toContain('ting !');
  });
});

describe("l'attente du « ting »", () => {
  it('retient l’horloge seulement pour une arrivée jouée en entier', () => {
    expect(clockHold(0, false, false)).toBe(TING_MS);
    expect(clockHold(11, false, false)).toBe(0);
    expect(clockHold(0, true, false)).toBe(0);
    expect(clockHold(0, false, true)).toBe(0);
  });
});
