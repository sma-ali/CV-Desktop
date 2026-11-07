import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TextPage } from '@/components/paper/TextPage';
import { getContent, isLocale } from '@/content';
import { buildTextPageMetadata } from '@/lib/metadata';
import { legalPath } from '@/lib/site';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/legal'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);
  return buildTextPageMetadata(content, content.legal, locale, legalPath);
}

// Mentions légales et confidentialité, rendues au build pour chaque langue.
// Même page de papier que la version express.
export default async function LegalPage({ params }: PageProps<'/[locale]/legal'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { legal, ui } = getContent(locale);
  return <TextPage locale={locale} page={legal} kicker={ui.legalLink} pathFor={legalPath} />;
}
