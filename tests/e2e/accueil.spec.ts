import { expect, test } from '@playwright/test';
import { getContent, locales } from '../../src/content';

test('la racine envoie vers la version française', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  // Valeur écrite en dur : ce test ne compare pas le contenu à lui-même.
  await expect(page).toHaveTitle('Ali Smaani | Développeur Full-Stack');
});

for (const locale of locales) {
  const { profile } = getContent(locale);

  test(`la page ${locale} affiche le profil du CV`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page).toHaveTitle(`${profile.name} | ${profile.headline}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.name);
    await expect(page.getByText(profile.headline, { exact: true })).toBeVisible();
  });
}

test('le lien de langue bascule entre FR et EN', async ({ page }) => {
  await page.goto('/fr');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('link', { name: 'Français' }).click();
  await expect(page).toHaveURL(/\/fr$/);
});

test('une langue inconnue répond 404', async ({ page }) => {
  const response = await page.goto('/de');
  expect(response?.status()).toBe(404);
});

test('la page se charge sans erreur dans la console', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/fr', { waitUntil: 'networkidle' });
  expect(errors).toEqual([]);
});
