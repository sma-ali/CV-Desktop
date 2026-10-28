import { expect, test } from '@playwright/test';

// La racine choisit la langue du navigateur et mène à la version express en un
// seul saut, comme /fr et /en, jusqu'à l'arrivée du bureau en 3D.
test.describe('la racine', () => {
  test('envoie un navigateur anglais vers la version anglaise', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-GB' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/express$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Ali Smaani | Full-Stack Developer');
    await context.close();
  });

  test('envoie un navigateur français vers la version française', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr\/express$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page).toHaveTitle('Ali Smaani | Développeur Full-Stack');
    await context.close();
  });

  for (const [header, location] of [
    ['en-US,en;q=0.9', '/en/express'],
    ['de-DE,de;q=0.9,en;q=0.8', '/en/express'],
    ['fr-FR,fr;q=0.9,en;q=0.8', '/fr/express'],
    ['de', '/fr/express'],
    ['', '/fr/express'],
  ] as const) {
    test(`répond 307 vers ${location} pour « ${header} »`, async ({ request }) => {
      const response = await request.get('/', {
        headers: { 'Accept-Language': header },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers()['location']).toBe(location);
      expect(response.headers()['vary']).toContain('Accept-Language');
      expect(response.headers()['cache-control']).toBe('private, no-store');
    });
  }

  test('envoie vers le français sans en-tête Accept-Language', async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({ baseURL });
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toBe('/fr/express');
    await request.dispose();
  });

  test('garde la chaîne de requête', async ({ request }) => {
    const response = await request.get('/?source=cv', {
      headers: { 'Accept-Language': 'en' },
      maxRedirects: 0,
    });
    expect(response.headers()['location']).toBe('/en/express?source=cv');
  });
});

for (const locale of ['fr', 'en']) {
  test(`/${locale} mène à la version express (307)`, async ({ request }) => {
    const response = await request.get(`/${locale}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toBe(`/${locale}/express`);
  });
}

for (const path of ['/de', '/de/express']) {
  test(`${path} répond 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}
