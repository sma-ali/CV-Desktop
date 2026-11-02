import { expect, test, type Page } from '@playwright/test';
import { Quaternion } from 'three';
import { getContent } from '../../src/content';
import { HELD } from '../../src/scene/core/constants';
import { rotationAngle, SPIN, turnRotation } from '../../src/scene/rotation/trackball';

// La rotation libre de l'objet présenté (partie A de l'étape 6) : glisser
// sur l'objet tenu (souris sur ordinateur, doigt sur téléphone) le fait
// tourner dans tous les sens, il garde l'orientation donnée ; un clic le
// retourne toujours ; les flèches du clavier le tournent d'un pas, Début ou
// « Remettre droit » le ramènent ; Page précédente et Page suivante passent
// à l'objet voisin. L'état se lit sur #hud (data-turned, data-flipped,
// data-presented) et sur le canvas (data-spin : l'angle de la rotation
// libre, en radians). Sous &fige, ni inertie ni animation : tout est
// immédiat et déterministe.

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';
const LIVE = '/fr?t=11000&auto=0&heure=14';
const { ui } = getContent('fr').sheets;

const hud = (page: Page) => page.locator('#hud');
const canvas = (page: Page) => page.locator('canvas');
const sheet = (page: Page) => page.locator('#sheet');
const upright = (page: Page) => sheet(page).getByRole('button', { name: ui.upright });

interface Point {
  x: number;
  y: number;
}

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** Quelques images dessinées : le pointeur se teste contre l'objet tel qu'il est dessiné. */
async function nextFrames(page: Page, count = 3) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  }, count);
}

/** Où se tient l'objet présenté à l'écran (HELD, en coordonnées normalisées). */
function heldPoint(page: Page): Point {
  const { width, height } = page.viewportSize()!;
  const held = width / height < 0.9 ? HELD.portrait : HELD.landscape;
  return { x: ((held.x + 1) / 2) * width, y: ((1 - held.y) / 2) * height };
}

/** L'angle de la rotation libre (data-spin du canvas). */
async function spinOf(page: Page): Promise<number> {
  return Number((await canvas(page).getAttribute('data-spin')) ?? 'NaN');
}

async function expectSpin(page: Page, angle: number, tolerance = 0.01) {
  await expect
    .poll(async () => Math.abs((await spinOf(page)) - angle), { timeout: 15_000 })
    .toBeLessThan(tolerance);
}

/** Un vrai glisser : souris sur ordinateur, doigt (événements tactiles) sur téléphone. */
async function drag(page: Page, from: Point, to: Point, touch: boolean, steps = 12) {
  if (!touch) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    }
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touchAt = (point: Point) => [{ x: point.x, y: point.y, id: 1, radiusX: 4, radiusY: 4 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(from) });
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function tap(page: Page, point: Point, isMobile: boolean) {
  if (isMobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

/** Toutes les valeurs de data-spin écrites à partir de maintenant. */
async function recordSpin(page: Page) {
  await page.evaluate(() => {
    const target = document.querySelector('canvas')!;
    const seen: string[] = [];
    (window as unknown as { spinSeen: string[] }).spinSeen = seen;
    new MutationObserver(() => seen.push(target.dataset.spin ?? '')).observe(target, {
      attributes: true,
      attributeFilter: ['data-spin'],
    });
  });
}

async function recordedSpin(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { spinSeen: string[] }).spinSeen);
}

test.describe('la rotation libre', () => {
  test('glisser sur l’objet tenu le fait tourner, sans le retourner ni le reposer', async ({
    page,
    isMobile,
  }) => {
    await page.goto(`${SETTLED}&prendre=book`);
    await waitForScene(page);
    await nextFrames(page);
    await expect(hud(page)).toHaveAttribute('data-turned', 'false');
    await expectSpin(page, 0);
    // Le bouton « Remettre droit » n'est là que pour un objet tourné.
    await expect(upright(page)).toBeHidden();

    const held = heldPoint(page);
    await drag(page, held, { x: held.x + 110, y: held.y + 30 }, isMobile);
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    await expect.poll(() => spinOf(page)).toBeGreaterThan(0.3);
    // Un glisser n'est pas un clic : le livre reste ouvert et présenté.
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    // Lâché, il garde son orientation.
    const angle = await spinOf(page);
    await nextFrames(page, 4);
    expect(await spinOf(page)).toBeCloseTo(angle, 3);
    await expect(upright(page)).toBeVisible();
  });

  test('tourne dans les trois axes, autour de l’axe de la vue au bord', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'la même boule sur les deux profils');
    await page.goto(`${SETTLED}&prendre=card`);
    await waitForScene(page);
    await nextFrames(page);
    const held = heldPoint(page);
    // Un arc autour du centre, loin de lui : la carte tourne dans le plan de l'écran.
    const r = 260;
    await page.mouse.move(held.x + 30, held.y);
    await page.mouse.down();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      await page.mouse.move(held.x + r * Math.cos(a), held.y - r * Math.sin(a));
    }
    await page.mouse.up();
    await expect.poll(() => spinOf(page)).toBeGreaterThan(0.8);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
  });

  test('un clic sur l’objet tenu le retourne toujours', async ({ page, isMobile }) => {
    await page.goto(`${SETTLED}&prendre=card`);
    await waitForScene(page);
    await nextFrames(page);
    const held = heldPoint(page);
    await tap(page, held, isMobile);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    // Puis tourné : il reste à l'endroit, tourné.
    await nextFrames(page);
    await drag(page, held, { x: held.x - 90, y: held.y + 20 }, isMobile);
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    // R le retourne encore, sans défaire la rotation.
    const angle = await spinOf(page);
    await page.keyboard.press('r');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    expect(await spinOf(page)).toBeCloseTo(angle, 3);
  });

  test('« Remettre droit » ramène l’objet à sa pose de présentation', async ({
    page,
    isMobile,
  }) => {
    await page.goto(`${SETTLED}&prendre=netherbrain`);
    await waitForScene(page);
    await nextFrames(page);
    const held = heldPoint(page);
    await drag(page, held, { x: held.x + 60, y: held.y - 80 }, isMobile);
    await expect(upright(page)).toBeVisible();
    await expect(upright(page)).toHaveAttribute('aria-keyshortcuts', 'Home');
    await upright(page).click();
    await expect(hud(page)).toHaveAttribute('data-turned', 'false');
    await expectSpin(page, 0);
    await expect(upright(page)).toBeHidden();
    await expect(hud(page)).toHaveAttribute('data-presented', 'netherbrain');
  });

  test('au clavier : flèches, Début, Page précédente et Page suivante', async ({ page }) => {
    await page.goto(`${SETTLED}&prendre=book`);
    await waitForScene(page);
    await nextFrames(page);
    await page.keyboard.press('ArrowRight');
    await expectSpin(page, SPIN.keyStep);
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await page.keyboard.press('ArrowLeft');
    await expectSpin(page, 0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expectSpin(page, 2 * SPIN.keyStep);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => spinOf(page)).toBeGreaterThan(SPIN.keyStep - 0.01);
    // Début : remis droit.
    await page.keyboard.press('Home');
    await expectSpin(page, 0);
    await expect(hud(page)).toHaveAttribute('data-turned', 'false');
    // Les voisins passent sur Page précédente et Page suivante ; la rotation repart de zéro.
    await page.keyboard.press('ArrowRight');
    await expectSpin(page, SPIN.keyStep);
    await page.keyboard.press('PageDown');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'badge');
    await expectSpin(page, 0);
    await expect(hud(page)).toHaveAttribute('data-turned', 'false');
    await page.keyboard.press('PageUp');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'book');
  });

  test('les flèches ne tournent rien pendant une saisie', async ({ page }) => {
    await page.goto(`${SETTLED}&prendre=card`);
    await waitForScene(page);
    const field = sheet(page).getByRole('textbox').first();
    await field.click();
    await field.fill('Bonjour');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await nextFrames(page);
    await expectSpin(page, 0);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
  });

  test('l’écran ne tourne pas', async ({ page }) => {
    await page.goto(`${SETTLED}&prendre=monitor`);
    await waitForScene(page);
    await page.keyboard.press('ArrowRight');
    await nextFrames(page);
    await expectSpin(page, 0);
    await expect(hud(page)).toHaveAttribute('data-presented', 'monitor');
    await expect(upright(page)).toHaveCount(0);
  });

  test('?tourne= oriente l’objet de ?prendre=', async ({ page }) => {
    await page.goto(`${SETTLED}&prendre=book&tourne=0.6,1.2`);
    await waitForScene(page);
    await expectSpin(page, rotationAngle(turnRotation({ x: 0.6, y: 1.2 }, new Quaternion())));
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    await expect(upright(page)).toBeVisible();
  });

  test('en temps réel, l’objet lancé garde un peu d’élan puis s’arrête', async ({
    page,
    isMobile,
  }) => {
    // Sans &fige : l'élan se joue image par image, lentes sous SwiftShader.
    test.slow();
    await page.goto(`${LIVE}&prendre=card`);
    await waitForScene(page);
    // La carte se soulève puis se retourne (images de 0.1 s au plus) : sur la
    // tranche, elle n'offre pas de prise au pointeur.
    await nextFrames(page, 30);
    await recordSpin(page);
    const held = heldPoint(page);
    await drag(page, held, { x: held.x + 140, y: held.y }, isMobile, 8);
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    // Plusieurs images après le lâcher, l'angle bouge encore (l'élan)...
    await expect.poll(async () => new Set(await recordedSpin(page)).size).toBeGreaterThan(3);
    // ... puis il s'arrête.
    await expect
      .poll(
        async () => {
          const before = await spinOf(page);
          await nextFrames(page, 3);
          return Math.abs((await spinOf(page)) - before);
        },
        { timeout: 45_000 },
      )
      .toBeLessThan(1e-3);
  });

  test('en mouvement réduit, ni élan ni animation', async ({ page, isMobile }) => {
    test.slow();
    await page.goto('/fr?reduit&heure=14&prendre=card');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    await nextFrames(page);
    const held = heldPoint(page);
    await drag(page, held, { x: held.x + 140, y: held.y }, isMobile, 8);
    await expect(hud(page)).toHaveAttribute('data-turned', 'true');
    await nextFrames(page, 2);
    await recordSpin(page);
    await nextFrames(page, 6);
    // Lâché, il ne bouge plus du tout.
    expect(new Set(await recordedSpin(page)).size).toBeLessThanOrEqual(1);
    // « Remettre droit » : immédiat.
    await upright(page).click();
    await nextFrames(page, 2);
    await expectSpin(page, 0);
  });
});
