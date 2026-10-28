import type { Metadata } from 'next';
import type { Content } from '@/content';
import { locales, type Locale } from '@/content/locales';
import { absoluteUrl, expressPath } from './site';

const openGraphLocales: Record<Locale, string> = { fr: 'fr_FR', en: 'en_US' };

// Titre de la page et des partages : « Ali Smaani | Développeur Full-Stack ».
export function pageTitle(content: Content): string {
  return `${content.profile.name} | ${content.profile.headline}`;
}

// Adresses de la version express dans chaque langue, plus x-default (le français).
export function expressAlternates(): Record<string, string> {
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(expressPath(locale))])),
    'x-default': absoluteUrl(expressPath('fr')),
  };
}

// Métadonnées de la version express. L'image Open Graph vient du fichier
// opengraph-image.tsx de la route, que Next.js ajoute de lui-même.
export function buildExpressMetadata(content: Content, locale: Locale): Metadata {
  const { profile } = content;
  const title = pageTitle(content);
  const url = absoluteUrl(expressPath(locale));
  const [firstName = profile.name, ...rest] = profile.name.split(' ');

  return {
    title,
    description: profile.summary,
    alternates: { canonical: url, languages: expressAlternates() },
    openGraph: {
      type: 'profile',
      firstName,
      lastName: rest.join(' ') || undefined,
      locale: openGraphLocales[locale],
      alternateLocale: locales
        .filter((other) => other !== locale)
        .map((other) => openGraphLocales[other]),
      url,
      siteName: profile.name,
      title,
      description: profile.summary,
    },
    twitter: { card: 'summary_large_image', title, description: profile.summary },
    robots: { index: true, follow: true },
  };
}
