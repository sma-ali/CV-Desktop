import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('liste les deux bureaux et les deux versions express avec leurs équivalents', () => {
    const desk = {
      fr: 'https://alismaani.fr/fr',
      en: 'https://alismaani.fr/en',
      'x-default': 'https://alismaani.fr/',
    };
    const express = {
      fr: 'https://alismaani.fr/fr/express',
      en: 'https://alismaani.fr/en/express',
      'x-default': 'https://alismaani.fr/fr/express',
    };
    expect(sitemap()).toEqual([
      { url: 'https://alismaani.fr/fr', alternates: { languages: desk } },
      { url: 'https://alismaani.fr/en', alternates: { languages: desk } },
      { url: 'https://alismaani.fr/fr/express', alternates: { languages: express } },
      { url: 'https://alismaani.fr/en/express', alternates: { languages: express } },
    ]);
  });
});

describe('robots', () => {
  it('autorise tout et donne le sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://alismaani.fr/sitemap.xml',
    });
  });
});
