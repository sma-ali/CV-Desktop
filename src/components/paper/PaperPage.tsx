import Link from 'next/link';
import type { ReactNode } from 'react';
import { getContent, localeNames, otherLocale, type Locale } from '@/content';
import { Paper } from './Paper';
import { PrintButton } from './PrintButton';
import styles from './PaperPage.module.css';

export interface PaperPageProps {
  locale: Locale;
  /** Le sur-titre de l'en-tête. */
  kicker: ReactNode;
  /** Les liens de l'en-tête, avant la bascule de langue. */
  links: ReadonlyArray<{ href: string; label: string }>;
  /** L'adresse de la même page dans une langue donnée (bascule de langue). */
  pathFor: (locale: Locale) => string;
  /** Le bouton « Imprimer » après la bascule de langue (version express). */
  print?: boolean;
  /** L'id de l'en-tête, cible d'un lien « Haut de page » : il prend alors le focus. */
  barId?: string;
  mainClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

// Une page de papier, rendue par le serveur : lien d'évitement vers le
// contenu, en-tête (sur-titre, liens, bascule de langue, impression),
// contenu principal et pied de page. La version express et les mentions
// légales la partagent.
export function PaperPage({
  locale,
  kicker,
  links,
  pathFor,
  print = false,
  barId,
  mainClassName,
  footer,
  children,
}: PaperPageProps) {
  const { ui } = getContent(locale);
  const other = otherLocale[locale];

  return (
    <div className={styles.page}>
      <a href="#contenu" className={styles.skip}>
        {ui.skipToContent}
      </a>
      <Paper>
        <header id={barId} tabIndex={barId ? -1 : undefined} className={styles.bar}>
          <p className={styles.kicker}>{kicker}</p>
          <div className={styles.tools}>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={styles.tool}>
                {link.label}
              </Link>
            ))}
            <nav aria-label={ui.languageNav}>
              <Link href={pathFor(other)} hrefLang={other} lang={other} className={styles.tool}>
                {localeNames[other]}
              </Link>
            </nav>
            {print ? (
              <PrintButton label={ui.print} className={`${styles.tool} ${styles.toolStrong}`} />
            ) : null}
          </div>
        </header>

        <main
          id="contenu"
          tabIndex={-1}
          className={mainClassName ? `${styles.main} ${mainClassName}` : styles.main}
        >
          {children}
        </main>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </Paper>
    </div>
  );
}
