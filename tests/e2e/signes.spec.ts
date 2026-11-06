import { expect, test, type Page } from '@playwright/test';
import { getContent } from '../../src/content';

// Les signes de vie du coffret (étape 5) : la route /api/signes-de-vie et
// le rafraîchissement à l'ouverture de la fiche. Le serveur de test n'a pas
// de LIFE_SIGNS_URL : la route sert les données d'exemple. Les cas où la
// source répond (succès, liste blanche, chaque cause de repli, cache) sont
// testés en Vitest, fetch simulé.

const ENDPOINT = '/api/signes-de-vie';
const MINUTE = 60_000;

test.describe('la route des signes de vie', () => {
  // Les réponses ne dépendent pas de l'écran : un seul projet suffit.
  test.skip(({ isMobile }) => isMobile, 'route seulement');

  test('sert les données d’exemple, en cache public court, sans CORS', async ({ request }) => {
    const response = await request.get(ENDPOINT, { headers: { Origin: 'https://ailleurs.test' } });
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-type']).toContain('application/json');
    // Les données d'exemple ne restent que 30 s au CDN (repli sur une panne).
    expect(headers['cache-control']).toBe('public, max-age=0, s-maxage=30');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');

    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['activity', 'factory', 'lastActivityAt', 'measuredAt', 'sample', 'since'].sort(),
    );
    expect(body.sample).toBe(true);
    expect(body.activity).toHaveLength(14);
    // Des chiffres globaux seulement, et une mesure à l'heure pleine.
    expect(Object.keys(body.factory as object).sort()).toEqual(
      ['channels', 'likes', 'perDay', 'videos', 'views'].sort(),
    );
    const measured = Date.parse(String(body.measuredAt));
    expect(measured % (60 * MINUTE)).toBe(0);
    expect(Math.abs(Date.now() - measured)).toBeLessThan(65 * MINUTE);
  });

  test('répond à HEAD sans corps', async ({ request }) => {
    const response = await request.head(ENDPOINT);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('s-maxage=30');
    expect(await response.body()).toHaveLength(0);
  });

  test('refuse les autres méthodes', async ({ request }) => {
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const response = await request.fetch(ENDPOINT, { method, data: {} });
      expect(response.status(), method).toBe(405);
      expect(response.headers()['access-control-allow-origin']).toBeUndefined();
    }
  });
});

test.describe('le rafraîchissement à l’ouverture du coffret', () => {
  const SETTLED = 't=11000&fige&auto=0&heure=14&prendre=chest';
  const hud = (page: Page) => page.locator('#hud');
  const factory = (page: Page) => page.locator('#sheet [data-factory]');

  /**
   * L'horloge du navigateur avance de deux heures : la mesure de la page
   * (faite au build, à l'heure pleine) a donc plus de 70 minutes, et
   * l'ouverture de l'usine la redemande. Les minuteries tournent normalement.
   */
  async function openChestLater(page: Page): Promise<number> {
    const later = Date.now() + 120 * MINUTE;
    await page.clock.setFixedTime(later);
    return later;
  }

  test('montre la nouvelle mesure quand la route répond', async ({ page }) => {
    const { factory: texts } = getContent('fr').sheets.ui;
    const later = await openChestLater(page);
    const fresh = {
      lastActivityAt: new Date(later - 24 * 60 * MINUTE).toISOString(),
      since: new Date(later - 10 * 24 * 60 * MINUTE).toISOString(),
      activity: [1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4],
      measuredAt: new Date(later - MINUTE).toISOString(),
      sample: false,
      factory: { channels: 7, videos: 90, perDay: 3, views: 41_000, likes: 1200 },
    };
    let calls = 0;
    await page.route(`**${ENDPOINT}`, async (route) => {
      calls += 1;
      await route.fulfill({ json: fresh });
    });
    await page.goto(`/fr?${SETTLED}`);
    await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
    await expect(factory(page).locator('[data-factory-status]')).toHaveText(
      'En marche | dernière vidéo hier',
    );
    await expect(factory(page)).not.toContainText(texts.sample);
    await expect(factory(page).locator('dd').first()).toHaveText('7');
    await expect(factory(page).getByRole('img')).toHaveAttribute(
      'aria-label',
      /1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4/,
    );
    expect(calls).toBe(1);
  });

  test('garde ce qu’elle a quand la route échoue', async ({ page }) => {
    const { factory: texts } = getContent('fr').sheets.ui;
    await openChestLater(page);
    const requested = page.waitForRequest(`**${ENDPOINT}`);
    await page.route(`**${ENDPOINT}`, (route) => route.fulfill({ status: 503, body: '' }));
    await page.goto(`/fr?${SETTLED}`);
    await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
    await requested;
    // Elle garde l'exemple : la fiche de l'usine et sa mention.
    await expect(factory(page)).toBeVisible();
    await expect(factory(page)).toContainText(texts.sample);
  });
});
