import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('liste les bureaux, les versions express, les coulisses et les mentions légales avec leurs équivalents', () => {
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
    const makingOf = {
      fr: 'https://alismaani.fr/fr/making-of',
      en: 'https://alismaani.fr/en/making-of',
      'x-default': 'https://alismaani.fr/fr/making-of',
    };
    const legal = {
      fr: 'https://alismaani.fr/fr/legal',
      en: 'https://alismaani.fr/en/legal',
      'x-default': 'https://alismaani.fr/fr/legal',
    };
    expect(sitemap()).toEqual([
      { url: 'https://alismaani.fr/fr', alternates: { languages: desk } },
      { url: 'https://alismaani.fr/en', alternates: { languages: desk } },
      { url: 'https://alismaani.fr/fr/express', alternates: { languages: express } },
      { url: 'https://alismaani.fr/en/express', alternates: { languages: express } },
      { url: 'https://alismaani.fr/fr/making-of', alternates: { languages: makingOf } },
      { url: 'https://alismaani.fr/en/making-of', alternates: { languages: makingOf } },
      { url: 'https://alismaani.fr/fr/legal', alternates: { languages: legal } },
      { url: 'https://alismaani.fr/en/legal', alternates: { languages: legal } },
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
