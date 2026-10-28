import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getContent, isLocale, locales } from '@/content';
import { displayUrl } from '@/lib/urls';

// Image de partage (Open Graph), générée au build pour chaque langue : le nom
// et le titre sur une feuille de papier, à l'encre.
export const alt = getContent('fr').profile.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Une image par langue, au build ; aucune autre langue n'existe.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const paper = '#f4ecd9';
const ink = '#1f1710';
const red = '#8d2a20';
const muted = '#6b5843';

// Polices lues sur le disque (paquets @fontsource, licence OFL) : aucune requête externe.
function font(path: string) {
  return readFile(join(process.cwd(), 'node_modules/@fontsource', path));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { profile, contact, ui } = getContent(isLocale(locale) ? locale : 'fr');
  const [serif, serifItalic, mono] = await Promise.all([
    font('fraunces/files/fraunces-latin-600-normal.woff'),
    font('fraunces/files/fraunces-latin-400-italic.woff'),
    font('ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff'),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 36,
        background: '#e9dec6',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 72px',
          background: paper,
          color: ink,
          border: `1px solid rgba(31, 23, 16, 0.18)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Plex Mono',
            fontSize: 24,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: red,
          }}
        >
          {`${ui.kicker} | ${ui.kickerDetail}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: 'Fraunces',
              fontSize: 148,
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            {profile.name}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: 'Fraunces Italic',
              fontSize: 54,
              color: red,
            }}
          >
            {profile.headline}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 22,
            borderTop: `2px solid ${ink}`,
            fontFamily: 'Plex Mono',
            fontSize: 24,
            letterSpacing: 2,
            color: muted,
          }}
        >
          <span>{profile.location}</span>
          <span>{displayUrl(contact.website)}</span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: serif, weight: 600, style: 'normal' },
        { name: 'Fraunces Italic', data: serifItalic, weight: 400, style: 'italic' },
        { name: 'Plex Mono', data: mono, weight: 600, style: 'normal' },
      ],
    },
  );
}
