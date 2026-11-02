import { expect, test, type Page } from '@playwright/test';

// La mise en scène du bureau : l'arrivée qui se pose, la visite
// automatique (ordre des objets, arrêt sur une action, reprise), Rejouer et
// le mouvement réduit. L'horloge de la scène suit le temps réel : les tests
// sautent dans l'arrivée avec ?t= pour rester courts.

const hud = (page: Page) => page.locator('#hud');

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

/** Les étapes de l'arrivée, dans l'ordre. */
const PHASES = ['dark', 'lamp', 'screen', 'window', 'settled'];

interface GlCounts {
  textures: number;
  buffers: number;
  framebuffers: number;
}

/**
 * Compte les textures, tampons et framebuffers WebGL vivants (créés moins
 * supprimés), côté test seulement : la page n'expose rien.
 */
async function countGlObjects(page: Page) {
  await page.addInitScript(() => {
    const counts = { textures: 0, buffers: 0, framebuffers: 0 };
    Object.assign(window, { __glCounts: counts });
    const pairs = [
      ['createTexture', 'deleteTexture', 'textures'],
      ['createBuffer', 'deleteBuffer', 'buffers'],
      ['createFramebuffer', 'deleteFramebuffer', 'framebuffers'],
    ] as const;
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const methods = proto as unknown as Record<string, (...args: unknown[]) => unknown>;
      for (const [create, remove, key] of pairs) {
        const originalCreate = methods[create]!;
        const originalRemove = methods[remove]!;
        methods[create] = function (this: unknown, ...args: unknown[]) {
          counts[key] += 1;
          return originalCreate.apply(this, args);
        };
        methods[remove] = function (this: unknown, ...args: unknown[]) {
          if (args[0]) counts[key] -= 1;
          return originalRemove.apply(this, args);
        };
      }
    }
  });
  return () =>
    page.evaluate(() => ({ ...(window as unknown as { __glCounts: GlCounts }).__glCounts }));
}

test.describe('l’arrivée', () => {
  test('part du noir et se pose après SETTLE', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/fr?heure=14&auto=0');
    await waitForScene(page);
    const first = await hud(page).getAttribute('data-phase');
    expect(PHASES.indexOf(first ?? '')).toBeLessThan(PHASES.indexOf('window'));
    await expect(hud(page)).toHaveAttribute('data-phase', 'window', { timeout: 20_000 });
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('Rejouer relance l’arrivée autant de fois qu’on veut', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    const glObjects = await countGlObjects(page);
    await page.goto('/fr?t=9000&heure=19&auto=0');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 15_000 });
    await page.waitForTimeout(1_000);
    const before = await glObjects();
    const replay = page.getByRole('button', { name: 'Rejouer' });
    for (let i = 0; i < 3; i++) {
      await replay.click();
      await expect(hud(page)).not.toHaveAttribute('data-phase', 'settled');
      await expect(hud(page)).toHaveAttribute('data-auto', 'false');
      await page.waitForTimeout(400);
    }
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 25_000 });
    await page.waitForTimeout(1_000);
    // Rejouer ne recrée rien : pas une texture ni un tampon de plus.
    const after = await glObjects();
    expect(after.textures).toBeLessThanOrEqual(before.textures);
    expect(after.buffers).toBeLessThanOrEqual(before.buffers);
    expect(after.framebuffers).toBeLessThanOrEqual(before.framebuffers);
    expect(errors).toEqual([]);
  });
});

test.describe('la visite automatique', () => {
  test('présente les objets dans l’ordre', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/fr?t=12000&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 15_000 });
    // AUTO_SEQ : les deux postes, puis Netherbrain (étape 4).
    for (const item of ['book', 'postit', 'netherbrain']) {
      await expect(hud(page)).toHaveAttribute('data-presented', item, { timeout: 15_000 });
    }
    await expect(hud(page)).toHaveAttribute('data-auto', 'true');
  });

  test('s’arrête à la première action, puis reprend après un temps calme', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/fr?t=12000&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'book', { timeout: 15_000 });
    // Un appui sur la scène, ailleurs que sur un objet.
    await page.locator('canvas').dispatchEvent('pointerdown');
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    // Rien pendant le temps calme (12 s), puis la visite reprend.
    await page.waitForTimeout(6_000);
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 15_000 });
  });

  test('ne démarre pas avec ?auto=0', async ({ page }) => {
    await page.goto('/fr?t=12000&heure=14&auto=0');
    await waitForScene(page);
    await page.waitForTimeout(3_000);
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });

  test('laisse la main à un objet présenté par une puce', async ({ page }) => {
    await page.goto('/fr?t=12000&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 15_000 });
    await page
      .getByRole('navigation', { name: "Le CV en un coup d'œil" })
      .getByRole('link', { name: /Contact/ })
      .click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await page.waitForTimeout(2_000);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
  });
});

test.describe('en mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pose la scène tout de suite et ne lance jamais la visite', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/fr?heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled');
    // La visite démarrerait 1.6 s après la fin de l'arrivée : on attend plus.
    await page.waitForTimeout(4_000);
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    expect(errors).toEqual([]);
  });

  test('reste posée quand on change d’ambiance', async ({ page }) => {
    await page.goto('/fr?heure=14');
    await waitForScene(page);
    await page.getByRole('button', { name: 'Nuit' }).click();
    await expect(hud(page)).toHaveAttribute('data-mood', 'night');
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled');
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
  });
});
