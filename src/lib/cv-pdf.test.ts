import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getContent, locales, type Content, type Locale } from '@/content';
import { cvPdfPath } from './site';

// Le CV en PDF (public/cv/) est produit par scripts/cv-pdf.mjs depuis la
// version express. Ce test garde une empreinte de ce qui le compose : le
// contenu du CV et le composant qui le met en page. Si l'un change sans que le
// PDF soit refait, le test échoue : lancer `npm run cv:pdf`, qui refait les
// PDF puis l'empreinte (vitest -u).

// Fichiers dont la mise en page passe dans le PDF.
const LAYOUT_FILES = [
  'src/components/express/ExpressCv.tsx',
  'src/components/express/ExpressCv.module.css',
];

// Parties du contenu imprimées dans le PDF.
const CV_KEYS = [
  'profile',
  'contact',
  'sections',
  'experiences',
  'projects',
  'education',
  'skills',
  'softSkills',
  'languages',
  'interests',
  'ui',
] as const satisfies ReadonlyArray<keyof Content>;

function fingerprint(locale: Locale): string {
  // Le bureau, ses fiches, le formulaire (masqué à l'impression) et les
  // mentions légales n'entrent pas dans le PDF.
  const content = getContent(locale);
  const cv = CV_KEYS.map((key) => content[key]);
  const hash = createHash('sha256').update(JSON.stringify(cv));
  for (const file of LAYOUT_FILES) hash.update(readFileSync(resolve(file)));
  return hash.digest('hex').slice(0, 16);
}

describe('CV en PDF', () => {
  it.each(locales)('le PDF %s existe', (locale) => {
    expect(existsSync(resolve('public', `.${cvPdfPath(locale)}`))).toBe(true);
  });

  it('suit le contenu et la mise en page du CV (sinon : npm run cv:pdf)', async () => {
    const prints = Object.fromEntries(locales.map((locale) => [locale, fingerprint(locale)]));
    await expect(`${JSON.stringify(prints, null, 2)}\n`).toMatchFileSnapshot(
      '../../public/cv/empreinte.json',
    );
  });
});
