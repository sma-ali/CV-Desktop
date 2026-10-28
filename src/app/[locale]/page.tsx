import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeskShell } from '@/components/desk/DeskShell';
import { ExpressCv } from '@/components/express/ExpressCv';
import { getContent, isLocale } from '@/content';
import { buildDeskTexts, buildSceneTexts } from '@/lib/desk';
import { buildDeskMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildDeskMetadata(getContent(locale), locale);
}

// Le bureau en 3D, rendu au build pour chaque langue. Le serveur envoie le
// HUD et le repli (la version express) ; la scène arrive ensuite dans le
// navigateur, avec ses textes en props.
export default async function DeskPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);

  return (
    <DeskShell hud={buildDeskTexts(content, locale)} scene={buildSceneTexts(content, locale)}>
      <ExpressCv locale={locale} />
    </DeskShell>
  );
}
