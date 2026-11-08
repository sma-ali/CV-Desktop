import { expect, test } from '@playwright/test';

// La racine choisit la langue du navigateur et mène au bureau en un seul saut.
test.describe('la racine', () => {
  test('envoie un navigateur anglais vers le bureau anglais', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-GB' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Ali Smaani | Dev FullStack | AI Engineer');
    await context.close();
  });

  test('envoie un navigateur français vers le bureau français', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page).toHaveTitle('Ali Smaani | Dev FullStack | AI Engineer');
    await context.close();
  });

  for (const [header, location] of [
    ['en-US,en;q=0.9', '/en'],
    ['de-DE,de;q=0.9,en;q=0.8', '/en'],
    ['fr-FR,fr;q=0.9,en;q=0.8', '/fr'],
    ['de', '/fr'],
    ['', '/fr'],
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
    expect(response.headers()['location']).toBe('/fr');
    await request.dispose();
  });

  test('garde la chaîne de requête', async ({ request }) => {
    const response = await request.get('/?source=cv', {
      headers: { 'Accept-Language': 'en' },
      maxRedirects: 0,
    });
    expect(response.headers()['location']).toBe('/en?source=cv');
  });
});

for (const locale of ['fr', 'en']) {
  test(`/${locale} sert le bureau sans redirection`, async ({ request }) => {
    const response = await request.get(`/${locale}`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });
}

for (const path of ['/de', '/de/express']) {
  test(`${path} répond 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}
