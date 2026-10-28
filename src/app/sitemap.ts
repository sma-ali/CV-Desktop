import type { MetadataRoute } from 'next';
import { locales } from '@/content/locales';
import { expressAlternates } from '@/lib/metadata';
import { absoluteUrl, expressPath } from '@/lib/site';

// Les deux versions express, chacune avec ses équivalents dans l'autre langue.
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: absoluteUrl(expressPath(locale)),
    alternates: { languages: expressAlternates() },
  }));
}
