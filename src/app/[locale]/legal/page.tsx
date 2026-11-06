import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContent, isLocale, localeNames, type Locale } from '@/content';
import { buildLegalMetadata } from '@/lib/metadata';
import { deskPath, expressPath, legalPath } from '@/lib/site';
import shell from '../express/page.module.css';
import styles from './page.module.css';

const otherLocale: Record<Locale, Locale> = { fr: 'en', en: 'fr' };

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/legal'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildLegalMetadata(getContent(locale), locale);
}

// Mentions légales et confidentialité, rendues au build pour chaque langue.
// Même feuille de papier que la version express.
export default async function LegalPage({ params }: PageProps<'/[locale]/legal'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { legal, ui } = getContent(locale);
  const other = otherLocale[locale];

  return (
    <div className={shell.page}>
      <a href="#contenu" className={shell.skip}>
        {ui.skipToContent}
      </a>
      <div className={shell.sheet}>
        <header className={shell.bar}>
          <p className={shell.kicker}>{ui.legalLink}</p>
          <div className={shell.tools}>
            <Link href={deskPath(locale)} className={shell.tool}>
              {ui.backToDesk}
            </Link>
            <Link href={expressPath(locale)} className={shell.tool}>
              {ui.kicker}
            </Link>
            <nav aria-label={ui.languageNav}>
              <Link href={legalPath(other)} hrefLang={other} lang={other} className={shell.tool}>
                {localeNames[other]}
              </Link>
            </nav>
          </div>
        </header>

        <main id="contenu" tabIndex={-1} className={`${shell.main} ${styles.prose}`}>
          <h1 className={styles.title}>{legal.title}</h1>
          <p className={styles.intro}>{legal.intro}</p>
          {legal.sections.map((section) => (
            <section key={section.id} aria-labelledby={`legal-${section.id}`}>
              <h2 id={`legal-${section.id}`} className={styles.heading}>
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p className={styles.updated}>{legal.updated}</p>
        </main>
      </div>
    </div>
  );
}
