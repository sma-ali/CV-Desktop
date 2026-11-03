import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Le bureau en 3D : le HUD rendu par le serveur, la scène qui arrive ensuite
// (WebGL par SwiftShader, voir playwright.config.ts), et le repli sur la
// version express sans JavaScript ou sans WebGL.

// Arrivée finie, horloge gelée, sans visite automatique : un état stable.
const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

// Une chaîne qui n'existe que dans le code de three.
const THREE_MARKER = 'THREE.WebGLRenderer';

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

/** Fait croire au navigateur qu'il ne sait pas faire de WebGL. */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as (...args: unknown[]) => RenderingContext | null).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

test.describe('le HUD', () => {
  test('est là sans attendre la 3D, et ses puces mènent à la version express', async ({ page }) => {
    // Aucun JavaScript ne se charge : seul compte le HTML du serveur.
    await page.route('**/_next/static/chunks/*.js', (route) => route.abort());
    await page.goto('/fr');
    const top = page.locator('#hud header');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ali Smaani');
    await expect(top.getByText('Développeur Full-Stack', { exact: true })).toBeVisible();
    await expect(top.getByText('Disponible', { exact: true })).toBeVisible();
    await expect(top.getByText('Île-de-France ou remote', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Version express' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'English' })).toBeVisible();

    const steps = page
      .getByRole('navigation', { name: "Le CV en un coup d'œil" })
      .getByRole('link');
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(0)).toContainText('2020');
    await expect(steps.nth(0)).toContainText('DEFI-METIERS');
    await expect(steps.nth(1)).toContainText('2024');
    await expect(steps.nth(2)).toContainText('Netherbrain | Homelab');
    await expect(steps.nth(3)).toContainText('Projets perso');
    await expect(steps.nth(4)).toContainText('Contact');

    await steps.nth(1).click();
    await expect(page).toHaveURL(/\/fr\/express#dares$/);
  });

  test('passe l’audit axe une fois la scène posée', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const results = await new AxeBuilder({ page })
      .include('#hud')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('la scène', () => {
  test('dessine le bureau, sans erreur dans la console', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/fr?auto=0');
    await waitForScene(page);
    await page.waitForTimeout(2_000);
    expect(errors).toEqual([]);
  });

  test('finit par dessiner des pixels non uniformes', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('aria-label', /Le bureau d'Ali vu d'en haut/);
    await page.waitForTimeout(500);
    const png = (await canvas.screenshot()).toString('base64');
    // Le navigateur décode l'image et compte les couleurs (au 1/16e).
    const colors = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const scratch = document.createElement('canvas');
      scratch.width = image.width;
      scratch.height = image.height;
      const ctx = scratch.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < pixels.length; i += 4 * 7) {
        seen.add(((pixels[i]! >> 4) << 8) | ((pixels[i + 1]! >> 4) << 4) | (pixels[i + 2]! >> 4));
      }
      return seen.size;
    }, png);
    expect(colors).toBeGreaterThan(12);
  });

  test('arrive dans un fichier JavaScript à part', async ({ page, request }) => {
    // Le JavaScript initial (balises du HTML) ne contient pas three.
    const html = await (await request.get('/fr')).text();
    const initial = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((match) => match[1]!);
    expect(initial.length).toBeGreaterThan(0);
    for (const src of initial) {
      expect(await (await request.get(src)).text()).not.toContain(THREE_MARKER);
    }

    // Il arrive ensuite, chargé par la page.
    const later: string[] = [];
    page.on('response', async (response) => {
      if (response.url().endsWith('.js') && !initial.some((src) => response.url().endsWith(src))) {
        later.push(await response.text().catch(() => ''));
      }
    });
    await page.goto('/fr?auto=0');
    await waitForScene(page);
    expect(later.some((code) => code.includes(THREE_MARKER))).toBe(true);
  });

  test('présente l’objet d’une puce au lieu de quitter la page', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const chip = page.getByRole('link', { name: /2020/ });
    await chip.click();
    await expect(page).toHaveURL(/\/fr\?/);
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await expect(chip).toHaveAttribute('data-on', 'true');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });

  test('Rejouer relance l’arrivée', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled');
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).not.toHaveAttribute('data-phase', 'settled');
  });

  test('donne la nuit à 23 h', async ({ page }) => {
    await page.goto('/fr?heure=23&auto=0');
    await expect(hud(page)).toHaveAttribute('data-mood', 'night');
    await expect(page.getByRole('button', { name: 'Nuit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Chez vous, il est 23 h.')).toBeVisible();
    await expect(page.getByText('Nuit. La lampe veille.')).toBeVisible();
  });

  test('change de lumière au sélecteur d’ambiance', async ({ page }) => {
    await page.goto('/fr?heure=14&auto=0');
    await expect(hud(page)).toHaveAttribute('data-mood', 'afternoon');
    await page.getByRole('button', { name: 'Matin' }).click();
    await expect(hud(page)).toHaveAttribute('data-mood', 'morning');
    await expect(page.getByRole('button', { name: 'Matin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // L'heure du bas de page le dit, et la région d'état l'annonce.
    await expect(page.getByRole('contentinfo').getByText('Lumière choisie.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Lumière' })).toHaveText(
      'Lumière choisie. Lumière du matin.',
    );
    await page.getByRole('button', { name: 'Après-midi' }).click();
    await expect(page.getByText('Chez vous, il est 14 h.')).toBeVisible();
  });
});

test.describe('en mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('arrive posé, sans visite automatique, Rejouer compris', async ({ page }) => {
    await page.goto('/fr');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled');
    // Rejouer remet les objets déplacés en place, sans rejouer l'arrivée.
    await expect(page.getByRole('button', { name: 'Rejouer' })).toBeVisible();
    // L'horloge part de REDUCED_START (11 s) : sans le mouvement réduit, la
    // visite démarrerait 1.6 s plus tard (AUTO_START). On laisse passer ce
    // moment, avec de la marge pour SwiftShader.
    await page.waitForTimeout(3_000);
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
  });
});

test.describe('le repli', () => {
  test('sans WebGL, montre la version express avec un seul h1', async ({ page }) => {
    await withoutWebGL(page);
    const errors = collectErrors(page);
    await page.goto('/fr');
    await expect(
      page.getByText('Votre navigateur ne peut pas afficher le bureau en 3D.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ali Smaani');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Expériences professionnelles' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Commandes' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Ouvrir la version express' })).toHaveAttribute(
      'href',
      '/fr/express',
    );
    expect(errors).toEqual([]);
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('montre la version express avec un seul h1', async ({ page }) => {
      await page.goto('/en');
      await expect(page.getByText('The 3D desk needs JavaScript.', { exact: false })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ali Smaani');
      await expect(
        page.getByRole('heading', { level: 2, name: 'Professional experience' }),
      ).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Controls' })).toBeHidden();
      await expect(page.getByRole('article').getByText('Available', { exact: true })).toBeVisible();
    });
  });
});

test.describe('les liens', () => {
  test('basculent vers le bureau anglais', async ({ page }) => {
    await page.goto('/fr?auto=0');
    // Étape 6 : l'écran de chargement couvre le HUD jusqu'à la scène prête.
    await waitForScene(page);
    const link = page.getByRole('link', { name: 'English' });
    await expect(link).toHaveAttribute('hreflang', 'en');
    await link.click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('link', { name: 'Express version' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Français' })).toHaveAttribute('href', '/fr');
  });

  test('vont du bureau à la version express et retour', async ({ page }) => {
    await page.goto('/fr?auto=0');
    // Étape 6 : l'écran de chargement couvre le HUD jusqu'à la scène prête.
    await waitForScene(page);
    await page.getByRole('link', { name: 'Version express' }).click();
    await expect(page).toHaveURL(/\/fr\/express$/);
    await page.getByRole('link', { name: 'Revenir au bureau' }).click();
    await expect(page).toHaveURL(/\/fr$/);
    await expect(hud(page)).toBeAttached();
  });

  test('portent canonical, hreflang et Open Graph', async ({ page }) => {
    await page.goto('/en?auto=0');
    const head = page.locator('head');
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://alismaani.fr/en',
    );
    // Next.js écrit la racine sans barre finale.
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      'https://alismaani.fr',
    );
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://alismaani.fr/en/express/opengraph-image',
    );
  });
});
