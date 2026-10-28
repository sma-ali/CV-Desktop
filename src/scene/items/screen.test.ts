import { describe, expect, it } from 'vitest';
import { codeLength, cursorLine, tokenize } from './screen';

describe('tokenize', () => {
  it('colore mots-clés, appels, clés, chaînes et ponctuation', () => {
    expect(tokenize("  poste('2020-09', 'DARES'),")).toEqual([
      ['  ', 'punctuation'],
      ['poste', 'call'],
      ['(', 'punctuation'],
      ["'2020-09'", 'string'],
      [',', 'punctuation'],
      [' ', 'punctuation'],
      ["'DARES'", 'string'],
      [')', 'punctuation'],
      [',', 'punctuation'],
    ]);
    expect(tokenize('export const ali = {').map(([, kind]) => kind)).toEqual([
      'keyword',
      'punctuation',
      'keyword',
      'punctuation',
      'name',
      'punctuation',
      'punctuation',
      'punctuation',
      'punctuation',
    ]);
    expect(tokenize('  disponible: true,')).toEqual([
      ['  ', 'punctuation'],
      ['disponible', 'key'],
      [':', 'punctuation'],
      [' ', 'punctuation'],
      ['true', 'keyword'],
      [',', 'punctuation'],
    ]);
  });

  it('garde les apostrophes échappées dans la chaîne et les commentaires entiers', () => {
    expect(tokenize("x = 'l\\'a' // fin")).toEqual([
      ['x', 'name'],
      [' ', 'punctuation'],
      ['=', 'punctuation'],
      [' ', 'punctuation'],
      ["'l\\'a'", 'string'],
      [' ', 'punctuation'],
      ['// fin', 'comment'],
    ]);
  });
});

describe('frappe', () => {
  const code = ['abc', '', 'de'];

  it('compte les caractères sans les retours à la ligne', () => {
    expect(codeLength(code)).toBe(5);
  });

  it('suit la ligne du curseur', () => {
    expect(cursorLine(code, 0)).toBe(0);
    expect(cursorLine(code, 3)).toBe(0);
    expect(cursorLine(code, 4)).toBe(2);
    expect(cursorLine(code, 99)).toBe(2);
  });
});
