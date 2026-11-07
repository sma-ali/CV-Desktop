import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExpressCv } from '@/components/express/ExpressCv';
import { PaperPage } from '@/components/paper/PaperPage';
import { getContent, isLocale } from '@/content';
import { buildProfilePageJsonLd, serializeJsonLd } from '@/lib/json-ld';
import { buildExpressMetadata } from '@/lib/metadata';
import { deskPath, expressPath, legalPath, makingOfPath } from '@/lib/site';
import { displayUrl } from '@/lib/urls';
import styles from './page.module.css';

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildProfilePageJsonLd(content, locale)),
        }}
      />
      <PaperPage
        locale={locale}
        kicker={
          <>
            {ui.kicker}
            <span className={styles.kickerSeparator}> | </span>
            <span className={styles.kickerDetail}>{ui.kickerDetail}</span>
          </>
        }
        links={[{ href: deskPath(locale), label: ui.backToDesk }]}
        pathFor={expressPath}
        print
        // Cible du lien « Haut de page » : le focus revient avant les outils.
        barId="haut"
        footer={
          <>
            <p className={styles.footerText}>
              {profile.name} | <a href={contact.website}>{displayUrl(contact.website)}</a>
            </p>
            <span className={styles.footerLinks}>
              <Link href={makingOfPath(locale)} className={styles.footerLink}>
                {ui.makingOfLink}
              </Link>
              <Link href={legalPath(locale)} className={styles.footerLink}>
                {ui.legalLink}
              </Link>
              <a href="#haut" className={styles.footerLink}>
                {ui.backToTop}
              </a>
            </span>
          </>
        }
      >
        <ExpressCv locale={locale} />
      </PaperPage>
    </>
  );
}
