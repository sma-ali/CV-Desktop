import { getContent, type Locale } from '@/content';
import type { TextPageContent } from '@/content/text-page';
import { deskPath, expressPath } from '@/lib/site';
import { PaperPage } from './PaperPage';
import styles from './TextPage.module.css';

// Une page de texte sur la page de papier (mentions légales, « Comment ce
// site est fait ») : titre, introduction, sections, date de mise à jour.
// Liens vers le bureau et la version express dans l'en-tête.
export function TextPage({
  locale,
  page,
  kicker,
  pathFor,
}: {
  locale: Locale;
  page: TextPageContent;
  kicker: string;
  pathFor: (locale: Locale) => string;
}) {
  const { ui } = getContent(locale);
  return (
    <PaperPage
      locale={locale}
      kicker={kicker}
      links={[
        { href: deskPath(locale), label: ui.backToDesk },
        { href: expressPath(locale), label: ui.kicker },
      ]}
      pathFor={pathFor}
      mainClassName={styles.prose}
    >
      <h1 className={styles.title}>{page.title}</h1>
      <p className={styles.intro}>{page.intro}</p>
      {page.sections.map((section) => (
        <section key={section.id} aria-labelledby={`section-${section.id}`}>
          <h2 id={`section-${section.id}`} className={styles.heading}>
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p className={styles.updated}>{page.updated}</p>
    </PaperPage>
  );
}
