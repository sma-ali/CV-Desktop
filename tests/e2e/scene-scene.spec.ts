import { expect, test, type Page } from '@playwright/test';

// La mise en scène du bureau : l'arrivée qui se pose, la visite
// automatique (ordre des objets, arrêt sur une action, reprise) et le
// mouvement réduit. L'horloge de la scène suit le temps réel : les tests
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

test.describe('l’arrivée', () => {
  test('part du noir et se pose après SETTLE', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    // La page note elle-même chaque phase : sous rendu logiciel, une image
    // peut durer plusieurs secondes, et un sondage raterait une phase courte.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __phases: string[] }).__phases = seen;
      new MutationObserver(() => {
        const phase = document.getElementById('hud')?.getAttribute('data-phase');
        if (phase && seen.at(-1) !== phase) seen.push(phase);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
    });
    await page.goto('/fr?heure=14&auto=0');
    await waitForScene(page);
    const first = await hud(page).getAttribute('data-phase');
    expect(PHASES.indexOf(first ?? '')).toBeLessThan(PHASES.indexOf('window'));
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled', { timeout: 40_000 });
    const seen = await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases);
    // Dans l'ordre, sans retour en arrière, du noir au bureau posé.
    const order = seen.map((phase) => PHASES.indexOf(phase));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!);
    expect(seen.at(-1)).toBe('settled');
    expect(errors).toEqual([]);
  });
});

test.describe('la visite automatique', () => {
  test('présente les objets dans l’ordre', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/fr?t=12000&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 15_000 });
    // AUTO_SEQ : les deux postes, le boîtier du CASD, puis Netherbrain.
    for (const item of ['book', 'postit', 'casd', 'netherbrain']) {
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
});
