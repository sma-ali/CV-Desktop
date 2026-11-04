import { describe, expect, it } from 'vitest';
// Un test lit les vrais textes ; le navigateur, lui, les reçoit en props.
// eslint-disable-next-line no-restricted-imports
import { sheetsFr as frSheets } from '@/content/sheets/fr';
// eslint-disable-next-line no-restricted-imports
import { sheetsEn as enSheets } from '@/content/sheets/en';
import { FACTORY_GENRES, sampleLifeSigns, type LifeSigns } from '@/lib/life-signs';
import { factoryView, floorCompact } from './factoryView';

// La fiche de l'usine : chiffres arrondis vers le bas, champs facultatifs,
// données absentes ou mal formées.

const NOW = Date.UTC(2026, 10, 4, 14, 30);
const space = (value: string) => value.replace(/[  ]/g, ' ');

const view = (signs: LifeSigns | null, sheets = frSheets, locale = 'fr') =>
  factoryView(signs, NOW, sheets.ui.factory, sheets.ui.live, locale);

describe('floorCompact', () => {
  it('arrondit vers le bas, jamais au-dessus du vrai chiffre', () => {
    expect(space(floorCompact(2_499_999, 'fr'))).toBe('2,4 M');
    expect(space(floorCompact(38_999, 'fr'))).toBe('38 k');
    expect(floorCompact(1_999, 'en')).toBe('1.9K');
    expect(floorCompact(87, 'fr')).toBe('87');
  });

  it('tient bon face à un nombre faux', () => {
    expect(floorCompact(Number.NaN, 'fr')).toBe('0');
    expect(floorCompact(-5, 'fr')).toBe('0');
  });
});

describe("la fiche de l'usine", () => {
  it('affiche les chiffres globaux, vues et j’aime en « plus de »', () => {
    const result = view(sampleLifeSigns(NOW))!;
    expect(result.sample).toBe(true);
    expect(space(result.status)).toBe('En marche | dernière vidéo il y a 2 h 14');
    expect(result.figures.map((figure) => space(figure.value))).toEqual([
      '7',
      '412',
      '5',
      'plus de 2,4 M',
      'plus de 38 k',
    ]);
    expect(result.figures.map((figure) => figure.label)).toEqual([
      'chaînes',
      'vidéos',
      'par jour en moyenne',
      'vues depuis le début',
      "j'aime",
    ]);
  });

  it('donne un onglet par genre, dans l’ordre, avec ses chiffres', () => {
    const result = view(sampleLifeSigns(NOW))!;
    expect(result.genres.map((genre) => genre.id)).toEqual([...FACTORY_GENRES]);
    const marbles = result.genres[2]!;
    expect(marbles.tab).toBe('Billes 3D');
    expect(marbles.rows.map((row) => `${row.term}: ${space(row.value)}`)).toEqual([
      'Moteur: three.js, physique Rapier, rendu logiciel',
      'Publication: automatique',
      'Vues: plus de 1 M',
      'Rétention: 63 % en moyenne',
      'Refusées: 6 % avant publication',
      'Production: 18 min par vidéo',
    ]);
    expect(marbles.bars).toHaveLength(14);
    expect(Math.max(...marbles.bars.map((bar) => bar.level))).toBe(1);
    expect(marbles.chartLabel).toContain('6, 7, 6, 8');
  });

  it('accorde les libellés au singulier', () => {
    const signs = sampleLifeSigns(NOW);
    const one = { ...signs, factory: { ...signs.factory!, channels: 1, videos: 1 } };
    expect(
      view(one)!
        .figures.slice(0, 2)
        .map((figure) => figure.label),
    ).toEqual(['chaîne', 'vidéo']);
    expect(view(one, enSheets, 'en')!.figures[1]!.label).toBe('video');
  });

  it('cache les chiffres facultatifs absents', () => {
    const signs = sampleLifeSigns(NOW);
    const quiz = { views: 1200, activity: [1, 2] };
    const partial = {
      ...signs,
      factory: { ...signs.factory!, genres: { ...signs.factory!.genres, quiz } },
    };
    const genre = view(partial)!.genres[3]!;
    expect(genre.rows.map((row) => row.term)).toEqual(['Moteur', 'Données', 'Vues']);
    // Un graphique trop court se complète par des jours vides au début.
    expect(genre.bars.map((bar) => bar.value)).toEqual([...Array<number>(12).fill(0), 1, 2]);
  });

  it('ne montre rien sans les chiffres de l’usine', () => {
    expect(view(null)).toBeNull();
    const old = { ...sampleLifeSigns(NOW), factory: undefined };
    expect(view(old)).toBeNull();
  });

  it('garde « En marche » seul quand la dernière activité est illisible', () => {
    const signs = { ...sampleLifeSigns(NOW), lastActivityAt: 'hier' };
    expect(view(signs)!.status).toBe('En marche');
  });
});
