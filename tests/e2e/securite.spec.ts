import { expect, test } from '@playwright/test';

// Toutes les sortes de réponses du site : le bureau, la version express, les
// fichiers générés, l'image de partage, la redirection du proxy et la page 404.
const responses = [
  { path: '/fr', status: 200 },
  { path: '/en', status: 200 },
  { path: '/fr/express', status: 200 },
  { path: '/en/express', status: 200 },
  { path: '/sitemap.xml', status: 200 },
  { path: '/robots.txt', status: 200 },
  { path: '/icon.svg', status: 200 },
  { path: '/fr/express/opengraph-image', status: 200 },
  { path: '/', status: 307 },
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
  for (const path of ['/fr', '/fr/express']) {
    const response = await request.get(path, { headers: { Origin: 'https://exemple.invalid' } });
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
  }
});

test('la CSP du bureau ne permet ni eval ni workers étrangers', async ({ request }) => {
  const csp = (await request.get('/fr')).headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).not.toMatch(/worker-src[^;]*blob:/);
  expect(csp).not.toMatch(/script-src[^;]*blob:/);
});
