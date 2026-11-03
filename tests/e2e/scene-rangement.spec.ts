import { expect, test, type Page } from '@playwright/test';
import { homePlace } from '../../src/scene/core/bodies';
import { DISORDER } from '../../src/scene/tidy/disorder';

// Le désordre, la chute et le rangement (étape 6, partie B). ?desordre lance
// tout le bureau en l'air dès que le moteur est prêt ; sous &fige, il
// retombe et se pose d'un coup, toujours de la même façon. L'état se lit sur
// #hud : data-disorder (0 à 1), data-fallen, data-places, data-tidying. Le
// bouton « Oulala, vous avez tout cassé. Je range pour vous ? » porte
// data-tidy (offer, tidying, done) ; la région [data-tidy-status] annonce
// chaque étape aux lecteurs d'écran.

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';
/** Sans &fige : le temps passe, les trajets se jouent. */
const LIVE = '/fr?t=11000&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tidyButton = (page: Page) => page.locator('button[data-tidy]');
const status = (page: Page) => page.locator('[data-tidy-status]');

async function waitForPhysics(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
  await expect(hud(page)).toHaveAttribute('data-physics', 'ready', { timeout: 30_000 });
}

/** Le bureau dispersé s'est posé, et le bouton se propose. */
async function waitForMess(page: Page) {
  await waitForPhysics(page);
  await expect(tidyButton(page)).toHaveAttribute('data-tidy', 'offer', { timeout: 30_000 });
  const disorder = Number(await hud(page).getAttribute('data-disorder'));
  expect(disorder).toBeGreaterThanOrEqual(DISORDER.offer);
}

/** Tout est rentré : rien de déplacé, rien par terre, plus de désordre. */
async function expectTidy(page: Page, timeout = 15_000) {
  await expect(hud(page)).toHaveAttribute('data-tidying', 'false', { timeout });
  await expect(hud(page)).toHaveAttribute('data-places', '', { timeout });
  await expect(hud(page)).toHaveAttribute('data-fallen', '');
  await expect(hud(page)).toHaveAttribute('data-disorder', '0.00');
}

test.describe('le désordre et le rangement', () => {
  test('ne proposent rien sur un bureau rangé', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-disorder', '0.00');
    await expect(tidyButton(page)).toHaveCount(0);
  });

  test('proposent de ranger un bureau dézingué, puis rangent d’un clic', async ({ page }) => {
    await page.goto(`${SETTLED}&desordre`);
    await waitForMess(page);
    // Des objets sont tombés du bureau (sous &fige, ils y restent).
    await expect(hud(page)).toHaveAttribute('data-fallen', /\w/);
    const button = page.getByRole('button', {
      name: 'Oulala, vous avez tout cassé. Je range pour vous ?',
    });
    await expect(button).toBeVisible();
    // Le bouton s'est annoncé.
    await expect(status(page)).toHaveText('Oulala, vous avez tout cassé. Je range pour vous ?');
    await button.click();
    // Sous &fige, le rangement se fait d'un coup.
    await expectTidy(page);
    await expect(status(page)).toHaveText('Bureau rangé.');
    await expect(tidyButton(page)).toHaveAttribute('data-tidy', 'done');
    // Puis le bouton s'en va.
    await expect(tidyButton(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-penetration', /^\d/);
  });

  test('se rangent au clavier, et rendent le focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le clavier : sur ordinateur');
    await page.goto(`${SETTLED}&desordre`);
    await waitForMess(page);
    // Le bouton est dans l'ordre du clavier : on y arrive par Tab depuis la barre du haut.
    await page.getByRole('button', { name: 'Rejouer' }).focus();
    let reached = false;
    for (let i = 0; i < 30 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await tidyButton(page).evaluate((element) => element === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expectTidy(page);
    await expect(tidyButton(page)).toHaveCount(0, { timeout: 10_000 });
    // Le focus n'est pas perdu avec le bouton : il revient d'où il venait.
    const active = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(active).not.toBe('BODY');
    expect(active).not.toBe('');
  });

  test('rangent objet par objet, en mouvement', async ({ page }) => {
    // Sans &fige, sous SwiftShader (2 ou 3 images/s) : le bureau dispersé
    // met longtemps à se poser, et le rangement se joue image par image.
    test.slow();
    test.setTimeout(240_000);
    await page.goto(`${LIVE}&desordre`);
    await waitForPhysics(page);
    await expect(tidyButton(page)).toHaveAttribute('data-tidy', 'offer', { timeout: 120_000 });
    await tidyButton(page).click();
    // Le rangement prend du temps : on le voit en cours.
    await expect(hud(page)).toHaveAttribute('data-tidying', 'true');
    await expect(tidyButton(page)).toHaveAttribute('data-tidy', 'tidying');
    await expect(tidyButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(status(page)).toHaveText('Je range le bureau.');
    await expectTidy(page, 120_000);
    await expect(status(page)).toHaveText('Bureau rangé.');
  });

  test('ramènent tout de suite chaque objet en mouvement réduit', async ({ page }) => {
    test.slow();
    await page.goto(`${SETTLED}&reduit&desordre`);
    await waitForMess(page);
    await tidyButton(page).click();
    await expectTidy(page);
    await expect(status(page)).toHaveText('Bureau rangé.');
  });

  test('sont remis à zéro par Rejouer', async ({ page }) => {
    await page.goto(`${SETTLED}&desordre`);
    await waitForMess(page);
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).toHaveAttribute('data-disorder', '0.00');
    await expect(hud(page)).toHaveAttribute('data-places', '');
    await expect(hud(page)).toHaveAttribute('data-fallen', '');
  });

  test('parlent anglais en anglais', async ({ page, isMobile }) => {
    test.skip(isMobile, 'les mêmes textes sur les deux profils');
    await page.goto('/en?t=11000&fige&auto=0&heure=14&desordre');
    await waitForMess(page);
    await expect(
      page.getByRole('button', { name: 'Oops, you broke everything. Shall I tidy up?' }),
    ).toBeVisible();
    await tidyButton(page).click();
    await expect(status(page)).toHaveText('Desk tidied up.');
  });
});

test.describe('la chute', () => {
  test('laisse par terre un objet tombé sous &fige (le monde est arrêté)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'le même moteur sur les deux profils');
    await page.goto(`${SETTLED}&glisse=book:-9,0`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-fallen', /\bbook\b/, { timeout: 20_000 });
    // Bien au-delà du délai de retour (en temps réel) : il reste par terre.
    await page.waitForTimeout(6_000);
    await expect(hud(page)).toHaveAttribute('data-fallen', /\bbook\b/);
  });

  test('ramène en douceur à sa place un objet tombé du bureau', async ({ page }) => {
    // En temps réel sous SwiftShader : chute, délai, trajet, image par image.
    test.slow();
    test.setTimeout(240_000);
    await page.goto(`${LIVE}&glisse=book:-9,0`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-fallen', /\bbook\b/, { timeout: 90_000 });
    await expect(hud(page)).toHaveAttribute('data-fallen', '', { timeout: 150_000 });
    // De retour sur le plateau, chez lui (s'il n'a pas trouvé sa place
    // occupée par un objet poussé en tombant : il se pose alors dessus).
    const raw = (await hud(page).getAttribute('data-places')) ?? '';
    const entry = raw.split(' ').find((value) => value.startsWith('book:'));
    if (entry) {
      const [x = 0, z = 0] = entry.slice('book:'.length).split(',').map(Number);
      const viewport = page.viewportSize()!;
      const home = homePlace('book', viewport.width / viewport.height < 0.9);
      expect(Math.hypot(x - home.x, z - home.z)).toBeLessThan(1.5);
    }
  });
});
