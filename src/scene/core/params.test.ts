import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_DRAG, parseTestParams } from './params';

describe('?tourne', () => {
  it('lit deux angles en radians', () => {
    expect(parseTestParams('?t=11000&tourne=0.5,-1.2').turn).toEqual({ x: 0.5, y: -1.2 });
    expect(parseTestParams('?tourne=2,3').turn).toEqual({ x: 2, y: 3 });
  });

  it('ignore une valeur absente ou illisible', () => {
    expect(parseTestParams('?t=11000').turn).toBeNull();
    expect(parseTestParams('?tourne').turn).toBeNull();
    expect(parseTestParams('?tourne=a,b').turn).toBeNull();
    expect(parseTestParams('?tourne=1').turn).toBeNull();
  });
});

describe('paramètres de test', () => {
  it('donnent les valeurs par défaut sans paramètre', () => {
    expect(parseTestParams('')).toEqual({
      t: null,
      frozen: false,
      hour: null,
      auto: true,
      reduced: false,
      present: null,
      mood: null,
      recto: false,
      drag: null,
      noShadow: false,
      noPost: false,
      scatter: false,
      turn: null,
    });
  });

  it('lisent ?desordre', () => {
    expect(parseTestParams('?t=11000&desordre').scatter).toBe(true);
  });

  it('lisent ?recto et ?glisse', () => {
    expect(parseTestParams('?prendre=card&recto')).toMatchObject({ present: 'card', recto: true });
    // ?glisse seul : le portable poussé sur la carte.
    expect(parseTestParams('?glisse').drag).toEqual(DEFAULT_TEST_DRAG);
    expect(DEFAULT_TEST_DRAG).toEqual({ item: 'laptop', x: -0.3, z: 2.15 });
    expect(parseTestParams('?glisse=mug:1.5,-0.25').drag).toEqual({
      item: 'mug',
      x: 1.5,
      z: -0.25,
    });
    // Un objet qui ne glisse pas, ou une place mal écrite : rien.
    expect(parseTestParams('?glisse=postit:1,1').drag).toBeNull();
    expect(parseTestParams('?glisse=book:1').drag).toBeNull();
  });

  it("lisent l'horloge, la visite, l'heure, le mouvement réduit et l'objet présenté", () => {
    const params = parseTestParams('?t=11000&fige&auto=0&heure=14.5&reduit&prendre=book');
    expect(params).toMatchObject({
      t: 11,
      frozen: true,
      auto: false,
      hour: 14.5,
      reduced: true,
      present: 'book',
    });
  });

  it('ignorent un objet, une ambiance ou un nombre inconnus', () => {
    const params = parseTestParams('?t=abc&heure=&prendre=livre&ambiance=aube');
    expect(params).toMatchObject({ t: null, hour: null, present: null, mood: null });
  });

  it('ramènent l’heure entre 0 et 24 et le temps à zéro au moins', () => {
    expect(parseTestParams('?heure=25').hour).toBe(1);
    expect(parseTestParams('?heure=-1').hour).toBe(23);
    expect(parseTestParams('?t=-500').t).toBe(0);
  });

  it('acceptent une ambiance forcée', () => {
    expect(parseTestParams('?ambiance=night').mood).toBe('night');
  });
});
