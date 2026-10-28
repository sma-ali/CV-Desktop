import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContent, isLocale, localeNames, type Locale } from '@/content';

const otherLocale: Record<Locale, Locale> = { fr: 'en', en: 'fr' };

// Page provisoire du socle : elle prouve que le contenu validé arrive jusqu'au
// HTML. La version express et le bureau en 3D la remplaceront.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { profile } = getContent(locale);
  const other = otherLocale[locale];

  return (
    <main className="home">
      <h1>{profile.name}</h1>
      <p className="headline">{profile.headline}</p>
      <p>{profile.summary}</p>
      <nav>
        <Link href={`/${other}`} hrefLang={other} lang={other}>
          {localeNames[other]}
        </Link>
      </nav>
    </main>
  );
}
