import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getContent, isLocale, locales } from '@/content';
import './globals.css';

// Seules les langues connues existent : /de répond 404 sans passer par le rendu.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
};

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { profile } = getContent(locale);
  return {
    metadataBase: new URL('https://alismaani.fr'),
    title: `${profile.name} | ${profile.headline}`,
    description: profile.summary,
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
