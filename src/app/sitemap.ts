import type { MetadataRoute } from 'next';
import { locales } from '@/content/locales';
import { deskAlternates, expressAlternates } from '@/lib/metadata';
import { absoluteUrl, deskPath, expressPath } from '@/lib/site';

// Le bureau et la version express dans chaque langue, chacun avec ses
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
  ];
}
