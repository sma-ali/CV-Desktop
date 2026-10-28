import { expect, test, type Page } from '@playwright/test';

// Les objets du CV sur le bureau (partie « objets ») : étiquettes, survol,
// présentation par une puce, une étiquette ou un clic, et retour sur le
// bureau. L'état se lit sur #hud (data-presented) et sur les étiquettes
// (data-shown), la 3D elle-même par SwiftShader.

// Arrivée finie, horloge gelée, sans visite automatique : un état stable.
const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** Un point sous l'étiquette d'un objet : l'objet lui-même, dans le canvas. */
async function pointOnItem(page: Page, item: string) {
  const box = await tag(page, item).boundingBox();
  if (!box) throw new Error(`étiquette invisible : ${item}`);
  return { x: box.x + box.width / 2, y: box.y + box.height + 28 };
}

test.describe('les objets du CV', () => {
  test('portent leurs étiquettes, dans la langue de la page, cachées aux lecteurs d’écran', async ({
    page,
  }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    for (const item of ['book', 'postit', 'laptop', 'card', 'chest']) {
      await expect(tag(page, item)).toHaveAttribute('data-shown', 'true');
    }
    await expect(tag(page, 'book')).toHaveText(/2020\s*DEFI-METIERS/);
    await expect(tag(page, 'chest')).toHaveText(/Projets perso\s*Scellé/);
    await expect(tag(page, 'book').locator('..')).toHaveAttribute('aria-hidden', 'true');

    await page.goto('/en?t=11000&fige&auto=0&heure=14');
    await waitForScene(page);
    await expect(tag(page, 'chest')).toHaveText(/Side projects\s*Sealed/);
  });

  test('cachent les étiquettes pendant l’arrivée', async ({ page }) => {
    await page.goto('/fr?t=4000&fige&auto=0&heure=14');
    await waitForScene(page);
    await expect(tag(page, 'book')).toHaveAttribute('data-shown', 'false');
  });

  test('présentent l’objet d’une puce, puis le reposent', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.getByRole('link', { name: /2026/ }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'laptop');
    // Pendant la présentation, les étiquettes s'effacent.
    await expect(tag(page, 'laptop')).toHaveAttribute('data-shown', 'false');
    await expect(tag(page, 'card')).toHaveAttribute('data-shown', 'false');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    // Une fois l'objet reposé, son étiquette revient.
    await expect(tag(page, 'laptop')).toHaveAttribute('data-shown', 'true');
  });

  test('présentent l’objet de son étiquette', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await tag(page, 'card').click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
  });

  test('se survolent à la souris et se présentent au clic', async ({ page, isMobile }) => {
    test.skip(isMobile, 'pas de survol au doigt');
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(tag(page, 'book')).toHaveAttribute('data-shown', 'true');
    const point = await pointOnItem(page, 'book');
    const canvas = page.locator('canvas');
    await page.mouse.move(point.x, point.y);
    await expect(canvas).toHaveCSS('cursor', 'pointer');
    await page.mouse.click(point.x, point.y);
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    // Un clic sur l'objet tenu le repose.
    await page.mouse.click(point.x, point.y + 1);
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });

  test('se reposent d’un clic hors des objets', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le bas de l’écran du téléphone est au HUD');
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.getByRole('link', { name: /2024/ }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'postit');
    // Le sol sous le bureau, hors du HUD : seul le canvas y est.
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('pas de fenêtre');
    const point = { x: Math.round(viewport.width * 0.66), y: viewport.height - 20 };
    const target = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? '',
      point,
    );
    expect(target).toBe('CANVAS');
    await page.mouse.click(point.x, point.y);
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });

  test('présentent sans animation en mouvement réduit', async ({ page }) => {
    await page.goto('/fr?reduit&prendre=chest&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    await expect(hud(page)).toHaveAttribute('data-presented', 'chest');
    await expect(tag(page, 'chest')).toHaveAttribute('data-shown', 'false');
    await expect(tag(page, 'chest').locator('..')).toHaveAttribute('data-still', '');
  });
});
