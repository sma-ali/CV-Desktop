import { expect, test, type Page } from '@playwright/test';

// Les parcours du visiteur sur le bureau assemblé (décor, objets et mise en
// scène ensemble) : clavier, gros plan sur l'écran, visite automatique,
// Rejouer, ambiance, langue et aller-retour avec la version express. Tout se
// lit sur l'état que le HUD expose (#hud[data-*]) : jamais d'attente fixe,
// SwiftShader est lent et sa cadence varie.

// Arrivée finie, horloge gelée, sans visite automatique : un état stable.
const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('au clavier', () => {
  test('une puce présente son objet, Échap le repose', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const chip = page.locator('a[data-step="dares"]');
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveAttribute('data-presented', 'postit');
    await expect(chip).toHaveAttribute('data-on', 'true');
    // La page n'a pas suivi le lien vers la version express.
    await expect(page).toHaveURL(/\/fr\?/);
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(chip).not.toHaveAttribute('data-on', 'true');
    // Le focus reste sur la puce : on peut enchaîner.
    await expect(chip).toBeFocused();
  });
});

test.describe('l’écran', () => {
  test('se regarde de près au clic, puis la caméra revient', async ({ page, isMobile }) => {
    test.skip(isMobile, 'au doigt, le haut de l’écran du téléphone est au HUD');
    const errors = collectErrors(page);
    await page.goto(SETTLED);
    await waitForScene(page);
    // Au repos, l'écran occupe le haut du centre de l'image.
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('pas de fenêtre');
    const point = { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.2) };
    const target = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? '',
      point,
    );
    expect(target).toBe('CANVAS');
    await page.mouse.click(point.x, point.y);
    await expect(hud(page)).toHaveAttribute('data-presented', 'monitor');
    // Le chip des projets 2026 s'allume avec l'écran.
    await expect(page.locator('a[data-step="projects"]')).toHaveAttribute('data-on', 'true');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    expect(errors).toEqual([]);
  });

  test('se regarde de près d’office avec ?prendre=monitor', async ({ page }) => {
    await page.goto('/fr?t=11000&fige&heure=14&prendre=monitor');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'monitor');
    // Un objet présenté d'office ne laisse jamais partir la visite.
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });
});

test.describe('la visite automatique', () => {
  test('s’arrête à une touche du clavier et repose son objet', async ({ page }) => {
    await page.goto('/fr?t=12000&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 30_000 });
    await expect(hud(page)).toHaveAttribute('data-presented', 'book', { timeout: 30_000 });
    await page.keyboard.press('a');
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });
});

test.describe('Rejouer', () => {
  test('repose l’objet présenté et rejoue toute l’arrivée', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.locator('a[data-step="contact"]').click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(hud(page)).not.toHaveAttribute('data-phase', 'settled');
    // Rejouer dégèle l'horloge : l'arrivée va jusqu'au bout.
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 45_000 });
    await expect(tag(page, 'card')).toHaveAttribute('data-shown', 'true');
  });

  test('garde l’ambiance choisie', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.getByRole('button', { name: 'Nuit' }).click();
    await expect(hud(page)).toHaveAttribute('data-mood', 'night');
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).not.toHaveAttribute('data-phase', 'settled');
    await expect(hud(page)).toHaveAttribute('data-mood', 'night');
    // Le bas de page revient à la fin de l'arrivée, avec la nuit choisie.
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Nuit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('la langue et la version express', () => {
  test('le bureau passe en anglais, scène comprise', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/fr?auto=0&heure=14');
    await waitForScene(page);
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await waitForScene(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // Les étiquettes de la scène arrivent en anglais à la fin de l'arrivée.
    await expect(tag(page, 'chest')).toHaveAttribute('data-shown', 'true', { timeout: 45_000 });
    await expect(tag(page, 'chest')).toHaveText(/Side projects\s*Sealed/);
    expect(errors).toEqual([]);
  });

  test('l’aller-retour avec la version express relance la scène', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/fr?auto=0&heure=14');
    await waitForScene(page);
    await page.getByRole('link', { name: 'Version express' }).click();
    await expect(page).toHaveURL(/\/fr\/express$/);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('link', { name: 'Revenir au bureau' }).click();
    await expect(page).toHaveURL(/\/fr$/);
    await waitForScene(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
