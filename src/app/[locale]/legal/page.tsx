import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaperPage } from '@/components/paper/PaperPage';
import { getContent, isLocale } from '@/content';
import { buildLegalMetadata } from '@/lib/metadata';
import { deskPath, expressPath, legalPath } from '@/lib/site';
import styles from './page.module.css';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/legal'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildLegalMetadata(getContent(locale), locale);
}

// Mentions légales et confidentialité, rendues au build pour chaque langue.
// Même page de papier que la version express.
export default async function LegalPage({ params }: PageProps<'/[locale]/legal'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { legal, ui } = getContent(locale);

  return (
    <PaperPage
      locale={locale}
      kicker={ui.legalLink}
      links={[
        { href: deskPath(locale), label: ui.backToDesk },
        { href: expressPath(locale), label: ui.kicker },
      ]}
      pathFor={legalPath}
      mainClassName={styles.prose}
    >
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
    </PaperPage>
  );
}
