import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('liste les deux versions express avec leurs équivalents', () => {
    const languages = {
      fr: 'https://alismaani.fr/fr/express',
      en: 'https://alismaani.fr/en/express',
      'x-default': 'https://alismaani.fr/fr/express',
    };
    expect(sitemap()).toEqual([
      { url: 'https://alismaani.fr/fr/express', alternates: { languages } },
      { url: 'https://alismaani.fr/en/express', alternates: { languages } },
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
