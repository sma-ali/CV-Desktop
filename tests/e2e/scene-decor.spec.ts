import { expect, test, type Page } from '@playwright/test';

// Le décor du bureau : ses petites animations suivent l'horloge de la scène.
// ?fige les gèle toutes (deux images identiques) ; sans ?fige, il vit (la
// vapeur monte, les feuilles bougent, les LED respirent).

const SETTLED = '/fr?t=11000&auto=0&heure=14&nopost';

async function waitForScene(page: Page) {
  await expect(page.locator('#hud')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** Deux captures du canvas, à intervalle donné. */
async function twoShots(page: Page, gapMs: number): Promise<[Buffer, Buffer]> {
  const canvas = page.locator('canvas');
  const first = await canvas.screenshot({ animations: 'allow' });
  await page.waitForTimeout(gapMs);
  const second = await canvas.screenshot({ animations: 'allow' });
  return [first, second];
}

test.describe('le décor', () => {
  test('ne bouge plus quand l’horloge est gelée', async ({ page }) => {
    await page.goto(`${SETTLED}&fige`);
    await waitForScene(page);
    // Le temps que les textures peintes et les polices soient en place.
    await page.waitForTimeout(1500);
    const [first, second] = await twoShots(page, 1200);
    expect(first.equals(second)).toBe(true);
  });

  test('vit quand l’horloge tourne', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.waitForTimeout(1500);
    const [first, second] = await twoShots(page, 1200);
    expect(first.equals(second)).toBe(false);
  });

  test('se dessine sans erreur dans la console', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/fr?t=11000&fige&auto=0&heure=23&nopost');
    await waitForScene(page);
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });
});
