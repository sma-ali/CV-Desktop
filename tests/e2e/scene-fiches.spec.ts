import { expect, test, type Page } from '@playwright/test';

// Les fiches (partie « fiches », étape 4) : le bristol de l'objet présenté
// (#sheet, data-open et data-sheet), le bouton « Son » (aria-pressed, et
// data-sound sur #hud), les signes de vie du coffret, l'indication du HUD.
//
// Squelette du socle : la fiche s'ouvre avec son titre et se ferme par
// « Reposer » ; le son est coupé jusqu'au clic. La partie « fiches » ajoute
// ici ses parcours (contenu FR et EN, Préc. / Suiv., flèches, Retourner,
// focus, signes de vie, téléphone, AudioContext créé au clic seulement).

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const sheet = (page: Page) => page.locator('#sheet');

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

test.describe('la fiche', () => {
  test('s’ouvre avec l’objet présenté et se ferme en le reposant', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
    await page.getByRole('link', { name: /2026/ }).click();
    await expect(sheet(page)).toHaveAttribute('data-open', 'true');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'netherbrain');
    await expect(sheet(page).getByRole('heading', { name: 'Netherbrain' })).toBeVisible();
    await sheet(page).getByRole('button', { name: "Reposer l'objet" }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
  });
});

test.describe('le son', () => {
  test('est coupé jusqu’au clic sur « Son »', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const button = page.getByRole('button', { name: 'Son' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(hud(page)).toHaveAttribute('data-sound', 'off');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(hud(page)).toHaveAttribute('data-sound', 'on');
  });
});
