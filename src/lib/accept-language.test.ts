import { describe, expect, it } from 'vitest';
import { negotiateLocale } from './accept-language';

describe('negotiateLocale', () => {
  it.each([
    // En-tête absent ou vide : le français.
    [undefined, 'fr'],
    [null, 'fr'],
    ['', 'fr'],
    // Langue simple.
    ['en', 'en'],
    ['fr', 'fr'],
    // Variantes régionales.
    ['en-GB', 'en'],
    ['en-US,en;q=0.9', 'en'],
    ['fr-CA', 'fr'],
    ['EN-gb', 'en'],
    // Pondérations (q-values).
    ['fr;q=0.4, en;q=0.8', 'en'],
    ['de-DE,de;q=0.9,en;q=0.8,fr;q=0.7', 'en'],
    ['fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', 'fr'],
    ['en;q=0.5, fr;q=0.5', 'en'],
    ['en;q=0, fr;q=0', 'fr'],
    ['en;q=1.000', 'en'],
    // Joker.
    ['*', 'fr'],
    ['de, *;q=0.5', 'fr'],
    ['de, en;q=0.3, *;q=0.5', 'fr'],
    ['fr;q=0, *', 'en'],
    // Langue non proposée : le français.
    ['de', 'fr'],
    ['es-ES,es;q=0.9', 'fr'],
    // En-tête illisible : le français, ou ce qui reste lisible.
    ['%%%', 'fr'],
    [';;;,,,', 'fr'],
    ['en;q=abc', 'fr'],
    ['en;q=2', 'fr'],
    ['en;q=abc, fr;q=0.1', 'fr'],
    ['xx-<script>, en;q=0.5', 'en'],
  ] as const)('« %s » donne %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it('résiste à un en-tête démesuré', () => {
    expect(negotiateLocale(`${'de;q=0.1,'.repeat(10_000)}en`)).toBe('fr');
  });
});
