import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent, type Locale } from '../../src/content';
import { SHEET_ORDER } from '../../src/scene/core/ids';
import { forbiddenPattern } from '../private-terms';

// Les fiches (partie « fiches », étape 4) : le bristol de l'objet présenté
// (#sheet, data-open et data-sheet), Préc. / Suiv., Page précédente et
// Page suivante (les flèches tournent l'objet présenté depuis l'étape 6,
// voir scene-rotation.spec.ts), Retourner,
// focus, signes de vie du coffret, le son ouvert par défaut (data-sound sur
// #hud), l'indication du HUD, la feuille du bas sur téléphone.

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

// L'usine montre des genres, jamais une chaîne, un compte ni un lien
// (termes privés : tests/private-terms.ts).
const FORBIDDEN = forbiddenPattern(['@', 'https?:']);

test.describe('la fiche', () => {
  test('s’ouvre avec l’objet présenté et se ferme en le reposant', async ({ page }) => {
    await page.goto(at('fr'));
    await waitForScene(page);
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
    await page.getByRole('link', { name: /Netherbrain/ }).click();
    await expect(sheet(page)).toHaveAttribute('data-open', 'true');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'netherbrain');
    await expect(sheet(page).getByRole('heading', { name: 'Netherbrain' })).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Reposer', exact: true }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
  });

  for (const locale of ['fr', 'en'] as const) {
    test(`chaque puce ouvre la bonne fiche (${locale})`, async ({ page }) => {
      // Six présentations de suite : plus de 60 s avec 4 pages sous SwiftShader.
      test.slow();
      const { sheets } = getContent(locale);
      await page.goto(at(locale));
      await waitForScene(page);
      const expected = [
        ['defi-metiers', 'book'],
        ['dares', 'postit'],
        ['netherbrain', 'netherbrain'],
        ['homelab', 'homelab'],
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
        // Plus d'appel au contact dans les fiches : il est en bas à droite.
        await expect(sheet(page).getByRole('link', { name: sheets.ui.contact })).toHaveCount(0);
        // Sur téléphone, la feuille du bas couvre les puces : on repose.
        await page.keyboard.press('Escape');
        await expect(sheet(page)).toHaveAttribute('data-open', 'false');
      }
    });
  }

  test('Préc. / Suiv. et Page préc. / Page suiv. parcourent tous les objets', async ({ page }) => {
    // Tous les objets présentés de suite : près de 60 s avec 4 pages sous SwiftShader.
    test.slow();
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

    await sheet(page).getByRole('button', { name: 'Préc. (objet précédent)', exact: true }).click();
    await expect(sheet(page)).toHaveAttribute('data-sheet', SHEET_ORDER.at(-1)!);

    const back: string[] = [];
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      await page.keyboard.press('PageUp');
      back.push((await sheet(page).getAttribute('data-sheet')) ?? '');
    }
    expect(back).toEqual([...SHEET_ORDER].reverse().slice(1).concat(SHEET_ORDER.at(-1)!));
    await page.keyboard.press('PageDown');
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
    await page.keyboard.press('PageDown');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'headset');
    // Puis le boîtier du CASD, l'autre objet de DARES.
    await page.keyboard.press('PageDown');
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'casd');
    await expect(
      page.getByRole('complementary', { name: getContent('fr').sheets.items.casd.title }),
    ).toBeVisible();
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
    await sheet(page).getByRole('button', { name: 'Reposer', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toHaveAttribute('data-open', 'false');
    await expect(chip).toBeFocused();
  });

  test('la visite automatique ne vole pas le focus', async ({ page }) => {
    await page.goto('/fr?t=11000&heure=14');
    await waitForScene(page);
    const language = page.getByRole('link', { name: 'English' });
    await language.focus();
    await expect(hud(page)).not.toHaveAttribute('data-presented', '', { timeout: 20_000 });
    await expect(sheet(page)).toHaveAttribute('data-open', 'true');
    await expect(language).toBeFocused();
  });

  test('Retourner : la touche R, sans bouton dans la fiche', async ({ page }) => {
    await page.goto(at('fr', 'prendre=badge'));
    await waitForScene(page);
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    // On retourne l'objet d'un clic dessus, ou avec R : plus de bouton.
    await expect(sheet(page).getByRole('button', { name: 'Retourner', exact: true })).toHaveCount(
      0,
    );
    await page.keyboard.press('r');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
    await page.keyboard.press('r');
    await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
    // Ctrl+R reste au navigateur (on ne l'envoie pas : il rechargerait la page).
  });

  test('seules les fiches Netherbrain et Homelab lient un dépôt public', async ({ page }) => {
    await page.goto(at('fr', 'prendre=book'));
    await waitForScene(page);
    const next = sheet(page).getByRole('button', { name: 'Objet suivant' });
    for (let i = 0; i < SHEET_ORDER.length; i++) {
      const id = await sheet(page).getAttribute('data-sheet');
      const repositories: Record<string, string> = {
        netherbrain: 'https://github.com/sma-ali/Netherbrain',
        homelab: 'https://github.com/sma-ali/Homelab-Demo',
      };
      const repository = id ? repositories[id] : undefined;
      if (repository) {
        await expect(sheet(page).locator('a[href*="github"]')).toHaveCount(1);
        await expect(sheet(page).locator(`a[href="${repository}"]`)).toHaveCount(1);
      } else {
        await expect(sheet(page).locator('a[href*="github"]'), id ?? '').toHaveCount(0);
        await expect(sheet(page).locator('[data-repository]'), id ?? '').toHaveCount(0);
      }
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

  test('ses boutons et ses liens font au moins 44 px', async ({ page }) => {
    await page.goto(at('fr', 'prendre=card'));
    await waitForScene(page);
    // Tous les liens, ceux de la méta compris (e-mail, LinkedIn), et les
    // boutons du pied (Préc., Reposer, Suiv.).
    const targets = sheet(page).locator('button, a');
    expect(await targets.count()).toBeGreaterThanOrEqual(5);
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      expect(box!.height, (await target.textContent()) ?? '').toBeGreaterThanOrEqual(44);
      // Le nom vient du texte visible (WCAG 2.5.3) : aucun aria-label ne l'écrase.
      expect(await target.getAttribute('aria-label')).toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("la fiche de l'usine", () => {
  for (const locale of ['fr', 'en'] as const) {
    test(`montre le circuit, les chiffres et les genres, sans rien trahir (${locale})`, async ({
      page,
    }) => {
      const { factory } = getContent(locale).sheets.ui;
      await page.goto(at(locale, 'prendre=chest'));
      await waitForScene(page);
      await expect(sheet(page)).toHaveAttribute('data-sheet', 'chest');
      const block = sheet(page).locator('[data-factory]');
      await expect(block).toBeVisible();
      const status = ((await block.locator('[data-factory-status]').textContent()) ?? '').replace(
        /\s+/g,
        ' ',
      );
      // L'exemple est recalé sur l'heure du visiteur : dernière vidéo le jour même.
      expect(status).toBe(
        locale === 'fr' ? "En marche | dernière vidéo aujourd'hui" : 'Running | last video today',
      );
      await expect(block).toContainText(factory.sample);

      // Le circuit : une étape par onglet, la première ouverte ; les flèches
      // et le clic passent d'une étape à l'autre et montrent ce qui s'y passe.
      const steps = block.getByRole('tablist', { name: factory.circuitLabel }).getByRole('tab');
      await expect(steps).toHaveText(factory.circuit.map((step) => step.label));
      await expect(steps.first()).toHaveAttribute('aria-selected', 'true');
      const stepPanel = block.locator('[data-step-panel]');
      await expect(stepPanel).toHaveText(factory.circuit[0]!.detail);
      await steps.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(steps.nth(1)).toBeFocused();
      await expect(stepPanel).toHaveText(factory.circuit[1]!.detail);
      await steps.nth(2).click();
      await expect(steps.nth(2)).toHaveAttribute('aria-selected', 'true');
      await expect(stepPanel).toHaveText(factory.circuit[2]!.detail);
      await page.keyboard.press('End');
      await expect(stepPanel).toHaveText(factory.circuit[4]!.detail);
      await expect(block).toContainText(factory.figures.views);
      await expect(block.locator('[data-factory-since]')).toHaveText(
        locale === 'fr' ? /^depuis \p{L}+ \d{4}$/u : /^since \p{L}+ \d{4}$/u,
      );

      // Un seul graphique, global, sur 14 jours.
      const chart = block.getByRole('img');
      await expect(chart).toHaveCount(1);
      await expect(chart).toHaveAttribute(
        'aria-label',
        /6, 9, 7, 8, 5, 10, 8, 7, 9, 6, 8, 11, 7, 8/,
      );
      await expect(chart.locator('i')).toHaveCount(14);

      // Un onglet par genre ; les flèches passent de l'un à l'autre.
      const tabs = block.getByRole('tablist', { name: factory.tabsLabel }).getByRole('tab');
      await expect(tabs).toHaveCount(4);
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      const panel = block.locator('[data-panel]');
      await expect(panel).toContainText(factory.genres.fantasy.title);
      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(panel).toContainText(factory.genres.philosophy.title);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
      await expect(panel).toContainText(factory.genres.quiz.title);
      await tabs.nth(2).click();
      await expect(panel).toContainText(factory.genres.marbles.title);
      // Aucun chiffre ni graphique par genre.
      await expect(panel.getByRole('img')).toHaveCount(0);
      expect(await panel.innerText()).not.toMatch(/\d\s*%|\d{2,}/);

      // Aucune chaîne, aucun compte, aucun lien.
      const text = await sheet(page).innerText();
      expect(text).not.toMatch(FORBIDDEN);
      await expect(block.locator('a')).toHaveCount(0);
    });
  }
});

test.describe('le son', () => {
  test.beforeEach(async ({ page }) => {
    // Compte les AudioContext créés : aucun avant le premier geste du visiteur.
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

  test('est ouvert dès l’arrivée, avec un seul contexte audio, sans erreur', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(at('fr'));
    await waitForScene(page);
    // Ouvert, sans bouton pour le couper.
    await expect(hud(page)).toHaveAttribute('data-sound', 'on');
    await expect(page.getByRole('button', { name: /^(Son|Sound)$/ })).toHaveCount(0);
    // Le contexte audio se crée dès l'arrivée ; le navigateur le relance au
    // premier geste s'il le tenait en pause.
    expect(await contexts(page)).toBe(1);

    // Prendre, retourner, reposer.
    await page.locator('[data-step="contact"]').click();
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'card');
    expect(await contexts(page)).toBe(1);
    await page.keyboard.press('r');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    // Un seul contexte pour toute la visite.
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
      const close = sheet(page).getByRole('button', { name: 'Reposer', exact: true });
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
    const language = (await page.getByRole('link', { name: 'English' }).boundingBox())!;
    expect(language.y + language.height).toBeLessThanOrEqual(box.y);
  });
});
