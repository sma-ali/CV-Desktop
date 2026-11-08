import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TextPage } from '@/components/paper/TextPage';
import { getContent, isLocale } from '@/content';
import { buildTextPageMetadata } from '@/lib/metadata';
import { makingOfPath } from '@/lib/site';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/making-of'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);
  return buildTextPageMetadata(content, content.makingOf, locale, makingOfPath);
}

// « Comment ce site est fait » : les choix techniques, pour le lecteur qui
// veut ouvrir le capot. Rendue au build pour chaque langue.
export default async function MakingOfPage({ params }: PageProps<'/[locale]/making-of'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { makingOf, ui } = getContent(locale);
  return (
    <TextPage locale={locale} page={makingOf} kicker={ui.makingOfLink} pathFor={makingOfPath} />
  );
}
