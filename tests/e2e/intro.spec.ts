import { expect, test, type Page, type Route } from '@playwright/test';

// L'écran de chargement (étape 6) : rendu par le serveur, il cache le bureau
// tant que la scène se prépare, son filament avance au rythme du chargement
// réel (aria-valuenow de la barre de progression), puis il s'efface. Si la
// scène tarde trop, la version express prend sa place ; si JavaScript ne
// démarre jamais, il s'efface de lui-même.

// Une chaîne qui n'existe que dans le code de three (comme bureau.spec.ts).
const THREE_MARKER = 'THREE.WebGLRenderer';

const hud = (page: Page) => page.locator('#hud');
const intro = (page: Page) => page.getByRole('progressbar', { name: 'Préparation du bureau' });

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** Le fichier de three n'arrive jamais : la scène reste en préparation. */
async function holdThree(page: Page) {
  await page.route('**/_next/static/chunks/**', async (route: Route) => {
    // La page peut se fermer pendant qu'un fichier arrive : on l'oublie.
    try {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(THREE_MARKER)) return; // jamais servi
      await route.fulfill({ response, body });
    } catch {
      // page fermée
    }
  });
}

/** Note chaque valeur de la barre de progression, dès le premier octet. */
async function recordProgress(page: Page) {
  await page.addInitScript(() => {
    const values: number[] = [];
    (window as unknown as { __progress: number[] }).__progress = values;
    const read = () => {
      const value = document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow');
      if (value === null || value === undefined) return;
      if (values.at(-1) !== Number(value)) values.push(Number(value));
    };
    new MutationObserver(read).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-valuenow'],
    });
    document.addEventListener('DOMContentLoaded', read);
  });
}

test.describe('l’écran de chargement', () => {
  test('est dans le HTML du serveur, en français et en anglais', async ({ request }) => {
    const fr = await (await request.get('/fr')).text();
    expect(fr).toContain('Préparation du bureau');
    expect(fr).toMatch(/role="progressbar"[^>]*aria-valuenow="0"/);
    expect(fr).not.toContain('Lire le CV sans attendre');
    const en = await (await request.get('/en')).text();
    expect(en).toContain('Setting up the desk');
  });

  test('avance au rythme du chargement réel, puis s’efface', async ({ page }) => {
    await recordProgress(page);
    await page.goto('/fr?auto=0&heure=14');
    await waitForScene(page);
    await expect(intro(page)).toBeHidden();
    // Le HUD revient dans le parcours au clavier.
    await expect(hud(page)).not.toHaveAttribute('inert');
    const values = await page.evaluate(
      () => (window as unknown as { __progress: number[] }).__progress,
    );
    // Du noir au bureau prêt, sans jamais reculer, par des étapes réelles.
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(100);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
    expect(values.some((value) => value > 0 && value < 100)).toBe(true);
  });

  test('cache le bureau, sans lien, tant que la scène se prépare', async ({ page }) => {
    await holdThree(page);
    await page.goto('/fr?auto=0&attente=0');
    await expect(intro(page)).toBeVisible();
    // La page est hydratée : le HUD caché dessous sort du parcours au clavier.
    await expect(hud(page)).toHaveAttribute('inert', '');
    await expect(hud(page)).toHaveAttribute('data-ready', 'false');
    await expect(intro(page).getByRole('link')).toHaveCount(0);
    // Avec ?attente=0, il ne renonce jamais.
    await page.waitForTimeout(1500);
    await expect(intro(page)).toBeVisible();
    await expect(page.locator('[data-fallback]')).toHaveCount(0);
  });

  test('cède la place à la version express quand la scène tarde trop', async ({ page }) => {
    await holdThree(page);
    await page.goto('/fr?auto=0&attente=1500');
    await expect(intro(page)).toBeVisible();
    await expect(
      page.getByText('Le bureau en 3D met trop de temps à se préparer.', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('[data-fallback="timeout"]')).toHaveCount(1);
    await expect(intro(page)).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Expériences professionnelles' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('s’efface de lui-même si JavaScript ne démarre pas', async ({ page }) => {
    // 12 s d'attente côté CSS, puis le HUD du serveur reprend la main.
    test.slow();
    await page.route('**/_next/static/chunks/*.js', (route) => route.abort());
    await page.goto('/fr');
    await expect(intro(page)).toBeVisible();
    await expect(intro(page)).toBeHidden({ timeout: 20_000 });
    const steps = page
      .getByRole('navigation', { name: "Le CV en un coup d'œil" })
      .getByRole('link');
    await steps.nth(1).click();
    await expect(page).toHaveURL(/\/fr\/express#dares$/);
  });
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('l’écran de chargement ne s’affiche pas : la version express, tout de suite', async ({
    page,
  }) => {
    await page.goto('/fr');
    await expect(page.locator('[role="progressbar"]')).toBeHidden();
    await expect(
      page.getByText('Le bureau en 3D a besoin de JavaScript.', { exact: false }),
    ).toBeVisible();
  });
});

test.describe('l’écran de chargement en mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('ne chauffe ni ne respire : un simple fondu', async ({ page }) => {
    await holdThree(page);
    await page.goto('/fr?auto=0&attente=0');
    await expect(intro(page)).toBeVisible();
    const animations = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return target instanceof Element && target.closest('[role="progressbar"]') !== null;
        }).length,
    );
    expect(animations).toBe(0);
  });

  test('s’efface quand la scène est prête', async ({ page }) => {
    await page.goto('/fr?auto=0');
    await waitForScene(page);
    await expect(intro(page)).toBeHidden();
  });
});
