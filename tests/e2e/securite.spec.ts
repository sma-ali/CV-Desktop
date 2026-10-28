import { expect, test } from '@playwright/test';

// Une page et la page 404. La redirection de la racine n'a pas de contenu à
// protéger : Next.js n'y ajoute pas ces en-têtes.
const responses = [
  { path: '/fr', status: 200 },
  { path: '/de', status: 404 },
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

test('la racine redirige vers /fr sans dire sur quoi tourne le serveur', async ({ request }) => {
  const response = await request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()['location']).toBe('/fr');
  expect(response.headers()['x-powered-by']).toBeUndefined();
});

test("aucune origine étrangère n'est autorisée (pas de CORS ouvert)", async ({ request }) => {
  const response = await request.get('/fr', { headers: { Origin: 'https://exemple.invalid' } });
  expect(response.headers()['access-control-allow-origin']).toBeUndefined();
});
