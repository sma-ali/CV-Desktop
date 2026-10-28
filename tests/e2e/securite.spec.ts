import { expect, test } from '@playwright/test';

// La version express et la page 404.
const responses = [
  { path: '/fr/express', status: 200 },
  { path: '/en/express', status: 200 },
  { path: '/de', status: 404 },
  { path: '/de/express', status: 404 },
];

for (const { path, status } of responses) {
  test(`${path} porte les en-têtes de sécurité`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(status);

    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['strict-transport-security']).toBeDefined();
    expect(headers['x-powered-by']).toBeUndefined();
  });
}

test('la racine choisit la langue sans dire sur quoi tourne le serveur', async ({ request }) => {
  const english = await request.get('/', {
    headers: { 'Accept-Language': 'en-GB,en;q=0.9' },
    maxRedirects: 0,
  });
  expect(english.status()).toBe(307);
  expect(english.headers()['location']).toBe('/en');
  expect(english.headers()['vary']).toContain('Accept-Language');
  expect(english.headers()['x-powered-by']).toBeUndefined();

  const french = await request.get('/', {
    headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    maxRedirects: 0,
  });
  expect(french.headers()['location']).toBe('/fr');
});

test("aucune origine étrangère n'est autorisée (pas de CORS ouvert)", async ({ request }) => {
  const response = await request.get('/fr/express', {
    headers: { Origin: 'https://exemple.invalid' },
  });
  expect(response.headers()['access-control-allow-origin']).toBeUndefined();
});
