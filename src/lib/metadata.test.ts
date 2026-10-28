import { describe, expect, it } from 'vitest';
import { getContent } from '@/content';
import { buildExpressMetadata } from './metadata';

describe('métadonnées de la version express', () => {
  it('donnent titre, canonical, langues et Open Graph en français', () => {
    const metadata = buildExpressMetadata(getContent('fr'), 'fr');
    expect(metadata.title).toBe('Ali Smaani | Développeur Full-Stack');
    expect(metadata.alternates).toEqual({
      canonical: 'https://alismaani.fr/fr/express',
      languages: {
        fr: 'https://alismaani.fr/fr/express',
        en: 'https://alismaani.fr/en/express',
        'x-default': 'https://alismaani.fr/fr/express',
      },
    });
    expect(metadata.openGraph).toMatchObject({
      type: 'profile',
      firstName: 'Ali',
      lastName: 'Smaani',
      locale: 'fr_FR',
      alternateLocale: ['en_US'],
      url: 'https://alismaani.fr/fr/express',
      siteName: 'Ali Smaani',
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('suivent la langue en anglais', () => {
    const metadata = buildExpressMetadata(getContent('en'), 'en');
    expect(metadata.title).toBe('Ali Smaani | Full-Stack Developer');
    expect(metadata.alternates?.canonical).toBe('https://alismaani.fr/en/express');
    expect(metadata.openGraph).toMatchObject({ locale: 'en_US', alternateLocale: ['fr_FR'] });
  });
});
