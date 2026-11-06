import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Valeurs écrites en dur : la page ne se compare pas qu'à elle-même.
const expected = {
  fr: { link: 'Mentions légales', heading: 'Mentions légales', other: '/en/legal' },
  en: { link: 'Legal notice', heading: 'Legal notice', other: '/fr/legal' },
} as const;

for (const locale of ['fr', 'en'] as const) {
  const { link, heading, other } = expected[locale];

  test(`mentions légales (${locale}) : liées depuis la version express, accessibles`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/express`);
    await page.getByRole('contentinfo').getByRole('link', { name: link }).click();
    await expect(page).toHaveURL(`/${locale}/legal`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByText('Vercel Inc.')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://alismaani.fr/${locale}/legal`,
    );
    await expect(
      page.getByRole('link', { name: locale === 'fr' ? 'English' : 'Français' }),
    ).toHaveAttribute('href', other);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
