import { describe, expect, it } from 'vitest';
import { sampleLifeSigns, type LifeSigns, type LifeSignsTexts } from '@/lib/life-signs';
import { chestLiveView, normalizeActivity } from './lifeSignsView';

// La fiche du coffret face à des signes de vie bien ou mal formés. Les
// gabarits sont recopiés ici (le contenu n'entre pas dans le HUD) ; la
// comparaison aux vrais textes FR et EN est dans src/lib/life-signs.

const NOW = Date.UTC(2026, 9, 28, 14, 30);
const MINUTE = 60_000;
const nbsp = (value: string) => value.replace(/ /g, ' ');

const fr: LifeSignsTexts = {
  title: 'Signes de vie',
  sample: "Données d'exemple",
  running: 'Projets en marche',
  last: 'Dernière activité',
  since: 'En route depuis',
  chart: 'Activité des {days} derniers jours : {values}',
  axisStart: 'Il y a {days} jours',
  axisEnd: "Aujourd'hui",
  note: 'Le contenu, lui, reste scellé.',
  ago: {
    now: "à l'instant",
    minutes: 'il y a {n} min',
    hours: 'il y a {h} h',
    hoursMinutes: 'il y a {h} h {mm}',
    days: { one: 'il y a {n} jour', other: 'il y a {n} jours' },
  },
  age: { one: '{n} jour', other: '{n} jours' },
};

const en: LifeSignsTexts = {
  ...fr,
  ago: {
    now: 'just now',
    minutes: '{n} min ago',
    hours: '{h} h ago',
    hoursMinutes: '{h} h {mm} min ago',
    days: { one: '{n} day ago', other: '{n} days ago' },
  },
  age: { one: '{n} day', other: '{n} days' },
};

const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MINUTE).toISOString();

describe('les signes de vie de la fiche du coffret', () => {
  it('reprennent les données d’exemple et leurs 14 barres', () => {
    const view = chestLiveView(sampleLifeSigns(NOW), NOW, fr, 'fr');
    expect(view).not.toBeNull();
    expect(nbsp(view!.lastActivity)).toBe('il y a 2 h 14');
    expect(nbsp(view!.since)).toBe('47 jours');
    expect(view!.sample).toBe(true);
    expect(view!.bars).toHaveLength(14);
    expect(Math.max(...view!.bars.map((bar) => bar.level))).toBe(1);
    expect(view!.bars[3]).toEqual({ value: 0, level: 0 });
  });

  it('parlent anglais et accordent au singulier', () => {
    const signs = { ...sampleLifeSigns(NOW), lastActivityAt: at(24 * 60 * 2), since: at(25 * 60) };
    const view = chestLiveView(signs, NOW, en, 'en')!;
    expect(nbsp(view.lastActivity)).toBe('2 days ago');
    expect(nbsp(view.since)).toBe('1 day');
    expect(nbsp(chestLiveView(signs, NOW, fr, 'fr')!.since)).toBe('1 jour');
  });

  it('lisent une date future comme « à l’instant »', () => {
    const signs = { ...sampleLifeSigns(NOW), lastActivityAt: at(-30), since: at(-60) };
    const view = chestLiveView(signs, NOW, fr, 'fr')!;
    expect(view.lastActivity).toBe("à l'instant");
    expect(nbsp(view.since)).toBe('0 jour');
  });

  it('ne montrent rien sans données ou avec une date illisible', () => {
    expect(chestLiveView(null, NOW, fr, 'fr')).toBeNull();
    const broken: LifeSigns = { ...sampleLifeSigns(NOW), lastActivityAt: 'hier' };
    expect(chestLiveView(broken, NOW, fr, 'fr')).toBeNull();
    expect(chestLiveView({ ...sampleLifeSigns(NOW), since: '' }, NOW, fr, 'fr')).toBeNull();
    expect(chestLiveView(sampleLifeSigns(NOW), Number.NaN, fr, 'fr')).toBeNull();
  });

  it('gardent un graphique de 14 jours même avec une activité mal formée', () => {
    expect(normalizeActivity([1, 2])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
    expect(normalizeActivity(Array.from({ length: 20 }, (_, i) => i))).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 6),
    );
    expect(normalizeActivity([-3, Number.NaN, 2.6, 'x'] as unknown[]).slice(-4)).toEqual([
      0, 0, 3, 0,
    ]);
    expect(normalizeActivity(undefined)).toHaveLength(14);
    const empty = chestLiveView({ ...sampleLifeSigns(NOW), activity: [] }, NOW, fr, 'fr')!;
    expect(empty.max).toBe(1);
    expect(empty.bars.every((bar) => bar.level === 0)).toBe(true);
  });

  it('arrondissent un nombre de projets mal formé', () => {
    const view = chestLiveView({ ...sampleLifeSigns(NOW), running: -2 }, NOW, fr, 'fr')!;
    expect(view.running).toBe('0');
  });
});
