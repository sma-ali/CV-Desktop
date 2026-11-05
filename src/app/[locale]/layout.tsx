import type { Metadata, Viewport } from 'next';
import { Caveat, Fraunces, IBM_Plex_Mono, Pixelify_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getContent, isLocale, locales } from '@/content';
import { SITE_ORIGIN } from '@/lib/site';
import { pageTitle } from '@/lib/metadata';
import './globals.css';

// Polices téléchargées au build et servies par le site lui-même (CSP font-src 'self').
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-fraunces',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-mono',
});

// Essai : Pixelify Sans pour toute l'interface.
const pixel = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-pixel',
});

// L'écriture à la main des textures du bureau (post-it, notes). Pas de
// préchargement : seule la scène 3D s'en sert, après le premier affichage.
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-caveat',
});

// Seules les langues connues existent : /de répond 404 sans passer par le rendu.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9dec6' },
    { media: '(prefers-color-scheme: dark)', color: '#120e0b' },
  ],
};

// Valeurs par défaut de toutes les pages d'une langue ; chaque page précise les siennes.
export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);
  return {
    metadataBase: SITE_ORIGIN,
    title: pageTitle(content),
    description: content.profile.summary,
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${plexMono.variable} ${caveat.variable} ${pixel.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
