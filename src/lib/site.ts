import type { Locale } from '@/content/locales';

// Adresse publique du site : base des liens absolus (canonical, Open Graph,
// sitemap, JSON-LD).
export const SITE_URL = 'https://alismaani.fr';

export const SITE_ORIGIN = new URL(SITE_URL);

// Chemin du bureau en 3D dans une langue (« /fr »).
export function deskPath(locale: Locale): string {
  return `/${locale}`;
}

// Chemin de la version express dans une langue (« /fr/express »).
export function expressPath(locale: Locale): string {
  return `/${locale}/express`;
}

// Chemin des mentions légales dans une langue (« /fr/legal »).
export function legalPath(locale: Locale): string {
  return `/${locale}/legal`;
}

// Adresse complète d'un chemin du site.
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
