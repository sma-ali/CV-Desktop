import type { MetadataRoute } from 'next';
import { locales } from '@/content/locales';
import { deskAlternates, expressAlternates, legalAlternates } from '@/lib/metadata';
import { absoluteUrl, deskPath, expressPath, legalPath } from '@/lib/site';

// Le bureau, la version express et les mentions légales dans chaque langue, chacun avec ses
// équivalents dans l'autre langue.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...locales.map((locale) => ({
      url: absoluteUrl(deskPath(locale)),
      alternates: { languages: deskAlternates() },
    })),
    ...locales.map((locale) => ({
      url: absoluteUrl(expressPath(locale)),
      alternates: { languages: expressAlternates() },
    })),
    ...locales.map((locale) => ({
      url: absoluteUrl(legalPath(locale)),
      alternates: { languages: legalAlternates() },
    })),
  ];
}
