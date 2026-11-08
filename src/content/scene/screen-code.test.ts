import { describe, expect, it } from 'vitest';
import { en } from '../en';
import { fr } from '../fr';
import { buildScreenCode, quote, SCREEN_CODE_WIDTH, type ScreenFacts } from './screen-code';
import { sceneEn } from './en';
import { sceneFr } from './fr';

// Le générateur du code de l'écran, avec des valeurs écrites en dur : si le
// CV change, ces attentes changent avec lui, en connaissance de cause.

describe('buildScreenCode', () => {
  it('écrit le parcours et le profil en français', () => {
    expect(buildScreenCode(fr, sceneFr.screen.words)).toEqual([
      'export const parcours = [',
      "  poste('2020-09', '2023-08', 'DEFI-METIERS',",
      "    'Développeur Web'),",
      "  poste('2024-01', '2026-06', 'DARES',",
      "    'Ingénieur applicatif & gestion de données'),",
      '];',
      'export const ali = {',
      "  titre: 'Dev FullStack | AI Engineer',",
      '  competences: voirPortable(),',
      "  zone: 'Île-de-France · remote possible',",
      '  disponible: true,',
      '} as const;',
    ]);
  });

  it('écrit le parcours et le profil en anglais', () => {
    expect(buildScreenCode(en, sceneEn.screen.words)).toEqual([
      'export const career = [',
      "  role('2020-09', '2023-08', 'DEFI-METIERS',",
      "    'Web Developer'),",
      "  role('2024-01', '2026-06', 'DARES',",
      "    'Application & Data Management Engineer'),",
      '];',
      'export const ali = {',
      "  title: 'Dev FullStack | AI Engineer',",
      '  skills: seeLaptop(),',
      "  location: 'Paris, France · Open to remote',",
      '  available: true,',
      '} as const;',
    ]);
  });

  it('reste court et lisible de loin', () => {
    for (const lines of [
      buildScreenCode(fr, sceneFr.screen.words),
      buildScreenCode(en, sceneEn.screen.words),
    ]) {
      expect(lines.length).toBeLessThanOrEqual(13);
      expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(SCREEN_CODE_WIDTH);
    }
  });

  const facts: ScreenFacts = {
    profile: {
      name: 'Test',
      headline: "Dev d'équipe",
      summary: 'Résumé',
      location: 'Lyon',
      availability: 'Disponible',
    },
    experiences: [
      {
        id: 'b',
        role: 'Second',
        organization: 'B',
        organizationDetail: 'B',
        period: { start: '2022-03', end: '2023-01' },
        highlights: ['x'],
      },
      {
        id: 'a',
        role: 'Premier',
        organization: 'A',
        organizationDetail: 'A',
        period: { start: '2019-01', end: '2021-12' },
        highlights: ['x'],
      },
    ],
    skills: [{ id: 's', label: 'S', items: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'] }],
  };
  const words = {
    list: 'jobs',
    entry: 'job',
    object: 'me',
    title: 'title',
    stack: 'stack',
    pointer: 'seeLaptop',
    location: 'city',
    available: 'free',
    stackItems: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
  };

  it('range les postes du plus ancien au plus récent et protège les apostrophes', () => {
    const lines = buildScreenCode(facts, words);
    expect(lines.slice(0, 5)).toEqual([
      'export const jobs = [',
      "  job('2019-01', '2021-12', 'A',",
      "    'Premier'),",
      "  job('2022-03', '2023-01', 'B',",
      "    'Second'),",
    ]);
    expect(lines).toContain("  title: 'Dev d\\'équipe',");
  });

  it('renvoie au portable pour les compétences', () => {
    expect(buildScreenCode(facts, words)).toContain('  stack: seeLaptop(),');
  });

  it('refuse une compétence absente du CV', () => {
    expect(() => buildScreenCode(facts, { ...words, stackItems: ['Cobol'] })).toThrow(/Cobol/);
  });

  it('écrit des chaînes TypeScript valides', () => {
    expect(quote("l'a\\b")).toBe("'l\\'a\\\\b'");
  });
});
