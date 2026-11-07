import type { Locale } from '@/content/locales';

// Adresse publique du site : base des liens absolus (canonical, Open Graph,
// sitemap, JSON-LD).
const SITE_URL = 'https://alismaani.fr';

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

// Chemin du CV en PDF dans une langue (« /cv/ali-smaani-cv-fr.pdf »), fichier
// statique de public/ produit par scripts/cv-pdf.mjs depuis la version express.
export function cvPdfPath(locale: Locale): string {
  return `/cv/ali-smaani-cv-${locale}.pdf`;
}

// Adresse complète d'un chemin du site.
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
