import { expect, test, type Page } from '@playwright/test';
import { bodyObb, homePlace, obbOutside, type DeskPlace } from '../../src/scene/core/bodies';
import { BOUNDS, HELD } from '../../src/scene/core/constants';
import { BODY_IDS } from '../../src/scene/core/ids';
import { DESK_WORLD } from '../../src/scene/gestures/drag';
import { overlapScore, type SolverBodies } from '../../src/scene/gestures/solver';

// Les gestes (partie « gestes », étape 4) : prendre, retourner, glisser,
// collisions. De vrais gestes sur le canvas (souris sur ordinateur, doigt
// sur téléphone) ; l'état se lit sur #hud : data-presented, data-flipped,
// data-dragging, data-places (« id:x,z,ry » des objets déplacés). Les
// recouvrements se vérifient avec le solveur lui-même, sur les places lues.

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

interface Point {
  x: number;
  y: number;
}

/** Un point sur l'objet, juste sous son étiquette (comme scene-objets). */
async function pointOnItem(page: Page, item: string, below = 28): Promise<Point> {
  await expect(tag(page, item)).toHaveAttribute('data-shown', 'true');
  const box = await tag(page, item).boundingBox();
  if (!box) throw new Error(`étiquette invisible : ${item}`);
  return { x: box.x + box.width / 2, y: box.y + box.height + below };
}

/** Les places lues sur #hud, complétées des places de repos. */
async function deskState(page: Page): Promise<SolverBodies> {
  const raw = (await hud(page).getAttribute('data-places')) ?? '';
  const viewport = page.viewportSize()!;
  const portrait = viewport.width / viewport.height < 0.9;
  const moved = new Map<string, DeskPlace>();
  for (const entry of raw.split(' ').filter(Boolean)) {
    const [id = '', values = ''] = entry.split(':');
    const [x = 0, z = 0, ry = 0] = values.split(',').map(Number);
    moved.set(id, { x, z, ry });
  }
  return Object.fromEntries(
    BODY_IDS.map((id) => [
      id,
      { ...(moved.get(id) ?? homePlace(id, portrait)), moved: moved.has(id) },
    ]),
  ) as SolverBodies;
}

/** Aucun recouvrement : places au centième, donc une tolérance d'un centième. */
async function expectNoOverlap(page: Page) {
  const desk = await deskState(page);
  // Les places sont arrondies au centième : on rétrécit un peu les corps.
  expect(overlapScore(desk, BODY_IDS, DESK_WORLD)).toBeLessThan(0.03);
  for (const id of BODY_IDS) {
    expect(obbOutside(bodyObb(id, desk[id]), BOUNDS), id).toBeLessThanOrEqual(0.01);
  }
  return desk;
}

const movedIds = async (page: Page) =>
  ((await hud(page).getAttribute('data-places')) ?? '')
    .split(' ')
    .filter(Boolean)
    .map((entry) => entry.split(':')[0]);

/**
 * Un vrai glisser : appui, déplacement en plusieurs pas, relâchement. À la
 * souris sur ordinateur, au doigt (événements tactiles du navigateur) sur
 * téléphone.
 */
async function drag(
  page: Page,
  from: Point,
  to: Point,
  {
    touch = false,
    steps = 12,
    during,
  }: { touch?: boolean; steps?: number; during?: () => Promise<void> } = {},
) {
  if (!touch) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    }
    await during?.();
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
  await during?.();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * Attend que la scène ait dessiné quelques images : React Three Fiber teste
 * le pointeur contre les objets tels qu'ils ont été dessinés, et SwiftShader
 * dessine lentement (un objet qu'on vient de présenter est encore sur le
 * bureau pour le pointeur tant que l'image suivante n'est pas faite).
 */
async function nextFrames(page: Page, count = 3) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  }, count);
}

/** Un clic ou un tap à un point du canvas. */
async function tap(page: Page, point: Point, isMobile: boolean) {
  if (isMobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

/** Où se tient l'objet présenté à l'écran (HELD, en coordonnées normalisées). */
function heldPoint(page: Page): Point {
  const { width, height } = page.viewportSize()!;
  const held = width / height < 0.9 ? HELD.portrait : HELD.landscape;
  return { x: ((held.x + 1) / 2) * width, y: ((1 - held.y) / 2) * height };
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
    // Deux scènes chargées l'une après l'autre : le temps de deux démarrages.
    test.slow();
    await page.goto(`${SETTLED}&prendre=card`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    await page.goto(`${SETTLED}&prendre=card&recto`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
  });

  test('glissent le portable contre la carte sans la chevaucher', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const laptop = await pointOnItem(page, 'laptop');
    const card = await pointOnItem(page, 'card');
    await drag(page, laptop, card, {
      touch: isMobile,
      during: async () => {
        await expect(hud(page)).toHaveAttribute('data-dragging', 'laptop');
      },
    });
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    // Un glisser ne présente rien.
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/);
    // La carte a été poussée devant le portable, sans recouvrement.
    expect(await movedIds(page)).toContain('card');
    await expectNoOverlap(page);
  });

  test('gardent sur le plateau un objet glissé vers le bord', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const viewport = page.viewportSize()!;
    const book = await pointOnItem(page, 'book');
    // Le livre tiré jusqu'au bord gauche de la fenêtre, et au-delà du plateau.
    await drag(page, book, { x: 2, y: book.y + 40 }, { touch: isMobile, steps: 16 });
    await expect(hud(page)).toHaveAttribute('data-places', /book:/);
    const desk = await expectNoOverlap(page);
    expect(desk.book.x).toBeLessThan(homePlace('book', viewport.width / viewport.height < 0.9).x);
  });

  test('jouent ?glisse= pour un objet du décor : la tasse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le même solveur sur les deux profils');
    await page.goto(`${SETTLED}&glisse=mug:4.9,0`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-places', 'mug:4.90,0.00,0.00');
  });

  test('comptent un appui qui bouge de moins de 7 px comme un clic', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const book = await pointOnItem(page, 'book');
    await drag(page, book, { x: book.x + 4, y: book.y + 2 }, { touch: isMobile, steps: 2 });
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await expect(hud(page)).toHaveAttribute('data-places', '');
  });

  test('retournent l’objet tenu d’un clic, et le remettent d’un autre', async ({
    page,
    isMobile,
  }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await tap(page, await pointOnItem(page, 'card'), isMobile);
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    const held = heldPoint(page);
    await nextFrames(page);
    await tap(page, held, isMobile);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await nextFrames(page);
    await tap(page, held, isMobile);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
  });

  test('reposent un objet déplacé à sa nouvelle place, jusqu’à Rejouer', async ({
    page,
    isMobile,
  }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    const card = await pointOnItem(page, 'card');
    await drag(page, card, { x: card.x + 40, y: card.y + 12 }, { touch: isMobile });
    await expect(hud(page)).toHaveAttribute('data-places', /card:/);
    const places = await hud(page).getAttribute('data-places');
    // Présentée (puce du contact) puis reposée : elle revient là où on l'a laissée.
    await page.getByRole('link', { name: /^Contact/ }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(hud(page)).toHaveAttribute('data-places', places ?? '');
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).toHaveAttribute('data-places', '');
  });

  test('jouent ?glisse : le portable poussé sur la carte, sans recouvrement', async ({ page }) => {
    await page.goto(`${SETTLED}&glisse`);
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:.*card:|card:.*laptop:/);
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expectNoOverlap(page);
  });

  test('jouent aussi ?glisse sans horloge gelée, puis lâchent le corps', async ({ page }) => {
    await page.goto('/fr?t=11000&auto=0&heure=14&glisse');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/);
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expectNoOverlap(page);
  });

  test('glissent en mouvement réduit', async ({ page, isMobile }) => {
    await page.goto('/fr?reduit&heure=14');
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    const laptop = await pointOnItem(page, 'laptop');
    await drag(page, laptop, { x: laptop.x - 30, y: laptop.y - 20 }, { touch: isMobile });
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/);
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expectNoOverlap(page);
    // Rejouer reste là en mouvement réduit : il remet les objets en place.
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(hud(page)).toHaveAttribute('data-places', '');
    await expect(hud(page)).toHaveAttribute('data-phase', 'settled');
  });

  test('laissent présenté l’objet qu’on glissait, choisi au clavier', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'souris et clavier à la fois');
    await page.goto(SETTLED);
    await waitForScene(page);
    const book = await pointOnItem(page, 'book');
    await page.mouse.move(book.x, book.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(book.x + i * 10, book.y);
    await expect(hud(page)).toHaveAttribute('data-dragging', 'book');
    // Bouton toujours enfoncé, le livre est présenté par sa puce.
    await page.locator('[data-step="defi-metiers"]').focus();
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    // Le même appui ne relance pas de glisser : le livre reste présenté.
    for (let i = 1; i <= 4; i++) await page.mouse.move(book.x + 60 + i * 10, book.y + i * 4);
    await nextFrames(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await page.mouse.up();
    await nextFrames(page);
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
  });

  test('coupent la visite automatique', async ({ page, isMobile }) => {
    test.setTimeout(90_000);
    // Avant la visite (AUTO_START = 12.6 s), on repère les corps sous leur étiquette.
    await page.goto('/fr?t=10000&heure=14');
    await waitForScene(page);
    const candidates = ['card', 'laptop', 'chest', 'netherbrain', 'homelab'] as const;
    const points = new Map<string, Point>();
    for (const id of candidates) points.set(id, await pointOnItem(page, id));
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 20_000 });
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    // La fiche du livre couvre une partie du bureau (à droite sur
    // ordinateur) : on prend le premier corps que le pointeur atteint. En
    // portrait, la feuille du bas couvre tout le bureau : on glisse pendant
    // la pause de la visite entre deux objets (AUTO_TIMING.gap).
    const reachable = async () => {
      for (const [id, point] of points) {
        const onCanvas = await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
          point,
        );
        if (onCanvas) return { id, point };
      }
      return null;
    };
    let target = await reachable();
    if (!target) {
      await expect(hud(page)).toHaveAttribute('data-presented', '', { timeout: 20_000 });
      await expect(hud(page)).toHaveAttribute('data-auto', 'true');
      target = await reachable();
    }
    if (!target) throw new Error('aucun corps hors de la fiche');
    const { id, point } = target;
    await drag(page, point, { x: point.x - 40, y: point.y + 10 }, { touch: isMobile });
    await expect(hud(page)).toHaveAttribute('data-auto', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(hud(page)).toHaveAttribute('data-places', new RegExp(`${id}:`));
  });

  test('ne font pas défiler la page au doigt', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'au doigt seulement');
    await page.goto(SETTLED);
    await waitForScene(page);
    const before = await page.evaluate(() => window.scrollY);
    const card = await pointOnItem(page, 'card');
    await drag(page, card, { x: card.x, y: card.y - 80 }, { touch: true });
    await expect(hud(page)).toHaveAttribute('data-places', /card:/);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});
