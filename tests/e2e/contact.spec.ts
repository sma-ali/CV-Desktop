import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { getContent, type Locale } from '../../src/content';

// Le formulaire de contact : dans la version express (replié sous « Écrire
// un message ») et dans la fiche de la carte de visite du bureau. Le serveur
// de test tourne en CONTACT_DRY_RUN=1 : rien n'est envoyé. Les erreurs du
// serveur sont simulées par page.route.

const SETTLED = 't=11000&fige&auto=0&heure=14';

const texts = (locale: Locale) => getContent(locale).contactForm;

function form(scope: Page | Locator): Locator {
  return scope.locator('form[data-contact-form]');
}

async function openExpress(page: Page, locale: Locale = 'fr') {
  await page.goto(`/${locale}/express`);
  await page.getByText(texts(locale).open, { exact: true }).click();
  await expect(page.getByLabel(texts(locale).name.label)).toBeVisible();
}

async function fillValid(scope: Page | Locator, locale: Locale = 'fr') {
  const t = texts(locale);
  await scope.getByLabel(t.name.label).fill('Camille Martin');
  await scope.getByLabel(t.email.label).fill('camille@exemple.fr');
  await scope.getByLabel(t.message.label).fill('Bonjour, une question sur votre parcours.');
}

const status = (scope: Page | Locator) => form(scope).locator('[role="status"]');

test.describe('formulaire de la version express', () => {
  for (const locale of ['fr', 'en'] as const) {
    test(`envoie un message et le dit (${locale})`, async ({ page }) => {
      const t = texts(locale);
      await openExpress(page, locale);
      await fillValid(page, locale);
      const counter = form(page).locator('[data-contact-counter]');
      await expect(counter).toHaveText(locale === 'fr' ? '41 sur 5000' : '41 of 5000');

      const sent = page.waitForResponse('**/api/contact');
      await form(page).getByRole('button', { name: t.submit }).click();
      expect((await sent).status()).toBe(200);
      await expect(status(page)).toHaveText(t.status.sent);
      await expect(page.getByLabel(t.name.label)).toHaveValue('');
      await expect(page.getByLabel(t.message.label)).toHaveValue('');
    });
  }

  test('s’ouvre seul quand on arrive par le lien du contact', async ({ page }) => {
    await page.goto('/fr/express#contact');
    await expect(page.getByLabel(texts('fr').name.label)).toBeVisible();
  });

  test('signale les champs fautifs sans rien envoyer', async ({ page }) => {
    const t = texts('fr');
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/contact')) requests.push(request.url());
    });
    await openExpress(page);
    await page.getByLabel(t.email.label).fill('camille@');
    await page.getByLabel(t.message.label).fill('Court');
    await form(page).getByRole('button', { name: t.submit }).click();

    const name = page.getByLabel(t.name.label);
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(t.name.errors.required);
    await expect(page.getByLabel(t.email.label)).toHaveAccessibleDescription(
      new RegExp(t.email.errors.invalid.replace(/[.?*+^$()|[\]\\]/g, '\\$&')),
    );
    await expect(form(page)).toContainText(
      'Votre message est un peu court : 10 caractères au moins.',
    );
    await expect(status(page)).toHaveText(t.status.validation);
    expect(requests).toEqual([]);

    // Corrigé, le champ perd son erreur.
    await name.fill('Camille');
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('montre les erreurs de champ rendues par le serveur', async ({ page }) => {
    const t = texts('fr');
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'validation', fields: { email: 'invalid' } }),
      }),
    );
    await openExpress(page);
    await fillValid(page);
    await form(page).getByRole('button', { name: t.submit }).click();
    await expect(status(page)).toHaveText(t.status.validation);
    const email = page.getByLabel(t.email.label);
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toBeFocused();
  });

  test('dit d’attendre après trop d’envois (429)', async ({ page }) => {
    const t = texts('fr');
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '600' },
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'rate_limited' }),
      }),
    );
    await openExpress(page);
    await fillValid(page);
    await form(page).getByRole('button', { name: t.submit }).click();
    await expect(status(page)).toHaveText(t.status.rate_limited);
    // La saisie reste là, pour réessayer plus tard.
    await expect(page.getByLabel(t.name.label)).toHaveValue('Camille Martin');
  });

  test('propose l’e-mail quand le formulaire est indisponible (503)', async ({ page }) => {
    const t = texts('fr');
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'unavailable' }),
      }),
    );
    await openExpress(page);
    await fillValid(page);
    await form(page).getByRole('button', { name: t.submit }).click();
    await expect(status(page)).toContainText(t.status.unavailable);
    await expect(status(page).getByRole('link', { name: t.emailInstead })).toHaveAttribute(
      'href',
      'mailto:smanali.pro@gmail.com',
    );
  });

  test('désactive le bouton pendant l’envoi', async ({ page }) => {
    const t = texts('fr');
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/contact', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await openExpress(page);
    await fillValid(page);
    await form(page).getByRole('button', { name: t.submit }).click();
    const button = form(page).getByRole('button', { name: t.sending });
    await expect(button).toBeDisabled();
    await expect(form(page)).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(status(page)).toHaveText(t.status.sent);
    await expect(form(page).getByRole('button', { name: t.submit })).toBeEnabled();
  });

  test('garde le piège hors de vue et hors du clavier', async ({ page }) => {
    await openExpress(page);
    const trap = form(page).locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(trap).toHaveAttribute('autocomplete', 'off');
    await expect(trap).not.toBeInViewport();
    // Caché aux lecteurs d'écran : absent de l'arbre d'accessibilité.
    await expect(page.getByRole('textbox', { name: texts('fr').honeypot })).toHaveCount(0);
    await expect(form(page)).toContainText(texts('fr').privacy);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passe l’audit axe, erreurs affichées (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openExpress(page);
      await form(page)
        .getByRole('button', { name: texts('fr').submit })
        .click();
      await expect(status(page)).toHaveText(texts('fr').status.validation);
      const results = await new AxeBuilder({ page })
        .include('#contact')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe('formulaire sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('envoie le message et revient à la version express', async ({ page }) => {
    const t = texts('fr');
    await openExpress(page);
    await expect(page.locator('#contact-envoye')).toBeHidden();
    await fillValid(page);
    await form(page).getByRole('button', { name: t.submit }).click();
    await expect(page).toHaveURL(/\/fr\/express\?contact=envoye#contact-envoye$/);
    await expect(page.locator('#contact-envoye')).toBeVisible();
    await expect(page.locator('#contact-envoye')).toHaveText(t.status.sent);
    await expect(page.locator('#contact-erreur-validation')).toBeHidden();
  });

  test('affiche l’erreur que la route renvoie', async ({ page }) => {
    await page.goto('/en/express?contact=erreur-rate_limited#contact-erreur-rate_limited');
    await expect(page.locator('#contact-erreur-rate_limited')).toHaveText(
      texts('en').status.rate_limited,
    );
    await expect(page.locator('#contact-envoye')).toBeHidden();
  });
});

test.describe('formulaire de la carte de visite', () => {
  const sheet = (page: Page) => page.locator('#sheet');

  async function openCard(page: Page, locale: Locale) {
    await page.goto(`/${locale}?${SETTLED}&prendre=card&recto`);
    await expect(page.locator('#hud')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'card');
  }

  for (const locale of ['fr', 'en'] as const) {
    test(`envoie un message depuis la fiche (${locale})`, async ({ page }) => {
      const t = texts(locale);
      await openCard(page, locale);
      await fillValid(sheet(page), locale);
      // Échap dans un champ rempli ne repose pas la carte.
      await sheet(page).getByLabel(t.name.label).press('Escape');
      await expect(sheet(page)).toHaveAttribute('data-sheet', 'card');
      // R dans un champ s'écrit, il ne retourne pas la carte.
      await expect(page.locator('#hud')).toHaveAttribute('data-flipped', 'false');

      const sent = page.waitForResponse('**/api/contact');
      await sheet(page).getByRole('button', { name: t.submit }).click();
      const response = await sent;
      expect(response.status()).toBe(200);
      expect(JSON.parse(response.request().postData() ?? '{}')).toMatchObject({
        locale,
        from: 'desk',
        website: '',
      });
      await expect(status(sheet(page))).toHaveText(t.status.sent);
    });
  }

  test('montre une erreur du serveur dans la fiche', async ({ page }) => {
    const t = texts('fr');
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'unavailable' }),
      }),
    );
    await openCard(page, 'fr');
    await fillValid(sheet(page));
    await sheet(page).getByRole('button', { name: t.submit }).click();
    await expect(status(sheet(page))).toContainText(t.status.unavailable);
  });
});
