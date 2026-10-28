import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent, type Locale } from '../../src/content';
import { SHEET_ORDER } from '../../src/scene/core/ids';

// Les fiches (partie « fiches », étape 4) : le bristol de l'objet présenté
// (#sheet, data-open et data-sheet), Préc. / Suiv., flèches, Retourner,
// focus, signes de vie du coffret, le bouton « Son » (aria-pressed, et
// data-sound sur #hud), l'indication du HUD, la feuille du bas sur téléphone.

const SETTLED = 't=11000&fige&auto=0&heure=14';
const at = (locale: Locale, extra = '') => `/${locale}?${SETTLED}${extra ? `&${extra}` : ''}`;

const hud = (page: Page) => page.locator('#hud');
const sheet = (page: Page) => page.locator('#sheet');

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

/** Les mots qui trahiraient le contenu du coffret (même liste que content.test.ts). */
const FORBIDDEN =
  /automatisation|automation|\busines?\b|factory|vid[ée]os?|tiktok|youtube|instagram|twitch|\bcha[iî]nes?\b|channel|usine/i;

test.describe('la fiche', () => {
  test('s’ouvre avec l’objet présenté et se ferme en le reposant', async ({ page }) => {
    await page.goto(at('fr'));
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

  for (const locale of ['fr', 'en'] as const) {
    test(`chaque puce ouvre la bonne fiche (${locale})`, async ({ page }) => {
      const { sheets } = getContent(locale);
      await page.goto(at(locale));
      await waitForScene(page);
      const expected = [
        ['defi-metiers', 'book'],
        ['dares', 'postit'],
        ['projects', 'netherbrain'],
        ['perso', 'chest'],
        ['contact', 'card'],
      ] as const;
      for (const [step, item] of expected) {
        await page.locator(`[data-step="${step}"]`).click();
        await expect(sheet(page)).toHaveAttribute('data-sheet', item);
        const card = sheets.items[item];
        await expect(sheet(page).getByRole('heading', { level: 2 })).toHaveText(card.title);
        await expect(sheet(page)).toContainText(card.kicker);
        await expect(sheet(page)).toContainText(card.body);
        for (const row of card.meta) await expect(sheet(page)).toContainText(row.value);
        // L'appel au contact mène à la version express.
        await expect(sheet(page).getByRole('link', { name: sheets.ui.contact })).toHaveAttribute(
          'href',
          `/${locale}/express#contact`,
        );
        // Sur téléphone, la feuille du bas couvre les puces : on repose.
        await page.keyboard.press('Escape');
        await expect(sheet(page)).toHaveAttribute('data-open', 'false');
      }
    });
  }

  test('Préc. / Suiv. et les flèches parcourent tous les objets', async ({ page }) => {
    await page.goto(at('fr', 'prendre=book'));
    await waitForScene(page);
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'book');
    const next = sheet(page).getByRole('button', { name: 'Objet suivant' });
    const seen: string[] = [];
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      await next.click();
      seen.push((await sheet(page).getAttribute('data-sheet')) ?? '');
    }
    expect(seen).toEqual([...SHEET_ORDER.slice(1), SHEET_ORDER[0]]);

    await sheet(page).getByRole('button', { name: 'Objet précédent' }).click();
    await expect(sheet(page)).toHaveAttribute('data-sheet', SHEET_ORDER.at(-1)!);

    const back: string[] = [];
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      await page.keyboard.press('ArrowLeft');
      back.push((await sheet(page).getAttribute('data-sheet')) ?? '');
    }
    expect(back).toEqual([...SHEET_ORDER].reverse().slice(1).concat(SHEET_ORDER.at(-1)!));
    await page.keyboard.press('ArrowRight');
    await expect(sheet(page)).toHaveAttribute('data-sheet', SHEET_ORDER[0]);
  });

  test('ouverte au clavier, elle prend le focus et Échap le rend', async ({ page }) => {
    await page.goto(at('fr'));
    await waitForScene(page);
    const chip = page.locator('[data-step="dares"]');
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'postit');
    await expect(sheet(page).getByRole('heading', { level: 2 })).toBeFocused();
    // Le titre nomme la région.
    await expect(
      page.getByRole('complementary', { name: getContent('fr').sheets.items.postit.title }),
    ).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'headset');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(chip).toBeFocused();
  });

  test('Reposer au clavier rend le focus à la puce', async ({ page }) => {
    await page.goto(at('fr'));
    await waitForScene(page);
    const chip = page.locator('[data-step="contact"]');
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page).getByRole('heading', { level: 2 })).toBeFocused();
    await sheet(page).getByRole('button', { name: "Reposer l'objet" }).focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
    await expect(chip).toBeFocused();
  });

  test('la visite automatique ne vole pas le focus', async ({ page }) => {
    await page.goto('/fr?t=11000&heure=14');
    await waitForScene(page);
    const mood = page.getByRole('button', { name: 'Nuit' });
    await mood.focus();
    await expect(hud(page)).not.toHaveAttribute('data-presented', '', { timeout: 20_000 });
    await expect(sheet(page)).toHaveAttribute('data-open', 'true');
    await expect(mood).toBeFocused();
  });

  test('Retourner : le bouton et la touche R', async ({ page }) => {
    // Deux scènes chargées l'une après l'autre : le temps de deux démarrages.
    test.slow();
    await page.goto(at('fr', 'prendre=badge'));
    await waitForScene(page);
    const flip = sheet(page).getByRole('button', { name: "Retourner l'objet" });
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    await expect(flip).toHaveAttribute('aria-pressed', 'true');
    await expect(flip).toHaveAttribute('aria-keyshortcuts', 'R');
    await flip.click();
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    await expect(flip).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('r');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    // Ctrl+R reste au navigateur (on ne l'envoie pas : il rechargerait la page).
    // L'écran ne se retourne pas : pas de bouton.
    await page.goto(at('fr', 'prendre=monitor'));
    await waitForScene(page);
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'monitor');
    await expect(sheet(page).getByRole('button', { name: "Retourner l'objet" })).toHaveCount(0);
  });

  test('aucun lien vers un dépôt privé', async ({ page }) => {
    await page.goto(at('fr', 'prendre=book'));
    await waitForScene(page);
    const next = sheet(page).getByRole('button', { name: 'Objet suivant' });
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      await expect(sheet(page).locator('a[href*="github"]')).toHaveCount(0);
      await expect(sheet(page).locator('[data-repository]')).toHaveCount(0);
      await next.click();
    }
  });

  for (const item of ['chest', 'card', 'netherbrain'] as const) {
    test(`passe l’audit axe, fiche ouverte (${item})`, async ({ page }) => {
      await page.goto(at('fr', `prendre=${item}`));
      await waitForScene(page);
      await expect(sheet(page)).toHaveAttribute('data-open', 'true');
      const results = await new AxeBuilder({ page })
        .include('#hud')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('ses boutons font au moins 44 px', async ({ page }) => {
    await page.goto(at('fr', 'prendre=card'));
    await waitForScene(page);
    const targets = sheet(page).locator('button, a[class]');
    expect(await targets.count()).toBeGreaterThanOrEqual(5);
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('la fiche du coffret', () => {
  for (const locale of ['fr', 'en'] as const) {
    test(`montre ses signes de vie, sans rien trahir (${locale})`, async ({ page }) => {
      const { live } = getContent(locale).sheets.ui;
      await page.goto(at(locale, 'prendre=chest'));
      await waitForScene(page);
      await expect(sheet(page)).toHaveAttribute('data-sheet', 'chest');
      const block = sheet(page).locator('[data-live]');
      await expect(block).toBeVisible();
      await expect(block).toContainText(live.title);
      await expect(block).toContainText(live.sample);
      await expect(block.locator('[data-live-running]')).toHaveText('3');
      const last = (await block.locator('[data-live-last]').innerText()).replace(/\s+/g, ' ');
      expect(last).toBe(locale === 'fr' ? 'il y a 2 h 14' : '2 h 14 min ago');
      const since = (await block.locator('[data-live-since]').innerText()).replace(/\s+/g, ' ');
      expect(since).toBe(locale === 'fr' ? '47 jours' : '47 days');

      const chart = block.getByRole('img');
      await expect(chart).toHaveAttribute('aria-label', /14/);
      await expect(chart).toHaveAttribute('aria-label', /3, 5, 2, 0, 4, 6, 3, 7, 5, 2, 6, 4, 8, 5/);
      await expect(chart.locator('i')).toHaveCount(14);
      await expect(block).toContainText(live.axisEnd);

      const text = await sheet(page).innerText();
      expect(text).not.toMatch(FORBIDDEN);
      expect(await chart.getAttribute('aria-label')).not.toMatch(FORBIDDEN);
    });
  }
});

test.describe('le son', () => {
  test.beforeEach(async ({ page }) => {
    // Compte les AudioContext créés : aucun avant le clic sur « Son ».
    await page.addInitScript(() => {
      const w = window as unknown as { __audioContexts: number; AudioContext: typeof AudioContext };
      w.__audioContexts = 0;
      const Original = w.AudioContext;
      if (!Original) return;
      w.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.__audioContexts += 1;
        }
      };
    });
  });

  const contexts = (page: Page) =>
    page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts);

  test('est coupé jusqu’au clic sur « Son », sans erreur', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(at('fr'));
    await waitForScene(page);
    const button = page.getByRole('button', { name: 'Son' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(hud(page)).toHaveAttribute('data-sound', 'off');

    // Prendre et reposer un objet ne crée aucun son.
    await page.locator('[data-step="contact"]').click();
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'card');
    await page.keyboard.press('Escape');
    expect(await contexts(page)).toBe(0);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(hud(page)).toHaveAttribute('data-sound', 'on');
    expect(await contexts(page)).toBe(1);

    // Avec le son : prendre, retourner, reposer.
    await page.locator('[data-step="contact"]').click();
    await sheet(page).getByRole('button', { name: "Retourner l'objet" }).click();
    await page.keyboard.press('Escape');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(hud(page)).toHaveAttribute('data-sound', 'off');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await contexts(page)).toBe(1);
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});

test.describe('l’indication', () => {
  test('dit comment retourner l’objet tenu', async ({ page }, testInfo) => {
    const { hint } = getContent('fr').desk;
    const phone = testInfo.project.name === 'telephone';
    await page.goto(at('fr'));
    await waitForScene(page);
    const line = page.locator('#hud p[data-on]');
    await expect(line).toHaveText(phone ? hint.touch : hint.pointer);
    await page.locator('[data-step="dares"]').click();
    await expect(line).toHaveText(phone ? hint.held.touch : hint.held.pointer);
  });

  test('tient dans la largeur de la fenêtre', async ({ page }) => {
    await page.goto(at('fr'));
    await waitForScene(page);
    const width = page.viewportSize()!.width;
    const box = (await page.locator('#hud p[data-on]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
});

test.describe('sur téléphone', () => {
  const portraits = [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
    { width: 412, height: 915 },
  ];

  for (const size of portraits) {
    test(`la feuille du bas tient à l’écran (${size.width}x${size.height})`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'telephone', 'profil téléphone');
      await page.setViewportSize(size);
      // Le coffret a la fiche la plus longue (signes de vie).
      await page.goto(at('fr', 'prendre=chest'));
      await waitForScene(page);
      const box = (await sheet(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      // Au plus 42 % de la hauteur (SHEET.portrait.maxHeight), marge comprise.
      expect(box.y).toBeGreaterThanOrEqual(size.height * (1 - 0.42) - 1);
      // Elle défile, et ses boutons restent à portée.
      const close = sheet(page).getByRole('button', { name: "Reposer l'objet" });
      await expect(close).toBeInViewport();
      await close.tap();
      await expect(sheet(page)).toHaveAttribute('data-open', 'false');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    });
  }

  test('à l’horizontale, la fiche reste à droite sous les commandes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'telephone', 'profil téléphone');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(at('fr', 'prendre=postit'));
    await waitForScene(page);
    const box = (await sheet(page).boundingBox())!;
    // La largeur hors rotation (la boîte englobante grandit avec la légère rotation).
    const width = await sheet(page).evaluate((element) => (element as HTMLElement).offsetWidth);
    expect(width).toBeLessThanOrEqual(Math.min(400, 844 * 0.36) + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    const sound = (await page.getByRole('button', { name: 'Son' }).boundingBox())!;
    expect(sound.y + sound.height).toBeLessThanOrEqual(box.y);
    // Le bouton « Son » ne chevauche aucune autre commande.
    const controls = page.getByRole('navigation', { name: 'Commandes' }).locator('a, button');
    for (const other of await controls.all()) {
      if ((await other.getAttribute('data-sound-toggle')) !== null) continue;
      const b = (await other.boundingBox())!;
      const apart =
        b.x + b.width <= sound.x ||
        sound.x + sound.width <= b.x ||
        b.y + b.height <= sound.y ||
        sound.y + sound.height <= b.y;
      expect(apart).toBe(true);
    }
  });
});
