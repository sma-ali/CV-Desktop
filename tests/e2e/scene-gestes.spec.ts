import { expect, test, type Page } from '@playwright/test';
import { homePlace, type DeskPlace } from '../../src/scene/core/bodies';
import { DESK } from '../../src/scene/core/constants';
import { HELD } from '../../src/scene/core/views';
import type { BodyId } from '../../src/scene/core/ids';

// Les gestes (étape 4, portés sur le moteur physique à l'étape 6) : prendre,
// retourner, glisser, lancer, faire tomber. De vrais gestes sur le canvas
// (souris sur ordinateur, doigt sur téléphone) ; l'état se lit sur #hud :
// data-presented, data-flipped, data-dragging, data-physics, data-places
// (« id:x,z,ry » des corps déplacés), data-fallen (corps tombés du plateau).
// Les interpénétrations se lisent sur le canvas (data-penetration, la plus
// grande profondeur de contact entre deux corps quand le bureau se pose).
// Sous &fige, le monde n'avance que par les gestes, et se pose d'un coup.

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** La scène, puis le moteur physique (chargé à part, après l'arrivée). */
async function waitForPhysics(page: Page) {
  await waitForScene(page);
  await expect(hud(page)).toHaveAttribute('data-physics', 'ready', { timeout: 30_000 });
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

/** Le format de la fenêtre : en portrait, le bureau resserré. */
function isPortraitPage(page: Page): boolean {
  const viewport = page.viewportSize()!;
  return viewport.width / viewport.height < 0.9;
}

/** Les places lues sur #hud (corps déplacés seulement). */
async function placesOf(page: Page): Promise<Map<string, DeskPlace>> {
  const raw = (await hud(page).getAttribute('data-places')) ?? '';
  const moved = new Map<string, DeskPlace>();
  for (const entry of raw.split(' ').filter(Boolean)) {
    const [id = '', values = ''] = entry.split(':');
    const [x = 0, z = 0, ry = 0] = values.split(',').map(Number);
    moved.set(id, { x, z, ry });
  }
  return moved;
}

/** La place d'un corps : lue sur #hud s'il a bougé, sinon sa place d'origine. */
async function placeOf(page: Page, id: BodyId): Promise<DeskPlace> {
  return (await placesOf(page)).get(id) ?? homePlace(id, isPortraitPage(page));
}

/**
 * Le bureau s'est posé sans que deux corps ne s'enfoncent l'un dans l'autre
 * (contacts du moteur, au plus quelques centièmes d'unité).
 */
async function expectNoOverlap(page: Page, timeout = 30_000) {
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-penetration', /^\d/, { timeout });
  const depth = Number(await canvas.getAttribute('data-penetration'));
  expect(depth).toBeLessThan(0.05);
}

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
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expect(hud(page)).toHaveAttribute('data-places', '');
    await expect(hud(page)).toHaveAttribute('data-fallen', '');
    // Sous &fige, le monde ne bouge pas tout seul : tout reste endormi à sa place.
    await nextFrames(page, 6);
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

  // Étape 6 : le corps glissé passe au-dessus de ce qu'il survole (il
  // s'empile) au lieu de pousser la carte à plat comme le solveur 2D de
  // l'étape 4 ; le test ne demande donc plus que la carte ait bougé.
  test('glissent le portable sur la carte sans interpénétration', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForPhysics(page);
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
    await expectNoOverlap(page);
  });

  // Étape 6 : le bord du plateau ne retient plus rien. Un objet tiré vers
  // le bord de la fenêtre part à gauche, et tombe s'il dépasse le plateau.
  test('laissent tomber du plateau un objet tiré au-delà du bord', async ({ page, isMobile }) => {
    // Au doigt, 41 à 45 s seul sous SwiftShader : au-delà de 60 s avec 4 pages.
    test.slow(isMobile, 'glisser au doigt en 16 pas, lent sous SwiftShader');
    await page.goto(SETTLED);
    await waitForPhysics(page);
    const book = await pointOnItem(page, 'book');
    // Le livre tiré jusqu'au bord gauche de la fenêtre.
    await drag(page, book, { x: 2, y: book.y + 40 }, { touch: isMobile, steps: 16 });
    await expect(hud(page)).toHaveAttribute('data-places', /book:/);
    await expectNoOverlap(page);
    const place = await placeOf(page, 'book');
    expect(place.x).toBeLessThan(homePlace('book', isPortraitPage(page)).x);
    // Au-delà du bord gauche du plateau, il est tombé.
    const fallen = ((await hud(page).getAttribute('data-fallen')) ?? '').split(' ');
    if (place.x < DESK.x0 - 1.2) expect(fallen).toContain('book');
    if (!fallen.includes('book')) expect(place.x).toBeGreaterThan(DESK.x0 - 1.2);
  });

  test('jouent ?glisse= pour un objet du décor : la tasse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le même moteur sur les deux profils');
    await page.goto(`${SETTLED}&glisse=mug:4.9,0`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-places', /mug:/);
    // Le corps vise la place demandée, puis retombe sur le plateau : à 5 centièmes près.
    const mug = await placeOf(page, 'mug');
    expect(Math.abs(mug.x - 4.9)).toBeLessThan(0.05);
    expect(Math.abs(mug.z)).toBeLessThan(0.05);
    await expectNoOverlap(page);
  });

  test('déplacent aussi le décor : la lampe, le clavier', async ({ page, isMobile }) => {
    test.skip(isMobile, 'le même moteur sur les deux profils');
    // Deux scènes chargées l'une après l'autre : le temps de deux démarrages.
    test.slow();
    await page.goto(`${SETTLED}&glisse=lamp:-4.2,-1.6`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-places', /lamp:/);
    await page.goto(`${SETTLED}&glisse=keyboard:0.3,0.6`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-places', /keyboard:/);
    await expectNoOverlap(page);
  });

  test('comptent un appui qui bouge de moins de 7 px comme un clic', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForPhysics(page);
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

  test('reposent un objet déplacé à sa nouvelle place', async ({ page, isMobile }) => {
    await page.goto(SETTLED);
    await waitForPhysics(page);
    const card = await pointOnItem(page, 'card');
    await drag(page, card, { x: card.x + 40, y: card.y + 12 }, { touch: isMobile });
    await expect(hud(page)).toHaveAttribute('data-places', /card:/);
    const before = await placeOf(page, 'card');
    // Présentée (puce du contact) puis reposée : elle revient là où on l'a
    // laissée (rendue au moteur, elle s'y repose, à quelques centièmes près).
    await page.getByRole('link', { name: /^Contact/ }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'card');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await nextFrames(page, 6);
    const after = await placeOf(page, 'card');
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05);
  });

  test('jouent ?glisse : le portable posé sur la carte, sans interpénétration', async ({
    page,
  }) => {
    await page.goto(`${SETTLED}&glisse`);
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/);
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expectNoOverlap(page);
  });

  test('jouent aussi ?glisse sans horloge gelée, puis lâchent le corps', async ({ page }) => {
    // En temps réel, le monde avance d'au plus 4 pas par image : à 2 ou 3
    // images par seconde sous SwiftShader (4 pages à la fois), il lui faut
    // jusqu'à une minute pour se poser, contre 2 à 5 s sur un vrai écran.
    test.slow();
    await page.goto('/fr?t=11000&auto=0&heure=14&glisse');
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/, { timeout: 30_000 });
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expectNoOverlap(page, 90_000);
  });

  test('glissent en mouvement réduit', async ({ page, isMobile }) => {
    // En temps réel, comme ci-dessus : lent à se poser sous SwiftShader.
    test.slow();
    await page.goto('/fr?reduit&heure=14');
    await waitForPhysics(page);
    await expect(hud(page)).toHaveAttribute('data-reduced', 'true');
    const laptop = await pointOnItem(page, 'laptop');
    await drag(page, laptop, { x: laptop.x - 30, y: laptop.y - 20 }, { touch: isMobile });
    await expect(hud(page)).toHaveAttribute('data-places', /laptop:/);
    await expect(hud(page)).toHaveAttribute('data-dragging', '');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expectNoOverlap(page, 90_000);
  });

  test('laissent présenté l’objet qu’on glissait, choisi au clavier', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'souris et clavier à la fois');
    await page.goto(SETTLED);
    await waitForPhysics(page);
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
    // En portrait, on attend la pause qui suit le livre : plus long au doigt.
    test.setTimeout(isMobile ? 150_000 : 90_000);
    // Avant la visite (AUTO_START = 12.6 s), on repère les corps sous leur étiquette.
    await page.goto('/fr?t=10000&heure=14');
    await waitForScene(page);
    const candidates = ['card', 'laptop', 'chest', 'netherbrain', 'homelab'] as const;
    const points = new Map<string, Point>();
    for (const id of candidates) points.set(id, await pointOnItem(page, id));
    await expect(hud(page)).toHaveAttribute('data-auto', 'true', { timeout: 20_000 });
    await expect(hud(page)).toHaveAttribute('data-physics', 'ready');
    await expect(hud(page)).toHaveAttribute('data-presented', 'book');
    // La fiche du livre couvre une partie du bureau (à droite sur
    // ordinateur) : on prend le premier corps que le pointeur atteint. En
    // portrait, la feuille du bas couvre le bas du bureau et l'objet tenu le
    // haut (le bureau resserré dépasse entre les deux, mais le livre qui
    // s'ouvre finit par le couvrir) : on glisse pendant la pause de la
    // visite qui suit le livre (AUTO_TIMING.gap, puis le post-it, qui ne
    // glisse pas). Le portable, à droite, est loin du livre qui revient à
    // gauche ; son point se mesure au début de la pause.
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
    let target = isPortraitPage(page) ? null : await reachable();
    if (!target) {
      await expect(hud(page)).toHaveAttribute('data-presented', '', { timeout: 20_000 });
      await expect(hud(page)).toHaveAttribute('data-auto', 'true');
      target = isPortraitPage(page)
        ? { id: 'laptop', point: await pointOnItem(page, 'laptop') }
        : await reachable();
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
    await waitForPhysics(page);
    const before = await page.evaluate(() => window.scrollY);
    const card = await pointOnItem(page, 'card');
    await drag(page, card, { x: card.x, y: card.y - 80 }, { touch: true });
    await expect(hud(page)).toHaveAttribute('data-places', /card:/);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});
