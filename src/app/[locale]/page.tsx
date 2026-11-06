import type { Metadata } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { DeskShell } from '@/components/desk/DeskShell';
import { ExpressCv } from '@/components/express/ExpressCv';
import { getContent, isLocale } from '@/content';
import { buildDeskTexts, buildSceneTexts } from '@/lib/desk';
import { getLifeSigns } from '@/lib/life-signs/source';
import { buildDeskMetadata } from '@/lib/metadata';

// L'interface du bureau parle en Pixelify Sans : chargée ici, elle n'est ni
// téléchargée ni préchargée par la version express et les mentions légales.
// Police variable : un seul fichier pour les graisses de 400 à 700.
const pixel = Pixelify_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildDeskMetadata(getContent(locale), locale);
}

// La page se régénère au plus toutes les 10 minutes (la durée du cache du
// JSON public, LIFE_SIGNS_REVALIDATE_S) : le premier affichage porte des
// signes de vie récents. Next exige ici une valeur littérale.
export const revalidate = 600;

// Le bureau en 3D, rendu au build pour chaque langue, puis régénéré. Le
// serveur envoie le HUD et le repli (la version express) ; la scène arrive
// ensuite dans le navigateur, avec ses textes en props. Les signes de vie du
// coffret passent aussi en props : le JSON public, ou les données d'exemple
// si sa lecture échoue (getLifeSigns).
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
      fontClassName={pixel.variable}
    >
      <ExpressCv locale={locale} from="desk" />
    </DeskShell>
  );
}
