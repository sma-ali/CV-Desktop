import { expect, test } from '@playwright/test';

// La route /api/contact par le fixture request, sans navigateur ni 3D. Le
// serveur de test tourne en CONTACT_DRY_RUN=1 (playwright.config.ts) : un
// envoi accepté n'envoie rien. Le 429 se vérifie en Vitest (la limite est
// relevée ici, toutes les requêtes venant de localhost).

const ROUTE = '/api/contact';

const valid = {
  name: 'Camille Martin',
  email: 'camille@exemple.fr',
  message: 'Bonjour, une question sur votre parcours.',
  locale: 'fr',
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'ordinateur', 'la route ne dépend pas de l’écran');
});

test('accepte un message valide en JSON', async ({ request, baseURL }) => {
  const response = await request.post(ROUTE, { data: valid, headers: { Origin: baseURL! } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  const headers = response.headers();
  expect(headers['cache-control']).toBe('no-store');
  expect(headers['access-control-allow-origin']).toBeUndefined();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
});

test('refuse les champs invalides avec un code par champ', async ({ request }) => {
  const response = await request.post(ROUTE, {
    data: { ...valid, email: 'camille', message: 'court' },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    ok: false,
    error: 'validation',
    fields: { email: 'invalid', message: 'too_short' },
  });
});

test('répond 405 aux autres méthodes, avec Allow', async ({ request }) => {
  for (const method of ['GET', 'PUT', 'DELETE'] as const) {
    const response = await request.fetch(ROUTE, { method });
    expect(response.status(), method).toBe(405);
    expect(response.headers()['allow']).toBe('POST');
  }
});

test('répond 415 à un autre type de contenu', async ({ request }) => {
  const response = await request.post(ROUTE, {
    data: 'bonjour',
    headers: { 'Content-Type': 'text/plain' },
  });
  expect(response.status()).toBe(415);
  expect(await response.json()).toEqual({ ok: false, error: 'unsupported' });
});

test('répond 403 à une origine étrangère, sans en-tête CORS', async ({ request }) => {
  const response = await request.post(ROUTE, {
    data: valid,
    headers: { Origin: 'https://exemple.invalid' },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ ok: false, error: 'origin' });
  expect(response.headers()['access-control-allow-origin']).toBeUndefined();
});

test('répond 413 à un corps trop gros', async ({ request }) => {
  const response = await request.post(ROUTE, {
    data: { ...valid, message: 'a'.repeat(20_000) },
  });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ ok: false, error: 'too_large' });
});

test('redirige un formulaire HTML (303) avec son état', async ({ request }) => {
  const response = await request.post(ROUTE, {
    form: { ...valid, locale: 'en', from: 'express', website: '' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()['location']).toBe('/en/express?contact=envoye#contact-envoye');

  const invalid = await request.post(ROUTE, {
    form: { ...valid, email: 'x', locale: 'fr', from: 'desk' },
    maxRedirects: 0,
  });
  expect(invalid.status()).toBe(303);
  expect(invalid.headers()['location']).toBe(
    '/fr?contact=erreur-validation#contact-erreur-validation',
  );
});

test('répond comme un succès quand le piège est rempli', async ({ request }) => {
  const response = await request.post(ROUTE, {
    data: { ...valid, website: 'https://spam.example' },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
