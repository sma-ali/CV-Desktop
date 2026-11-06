import { describe, expect, it } from 'vitest';
import { rebaseLifeSigns, sampleLifeSigns } from './sample';
import { getLifeSigns } from './source';
import { activityPulse, LIFE_SIGNS_DAYS } from './types';

// Les signes de vie de l'usine : données d'exemple signalées comme telles,
// déjà arrondies, recalées sur l'heure du visiteur ; battement selon
// l'activité.

const NOW = Date.UTC(2026, 9, 28, 14, 30);
const MINUTE = 60_000;

describe('les données d’exemple', () => {
  it('se signalent comme telles, couvrent 14 jours et sont déjà arrondies', () => {
    const signs = sampleLifeSigns(NOW);
    expect(signs.sample).toBe(true);
    expect(signs.activity).toHaveLength(LIFE_SIGNS_DAYS);
    expect(signs.measuredAt).toBe('2026-10-28T14:00:00.000Z');
    expect(signs.lastActivityAt).toBe('2026-10-28T00:00:00.000Z');
    expect(signs.since).toBe('2026-08-01T00:00:00.000Z');
    expect(signs.factory).toEqual({
      channels: 6,
      videos: 200,
      perDay: 8,
      views: 120_000,
      likes: 5000,
    });
  });

  it('sont ce que le serveur renvoie sans adresse du JSON public', async () => {
    const log = () => undefined;
    expect(await getLifeSigns(NOW, { url: undefined, log, cache: false })).toEqual(
      sampleLifeSigns(NOW),
    );
  });

  it('se recalent sur l’heure du visiteur, pas les vraies données', () => {
    const built = sampleLifeSigns(NOW - 3 * 24 * 60 * MINUTE);
    const rebased = rebaseLifeSigns(built, NOW);
    expect(rebased).toEqual(sampleLifeSigns(NOW));
    const real = { ...built, sample: false };
    expect(rebaseLifeSigns(real, NOW)).toBe(real);
  });
});

describe('le battement de l’usine', () => {
  it('bat plus vite et plus fort quand les derniers jours sont actifs', () => {
    const calm = activityPulse({ ...sampleLifeSigns(NOW), activity: [8, 8, 8, 0, 0, 1] });
    const busy = activityPulse({ ...sampleLifeSigns(NOW), activity: [1, 1, 1, 8, 8, 8] });
    expect(busy.period).toBeLessThan(calm.period);
    expect(busy.strength).toBeGreaterThan(calm.strength);
    expect(busy.strength).toBeLessThanOrEqual(1);
  });

  it('bat au ralenti sans données ni activité', () => {
    expect(activityPulse(null)).toEqual({ period: 3.4, strength: 0.35 });
    expect(activityPulse({ ...sampleLifeSigns(NOW), activity: Array(14).fill(0) })).toEqual({
      period: 3.4,
      strength: 0.35,
    });
  });
});
