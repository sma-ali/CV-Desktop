import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExpressCv } from '@/components/express/ExpressCv';
import { PrintButton } from '@/components/express/PrintButton';
import { getContent, isLocale, localeNames, type Locale } from '@/content';
import { buildProfilePageJsonLd, serializeJsonLd } from '@/lib/json-ld';
import { buildExpressMetadata } from '@/lib/metadata';
import { expressPath } from '@/lib/site';
import { displayUrl } from '@/lib/urls';
import styles from './page.module.css';

const otherLocale: Record<Locale, Locale> = { fr: 'en', en: 'fr' };

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/express'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildExpressMetadata(getContent(locale), locale);
}

// La version express : le CV en une page, rendu au build pour chaque langue.
export default async function ExpressPage({ params }: PageProps<'/[locale]/express'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = getContent(locale);
  const { profile, contact, ui } = content;
  const other = otherLocale[locale];

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildProfilePageJsonLd(content, locale)),
        }}
      />
      <a href="#contenu" className={styles.skip}>
        {ui.skipToContent}
      </a>
      <div className={styles.sheet}>
        {/* Cible du lien « Haut de page » : le focus revient avant les outils. */}
        <header id="haut" tabIndex={-1} className={styles.bar}>
          <p className={styles.kicker}>
            {ui.kicker}
            <span className={styles.kickerSeparator}> | </span>
            <span className={styles.kickerDetail}>{ui.kickerDetail}</span>
          </p>
          <div className={styles.tools}>
            <nav aria-label={ui.languageNav}>
              <Link href={expressPath(other)} hrefLang={other} lang={other} className={styles.tool}>
                {localeNames[other]}
              </Link>
            </nav>
            <PrintButton label={ui.print} className={`${styles.tool} ${styles.toolStrong}`} />
          </div>
        </header>

        <main id="contenu" tabIndex={-1} className={styles.main}>
          <ExpressCv locale={locale} />
        </main>

        <footer className={styles.footer}>
          <p className={styles.footerText}>
            {profile.name} | <a href={contact.website}>{displayUrl(contact.website)}</a>
          </p>
          <a href="#haut" className={styles.footerLink}>
            {ui.backToTop}
          </a>
        </footer>
      </div>
    </div>
  );
}
