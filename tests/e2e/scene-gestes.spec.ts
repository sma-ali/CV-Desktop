import { expect, test, type Page } from '@playwright/test';

// Les gestes (partie « gestes », étape 4) : prendre, retourner, glisser,
// collisions. L'état se lit sur #hud : data-presented, data-flipped,
// data-dragging, data-places (« id:x,z,ry » des objets déplacés).
//
// Squelette du socle : l'état exposé au départ. La partie « gestes »
// ajoute ici ses parcours (clic qui retourne, glisser à la souris et au
// doigt, seuil de 7 px, ?glisse, collisions, Rejouer).

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

test.describe('les gestes', () => {
  test('exposent un bureau au repos : rien de retourné, rien de déplacé', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expect(hud(page)).toHaveAttribute('data-places', '');
  });

  test('présentent un objet retourné, sauf avec ?recto', async ({ page }) => {
    await page.goto(`${SETTLED}&prendre=card`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    await page.goto(`${SETTLED}&prendre=card&recto`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
  });
});
