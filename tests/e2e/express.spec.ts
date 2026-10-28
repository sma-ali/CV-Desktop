import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent, locales, type Locale } from '../../src/content';

// Valeurs écrites en dur : ces tests ne comparent pas le contenu qu'à lui-même.
const expected = {
  fr: {
    title: 'Ali Smaani | Développeur Full-Stack',
    other: { name: 'English', path: '/en/express' },
    experiences: [
      { role: 'Ingénieur applicatif & gestion de données', period: 'janv. 2024 - juin 2026' },
      { role: 'Développeur Web', period: 'sept. 2020 - août 2023' },
    ],
    print: 'Imprimer',
    skip: 'Aller au contenu',
  },
  en: {
    title: 'Ali Smaani | Full-Stack Developer',
    other: { name: 'Français', path: '/fr/express' },
    experiences: [
      { role: 'Application & Data Management Engineer', period: 'Jan 2024 - Jun 2026' },
      { role: 'Web Developer', period: 'Sep 2020 - Aug 2023' },
    ],
    print: 'Print',
    skip: 'Skip to content',
  },
} satisfies Record<Locale, unknown>;

const DASHES = /[\u2013\u2014]/;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

for (const locale of locales) {
  const content = getContent(locale);
  const facts = expected[locale];
  const path = `/${locale}/express`;

  test.describe(`version express ${locale}`, () => {
    test('affiche le profil, le contact et toutes les sections', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page).toHaveTitle(facts.title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ali Smaani');

      const sections = content.sections;
      await expect(page.getByRole('heading', { level: 2 })).toHaveText([
        sections.contact,
        sections.summary,
        sections.experience,
        sections.projects,
        sections.skills,
        sections.education,
        sections.languages,
        sections.softSkills,
        sections.interests,
      ]);
      await expect(page.getByText(content.profile.summary)).toBeVisible();
    });

    test('voit le nom, le titre et le contact sans défiler', async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
      await expect(page.getByText(content.profile.headline, { exact: true })).toBeInViewport();
      const contact = page.getByRole('main').getByRole('list').first();
      await expect(contact.getByRole('link', { name: 'smanali.pro@gmail.com' })).toHaveAttribute(
        'href',
        'mailto:smanali.pro@gmail.com',
      );
      await expect(contact.getByRole('link', { name: 'linkedin.com/in/smaali' })).toHaveAttribute(
        'href',
        'https://www.linkedin.com/in/smaali',
      );
      await expect(contact.getByRole('link', { name: 'github.com/sma-ali' })).toHaveAttribute(
        'href',
        'https://github.com/sma-ali',
      );
      for (const link of await contact.getByRole('link').all()) {
        await expect(link).toBeInViewport();
      }
    });

    test('date chaque expérience, projet et formation', async ({ page }) => {
      await page.goto(path);
      for (const { role, period } of facts.experiences) {
        const entry = page.getByRole('listitem').filter({
          has: page.getByRole('heading', { level: 3, name: role, exact: true }),
        });
        await expect(entry.locator('time').first()).toBeVisible();
        await expect(entry.getByText(period, { exact: true })).toBeVisible();
      }
      await expect(page.locator('time[datetime="2024-01"]')).toHaveCount(1);
      await expect(page.locator('time[datetime="2023-08"]')).toHaveCount(1);

      for (const project of content.projects) {
        const entry = page.getByRole('listitem').filter({
          has: page.getByRole('heading', { level: 3, name: project.name, exact: true }),
        });
        await expect(entry.locator(`time[datetime="${project.year}"]`)).toHaveText(
          String(project.year),
        );
      }

      for (const item of content.education) {
        const entry = page.getByRole('listitem').filter({ hasText: item.title });
        await expect(entry.getByText(item.school, { exact: true })).toBeVisible();
        const years = item.from === item.to ? [item.from] : [item.from, item.to];
        await expect(entry.locator('time')).toHaveText(years.map(String));
      }
      // Le bac tient sur une seule année.
      const bac = page.getByRole('listitem').filter({ hasText: content.education.at(-1)!.title });
      await expect(bac.locator('time')).toHaveText(['2017']);
    });

    test('ne lie aucun dépôt privé et ne donne aucun téléphone', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('a[href*="Netherbrain"], a[href*="Homelab"]')).toHaveCount(0);
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/(?:\+33|\b0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/);
    });

    test("n'affiche aucun tiret cadratin ni demi-cadratin", async ({ page }) => {
      await page.goto(path);
      expect(await page.locator('body').innerText()).not.toMatch(DASHES);
      expect(await page.title()).not.toMatch(DASHES);
    });

    test('se charge sans erreur dans la console', async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: facts.print })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('bascule vers l’autre langue', async ({ page }) => {
      await page.goto(path);
      const link = page.getByRole('link', { name: facts.other.name });
      await expect(link).toHaveAttribute('hreflang', facts.other.path.slice(1, 3));
      await expect(link).toHaveAttribute('lang', facts.other.path.slice(1, 3));
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${facts.other.path}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', facts.other.path.slice(1, 3));
    });

    test('porte les données structurées', async ({ page }) => {
      await page.goto(path);
      const scripts = page.locator('script[type="application/ld+json"]');
      await expect(scripts).toHaveCount(1);
      const data = JSON.parse((await scripts.textContent()) ?? '');
      expect(data['@type']).toBe('ProfilePage');
      expect(data.inLanguage).toBe(locale);
      expect(data.mainEntity['@type']).toBe('Person');
      expect(data.mainEntity.name).toBe('Ali Smaani');
      expect(data.mainEntity.email).toBe('mailto:smanali.pro@gmail.com');
    });

    test('porte canonical, hreflang et Open Graph', async ({ page, request }) => {
      await page.goto(path);
      const head = page.locator('head');
      await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://alismaani.fr${path}`,
      );
      for (const [hreflang, href] of [
        ['fr', 'https://alismaani.fr/fr/express'],
        ['en', 'https://alismaani.fr/en/express'],
        ['x-default', 'https://alismaani.fr/fr/express'],
      ]) {
        await expect(head.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveAttribute(
          'href',
          href!,
        );
      }
      await expect(head.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        facts.title,
      );
      await expect(head.locator('meta[property="og:type"]')).toHaveAttribute('content', 'profile');
      await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );

      const image = await head.locator('meta[property="og:image"]').getAttribute('content');
      expect(image).toMatch(new RegExp(`^https://alismaani\\.fr${path}/opengraph-image`));
      const { pathname, search } = new URL(image!);
      const response = await request.get(pathname + search);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('image/png');
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`passe l'audit axe en thème ${colorScheme === 'light' ? 'clair' : 'sombre'}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path, { waitUntil: 'networkidle' });
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }

    test('ne défile jamais horizontalement à 360 px', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  });
}

test('le lien d’évitement mène au contenu', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.goto('/fr/express');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: expected.fr.skip });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le CV entier reste lisible', async ({ page }) => {
    const content = getContent('fr');
    await page.goto('/fr/express');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ali Smaani');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
    for (const experience of content.experiences) {
      await expect(page.getByRole('heading', { level: 3, name: experience.role })).toBeVisible();
    }
    for (const highlight of content.projects.flatMap((project) => project.highlights)) {
      await expect(page.getByText(highlight)).toBeVisible();
    }
    for (const interest of content.interests) {
      await expect(page.getByText(interest)).toBeVisible();
    }
    // Sans JavaScript, le bouton ne servirait à rien : il n'est pas affiché.
    await expect(page.getByRole('button', { name: expected.fr.print })).toHaveCount(0);
  });
});

test.describe('impression', () => {
  test('masque l’interface et tient sur deux pages A4', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'ordinateur', 'impression testée sur ordinateur');
    await page.goto('/fr/express', { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByRole('button', { name: expected.fr.print })).toBeHidden();
    await expect(page.getByRole('link', { name: 'English' })).toBeHidden();
    await expect(page.getByRole('link', { name: expected.fr.skip })).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('smanali.pro@gmail.com')).toBeVisible();

    // Noir sur blanc, même si le système est en thème sombre.
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    const colors = await page.evaluate(() => ({
      text: getComputedStyle(document.querySelector('h1')!).color,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    expect(colors).toEqual({ text: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)' });

    const pdf = await page.pdf({ format: 'A4' });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.length).toBeLessThanOrEqual(2);
  });
});

test('sitemap.xml et robots.txt répondent', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>https://alismaani.fr/fr/express</loc>');
  expect(xml).toContain('<loc>https://alismaani.fr/en/express</loc>');

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap: https://alismaani.fr/sitemap.xml');

  const icon = await request.get('/icon.svg');
  expect(icon.status()).toBe(200);
});
