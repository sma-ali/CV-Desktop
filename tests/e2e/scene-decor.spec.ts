import { expect, test, type Page } from '@playwright/test';

// Le décor du bureau : ses petites animations suivent l'horloge de la scène.
// ?fige les gèle toutes (deux images identiques) ; sans ?fige, il vit (la
// vapeur monte, les feuilles bougent, les LED respirent). Étape 6 : le
// kimono plié, à la place du matériel de stream, est un corps du bureau
// comme les autres.

const SETTLED = '/fr?t=11000&auto=0&heure=14&nopost';

// Le HUD passe au-dessus du canvas : on le cache pendant les captures, pour
// ne comparer que la scène.
const HIDE_HUD = '#hud { visibility: hidden !important; }';

async function waitForScene(page: Page) {
  await expect(page.locator('#hud')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/**
 * Nombre de pixels qui changent nettement (plus de 6 niveaux en tout) entre
 * deux captures du canvas prises à gapMs d'intervalle.
 */
async function changedPixels(page: Page, gapMs: number): Promise<number> {
  const canvas = page.locator('canvas');
  const shot = async () =>
    (await canvas.screenshot({ animations: 'allow', style: HIDE_HUD })).toString('base64');
  const first = await shot();
  await page.waitForTimeout(gapMs);
  const second = await shot();
  return page.evaluate(
    async ([a, b]) => {
      const pixels = async (src: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${src}`;
        await image.decode();
        const scratch = document.createElement('canvas');
        scratch.width = image.width;
        scratch.height = image.height;
        const ctx = scratch.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height).data;
      };
      const [pa, pb] = await Promise.all([pixels(a!), pixels(b!)]);
      let changed = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d =
          Math.abs(pa[i]! - pb[i]!) +
          Math.abs(pa[i + 1]! - pb[i + 1]!) +
          Math.abs(pa[i + 2]! - pb[i + 2]!);
        if (d > 6) changed++;
      }
      return changed;
    },
    [first, second],
  );
}

test.describe('le décor', () => {
  // Deux captures du canvas en 3D logicielle, et leur comparaison : lent quand
  // les autres tests tournent en parallèle.
  test.slow();

  test('ne bouge plus quand l’horloge est gelée', async ({ page }) => {
    await page.goto(`${SETTLED}&fige`);
    await waitForScene(page);
    // Le temps que les textures peintes et les polices soient en place.
    await page.waitForTimeout(1500);
    expect(await changedPixels(page, 1200)).toBe(0);
  });

  test('vit quand l’horloge tourne', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.waitForTimeout(1500);
    expect(await changedPixels(page, 1200)).toBeGreaterThan(20);
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

test.describe('le kimono plié', () => {
  test.slow();

  test('se glisse comme le reste du décor, sans rien chevaucher', async ({ page, isMobile }) => {
    // Comme les ?glisse= de scene-gestes : le même moteur sur les deux profils,
    // et sa place en portrait est vérifiée par kimono.test.ts.
    test.skip(isMobile, 'le même moteur sur les deux profils');
    await page.goto(`${SETTLED}&fige&glisse=kimono:-2.6,-1.5`);
    await waitForScene(page);
    await expect(page.locator('#hud')).toHaveAttribute('data-physics', 'ready', {
      timeout: 30_000,
    });
    await expect(page.locator('#hud')).toHaveAttribute('data-places', /kimono:/);
    const fallen = (await page.locator('#hud').getAttribute('data-fallen')) ?? '';
    expect(fallen.split(' ')).not.toContain('kimono');
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-penetration', /^\d/, { timeout: 30_000 });
    expect(Number(await canvas.getAttribute('data-penetration'))).toBeLessThan(0.05);
  });
});
