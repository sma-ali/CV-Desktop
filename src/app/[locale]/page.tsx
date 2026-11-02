import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeskShell } from '@/components/desk/DeskShell';
import { ExpressCv } from '@/components/express/ExpressCv';
import { getContent, isLocale } from '@/content';
import { buildDeskTexts, buildSceneTexts } from '@/lib/desk';
import { getLifeSigns } from '@/lib/life-signs/source';
import { buildDeskMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildDeskMetadata(getContent(locale), locale);
}

// Le bureau en 3D, rendu au build pour chaque langue. Le serveur envoie le
// HUD et le repli (la version express) ; la scène arrive ensuite dans le
// navigateur, avec ses textes en props. Les signes de vie du coffret passent
// aussi en props (données d'exemple jusqu'à l'étape 5).
export default async function DeskPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);
  const lifeSigns = await getLifeSigns();

  return (
    <DeskShell
      hud={buildDeskTexts(content, locale)}
      scene={buildSceneTexts(content, locale)}
      lifeSigns={lifeSigns}
    >
      <ExpressCv locale={locale} from="desk" />
    </DeskShell>
  );
}
