import { describe, expect, it } from 'vitest';
// Un test lit les vrais textes ; le navigateur, lui, les reçoit en props.
// eslint-disable-next-line no-restricted-imports
import { sheetsFr as frSheets } from '@/content/sheets/fr';
// eslint-disable-next-line no-restricted-imports
import { sheetsEn as enSheets } from '@/content/sheets/en';
import { FACTORY_GENRES, sampleLifeSigns, type LifeSigns } from '@/lib/life-signs';
import { factoryView, floorCompact, normalizeActivity } from './factoryView';

// La fiche de l'usine : chiffres globaux arrondis vers le bas, dernière
// vidéo en jours (jamais d'heure), aucun chiffre par genre, données absentes
// ou mal formées.

const NOW = Date.UTC(2026, 10, 4, 14, 30);
const space = (value: string) => value.replace(/[  ]/g, ' ');

const view = (signs: LifeSigns | null, sheets = frSheets, locale = 'fr') =>
  factoryView(signs, NOW, sheets.ui.factory, locale);

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

describe('normalizeActivity', () => {
  it('rend toujours 14 jours entiers et positifs', () => {
    expect(normalizeActivity([1, 2])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
    expect(normalizeActivity(Array.from({ length: 20 }, (_, i) => i))).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 6),
    );
    expect(normalizeActivity([-3, Number.NaN, 2.6, 'x'] as unknown[]).slice(-4)).toEqual([
      0, 0, 3, 0,
    ]);
    expect(normalizeActivity(undefined)).toHaveLength(14);
  });
});

describe("la fiche de l'usine", () => {
  it('affiche les chiffres globaux, vidéos, vues et j’aime en « plus de »', () => {
    const result = view(sampleLifeSigns(NOW))!;
    expect(result.sample).toBe(true);
    expect(space(result.status)).toBe("En marche | dernière vidéo aujourd'hui");
    expect(result.figures.map((figure) => space(figure.value))).toEqual([
      '6',
      'plus de 200',
      '8',
      'plus de 120 k',
      'plus de 5 k',
    ]);
    expect(result.figures.map((figure) => figure.label)).toEqual([
      'chaînes',
      'vidéos',
      'par jour en moyenne',
      'vues depuis le début',
      "j'aime",
    ]);
    expect(result.since).toBe('depuis septembre 2026');
    expect(view(sampleLifeSigns(NOW), enSheets, 'en')!.since).toBe('since September 2026');
  });

  it('dit la dernière vidéo en jours UTC, jamais en heures', () => {
    const at = (iso: string, sheets = frSheets, locale = 'fr') =>
      space(view({ ...sampleLifeSigns(NOW), lastActivityAt: iso }, sheets, locale)!.status);
    expect(at('2026-11-04T00:00:00.000Z')).toBe("En marche | dernière vidéo aujourd'hui");
    expect(at('2026-11-03T00:00:00.000Z')).toBe('En marche | dernière vidéo hier');
    expect(at('2026-11-01T00:00:00.000Z')).toBe('En marche | dernière vidéo il y a 3 jours');
    // Une date dans le futur (horloge en retard) se lit « aujourd'hui ».
    expect(at('2026-11-06T00:00:00.000Z')).toBe("En marche | dernière vidéo aujourd'hui");
    expect(at('2026-11-03T00:00:00.000Z', enSheets, 'en')).toBe('Running | last video yesterday');
    expect(at('2026-11-02T00:00:00.000Z', enSheets, 'en')).toBe('Running | last video 2 days ago');
    expect(at('2026-10-30T00:00:00.000Z', enSheets, 'en')).toBe('Running | last video 5 days ago');
    expect(view(sampleLifeSigns(NOW))!.status).not.toMatch(/\d\s*(h|min)\b/);
  });

  it('montre un seul graphique global sur 14 jours', () => {
    const signs = sampleLifeSigns(NOW);
    const result = view(signs)!;
    expect(result.bars).toHaveLength(14);
    expect(Math.max(...result.bars.map((bar) => bar.level))).toBe(1);
    expect(result.chartLabel).toBe(
      "Vidéos publiées ces 14 derniers jours, toutes chaînes, du plus ancien à aujourd'hui : " +
        signs.activity.join(', '),
    );
    expect(result.axisStart).toBe('Il y a 14 jours');
    expect(result.axisEnd).toBe("Aujourd'hui");
  });

  it('donne un onglet par genre, dans l’ordre, sans aucun chiffre', () => {
    const result = view(sampleLifeSigns(NOW))!;
    expect(result.genres.map((genre) => genre.id)).toEqual([...FACTORY_GENRES]);
    const marbles = result.genres[2]!;
    expect(marbles.tab).toBe('Billes 3D');
    expect(marbles.rows).toEqual(frSheets.ui.factory.genres.marbles.rows);
    for (const genre of result.genres) {
      expect(Object.keys(genre).sort()).toEqual(['body', 'id', 'rows', 'tab', 'title']);
    }
  });

  it('accorde les libellés au singulier', () => {
    const signs = sampleLifeSigns(NOW);
    const one = { ...signs, factory: { ...signs.factory, channels: 1, videos: 1 } };
    expect(
      view(one)!
        .figures.slice(0, 2)
        .map((figure) => figure.label),
    ).toEqual(['chaîne', 'vidéo']);
    expect(view(one, enSheets, 'en')!.figures[1]!.label).toBe('video');
  });

  it('ne montre rien sans les chiffres de l’usine', () => {
    expect(view(null)).toBeNull();
    const old = { ...sampleLifeSigns(NOW), factory: undefined } as unknown as LifeSigns;
    expect(view(old)).toBeNull();
  });

  it('garde « En marche » seul quand les dates sont illisibles', () => {
    const signs = { ...sampleLifeSigns(NOW), lastActivityAt: 'hier', since: 'autrefois' };
    const result = view(signs)!;
    expect(result.status).toBe('En marche');
    expect(result.since).toBeNull();
  });
});
