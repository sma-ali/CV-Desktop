import { expect, test, type Page } from '@playwright/test';

// Les nouveaux objets et le cadrage (partie « objets », étape 4) : le bocal
// de Netherbrain, la baie du Homelab, le coffret qui bat, le bureau entier
// à l'écran du téléphone (data-offscreen sur #hud : ce qui sort du cadre).
//
// Squelette du socle : les deux objets portent leur étiquette et se
// présentent. La partie « objets » ajoute ici ses parcours (verso du bocal,
// LED de la baie, battement du coffret, data-offscreen vide en portrait et
// en paysage sur téléphone).

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

test.describe('Netherbrain et Homelab', () => {
  test('portent leur étiquette et se présentent', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(tag(page, 'netherbrain')).toHaveText(/2026\s*Netherbrain/);
    await expect(tag(page, 'homelab')).toHaveText(/2026\s*Homelab/);
    await tag(page, 'netherbrain').click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'netherbrain');
    await page.keyboard.press('Escape');
    await page.goto(`${SETTLED}&prendre=homelab`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'homelab');
  });
});

test.describe('le cadrage', () => {
  test('garde tout le bureau dans le cadre sur ordinateur', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le téléphone est le travail de la partie objets');
    await page.goto(SETTLED);
    await waitForScene(page);
    // Le relevé se fait toutes les 12 images, une fois l'arrivée finie.
    await expect(hud(page)).toHaveAttribute('data-offscreen', '');
  });
});
