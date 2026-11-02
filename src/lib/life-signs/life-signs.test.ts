import { describe, expect, it } from 'vitest';
import { getContent } from '@/content';
import { agoText, formatLifeSigns } from './format';
import { SAMPLE_LIFE_SIGNS, sampleLifeSigns } from './sample';
import { getLifeSigns } from './source';
import { activityPulse, LIFE_SIGNS_DAYS, rebaseLifeSigns } from './types';

// Les signes de vie du coffret : données d'exemple signalées comme telles,
// textes relatifs à l'heure du visiteur, battement selon l'activité.

const NOW = Date.UTC(2026, 9, 28, 14, 30);
const MINUTE = 60_000;
const nbsp = (value: string) => value.replace(/ /g, ' ');

describe('les données d’exemple', () => {
  it('se signalent comme telles et couvrent 14 jours', () => {
    const signs = sampleLifeSigns(NOW);
    expect(signs.sample).toBe(true);
    expect(signs.activity).toHaveLength(LIFE_SIGNS_DAYS);
    expect(signs.running).toBe(SAMPLE_LIFE_SIGNS.running);
    expect(Date.parse(signs.measuredAt)).toBe(NOW);
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

describe('les textes des signes de vie', () => {
  const fr = getContent('fr').sheets.ui.live;
  const en = getContent('en').sheets.ui.live;

  it('disent la dernière activité en minutes, en heures puis en jours', () => {
    expect(agoText(0, fr.ago, 'fr')).toBe("à l'instant");
    expect(nbsp(agoText(5, fr.ago, 'fr'))).toBe('il y a 5 min');
    expect(nbsp(agoText(120, fr.ago, 'fr'))).toBe('il y a 2 h');
    expect(nbsp(agoText(134, fr.ago, 'fr'))).toBe('il y a 2 h 14');
    expect(nbsp(agoText(47 * 60 + 5, fr.ago, 'fr'))).toBe('il y a 47 h 05');
    expect(nbsp(agoText(48 * 60, fr.ago, 'fr'))).toBe('il y a 2 jours');
    expect(nbsp(agoText(134, en.ago, 'en'))).toBe('2 h 14 min ago');
    expect(nbsp(agoText(3, en.ago, 'en'))).toBe('3 min ago');
  });

  it('mettent les données d’exemple en mots, en français et en anglais', () => {
    const signs = sampleLifeSigns(NOW);
    const view = formatLifeSigns(signs, NOW, fr, 'fr');
    expect(nbsp(view.lastActivity)).toBe('il y a 2 h 14');
    expect(nbsp(view.since)).toBe('47 jours');
    expect(view.running).toBe('3');
    expect(view.sample).toBe(true);
    expect(view.max).toBe(8);
    expect(view.chartLabel).toBe(
      "Activité des 14 derniers jours, du plus ancien à aujourd'hui : 3, 5, 2, 0, 4, 6, 3, 7, 5, 2, 6, 4, 8, 5",
    );
    expect(view.axisStart).toBe('Il y a 14 jours');
    const english = formatLifeSigns(signs, NOW, en, 'en');
    expect(nbsp(english.since)).toBe('47 days');
    expect(english.axisStart).toBe('14 days ago');
  });

  it('accordent au singulier', () => {
    const signs = {
      ...sampleLifeSigns(NOW),
      since: new Date(NOW - 30 * 60 * MINUTE).toISOString(),
    };
    expect(nbsp(formatLifeSigns(signs, NOW, fr, 'fr').since)).toBe('1 jour');
    expect(nbsp(formatLifeSigns(signs, NOW, en, 'en').since)).toBe('1 day');
  });
});

describe('le battement du coffret', () => {
  it('bat plus vite et plus fort quand les derniers jours sont actifs', () => {
    const calm = activityPulse({ ...sampleLifeSigns(NOW), activity: [8, 8, 8, 0, 0, 1] });
    const busy = activityPulse({ ...sampleLifeSigns(NOW), activity: [1, 1, 1, 8, 8, 8] });
    expect(busy.period).toBeLessThan(calm.period);
    expect(busy.strength).toBeGreaterThan(calm.strength);
    expect(busy.strength).toBeLessThanOrEqual(1);
  });

  it('bat au ralenti sans données ni projet en marche', () => {
    expect(activityPulse(null)).toEqual({ period: 3.4, strength: 0.35 });
    expect(activityPulse({ ...sampleLifeSigns(NOW), running: 0 })).toEqual({
      period: 3.4,
      strength: 0.35,
    });
  });
});
