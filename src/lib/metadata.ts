import type { Metadata } from 'next';
import type { Content } from '@/content';
import { locales, type Locale } from '@/content/locales';
import type { TextPageContent } from '@/content/text-page';
import { absoluteUrl, deskPath, expressPath, legalPath, makingOfPath } from './site';

const openGraphLocales: Record<Locale, string> = { fr: 'fr_FR', en: 'en_US' };

// Titre de la page et des partages : « Ali Smaani | AI Engineer | Dev FullStack ».
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

// Adresses du bureau dans chaque langue. x-default est la racine, qui choisit
// la langue du navigateur.
export function deskAlternates(): Record<string, string> {
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(deskPath(locale))])),
    'x-default': absoluteUrl('/'),
  };
}

// Métadonnées de la version express. L'image Open Graph vient du fichier
// opengraph-image.tsx de la route, que Next.js ajoute de lui-même.
export function buildExpressMetadata(content: Content, locale: Locale): Metadata {
  return buildMetadata(content, locale, absoluteUrl(expressPath(locale)), expressAlternates());
}

// Adresses d'une page dans chaque langue, plus x-default (le français).
function pageAlternates(pathFor: (locale: Locale) => string): Record<string, string> {
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(pathFor(locale))])),
    'x-default': absoluteUrl(pathFor('fr')),
  };
}

// Adresses des mentions légales dans chaque langue, plus x-default (le français).
export function legalAlternates(): Record<string, string> {
  return pageAlternates(legalPath);
}

// Adresses de « Comment ce site est fait » dans chaque langue, plus x-default.
export function makingOfAlternates(): Record<string, string> {
  return pageAlternates(makingOfPath);
}

// Métadonnées d'une page de texte : son propre titre, pas d'image de partage.
export function buildTextPageMetadata(
  content: Content,
  page: TextPageContent,
  locale: Locale,
  pathFor: (locale: Locale) => string,
): Metadata {
  const url = absoluteUrl(pathFor(locale));
  const title = `${page.title} | ${content.profile.name}`;
  return {
    title,
    description: page.intro,
    alternates: { canonical: url, languages: pageAlternates(pathFor) },
    openGraph: { type: 'website', title, url, locale: openGraphLocales[locale] },
  };
}

// Métadonnées du bureau en 3D. Il partage l'image de partage de la version
// express de sa langue (générée au build par son opengraph-image.tsx).
export function buildDeskMetadata(content: Content, locale: Locale): Metadata {
  const metadata = buildMetadata(content, locale, absoluteUrl(deskPath(locale)), deskAlternates());
  const image = {
    url: absoluteUrl(`${expressPath(locale)}/opengraph-image`),
    width: 1200,
    height: 630,
    alt: content.profile.name,
  };
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [image] },
    twitter: { ...metadata.twitter, images: [image.url] },
  };
}

function buildMetadata(
  content: Content,
  locale: Locale,
  url: string,
  languages: Record<string, string>,
): Metadata {
  const { profile } = content;
  const title = pageTitle(content);
  const [firstName = profile.name, ...rest] = profile.name.split(' ');

  return {
    title,
    description: profile.summary,
    alternates: { canonical: url, languages },
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
