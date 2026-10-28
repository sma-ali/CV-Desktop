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
    // L'état se dit aussi aux lecteurs d'écran : puce courante et annonce.
    await expect(chip).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#hud [role="status"]')).toHaveText(
      /2024 DARES\. Objet vu de près\. Échap pour le reposer\./,
    );
    // La page n'a pas suivi le lien vers la version express.
    await expect(page).toHaveURL(/\/fr\?/);
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(chip).not.toHaveAttribute('data-on', 'true');
    await expect(chip).not.toHaveAttribute('aria-current', 'true');
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
    // L'écran montre tout le parcours : aucune puce ne s'allume avec lui.
    await expect(page.locator('a[data-step][data-on]')).toHaveCount(0);
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
    // Le choix s'annonce une fois ; l'heure qui passe, jamais.
    await expect(page.locator('#hud [role="status"]')).toHaveText(
      'Lumière choisie. Nuit. La lampe veille.',
    );
    await expect(page.locator('#hud [aria-live]')).toHaveCount(0);
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
    // Deux scènes chargées l'une après l'autre : le temps de deux démarrages.
    test.slow();
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
    // Deux scènes chargées l'une après l'autre : le temps de deux démarrages.
    test.slow();
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

test.describe('la perte du contexte WebGL', () => {
  test('passe à la version express avec son propre avis', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.locator('a[data-step="defi-metiers"]').click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    // Ce que fait un téléphone qui reprend un onglet resté en arrière-plan.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(page.locator('[data-fallback]')).toHaveAttribute('data-fallback', 'context-lost');
    await expect(page.getByText("Le bureau en 3D s'est interrompu.")).toBeVisible();
    await expect(page.locator('h1:visible')).toHaveCount(1);
  });
});

test.describe('le HUD sur tablette et téléphone à l’horizontale', () => {
  const overlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const size of [
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    test(`tient dans ${size.width}x${size.height}, sans chevauchement`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(SETTLED);
      await waitForScene(page);
      await expect(page.locator('#hud p[data-on]')).toBeVisible();
      // Les quatre ambiances restent dans la fenêtre, donc à portée de doigt.
      const moods = page.getByRole('group', { name: 'Changer la lumière' }).getByRole('button');
      await expect(moods).toHaveCount(4);
      for (const mood of await moods.all()) {
        const box = await mood.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      }
      // L'indication ne passe ni sous les commandes, ni sous l'identité, ni sur le bas de page.
      const hint = await page.locator('#hud p[data-on]').boundingBox();
      const others = [
        page.getByRole('navigation', { name: 'Commandes' }),
        page.locator('#hud header > div'),
        page.getByRole('navigation', { name: "Le CV en un coup d'œil" }),
      ];
      for (const other of others) {
        const box = await other.boundingBox();
        expect(overlap(hint!, box!)).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    });
  }
});
