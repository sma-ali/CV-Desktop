import type { Locale } from '@/content/locales';

// Adresse publique du site : base des liens absolus (canonical, Open Graph,
// sitemap, JSON-LD).
export const SITE_URL = 'https://alismaani.fr';

export const SITE_ORIGIN = new URL(SITE_URL);

// Chemin de la version express dans une langue (« /fr/express »).
export function expressPath(locale: Locale): string {
  return `/${locale}/express`;
}

// Adresse complète d'un chemin du site.
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
