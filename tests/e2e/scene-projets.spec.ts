import { expect, test, type Page } from '@playwright/test';
import { sampleLifeSigns } from '../../src/lib/life-signs/sample';
import { activityPulse } from '../../src/lib/life-signs/types';

// Les nouveaux objets et le cadrage (partie « objets », étape 4) : le bocal
// de Netherbrain, la baie du Homelab, le coffret qui bat au rythme de ses
// signes de vie, et le bureau entier à l'écran du téléphone (data-offscreen
// sur #hud : ce qui sort du cadre ; data-offscreen-probes sur le canvas : le
// nombre de relevés faits, pour qu'une liste vide vienne d'une mesure ;
// data-desk-share sur le canvas : la part de la hauteur libre entre les
// bandes du HUD que couvre le bureau, qui remplit l'écran en portrait).

/** Part minimale de la hauteur libre couverte par le bureau resserré (0.69 mesuré en 412x915). */
const PORTRAIT_SHARE = 0.65;

const SETTLED = '/fr?t=11000&fige&auto=0&heure=14';

const hud = (page: Page) => page.locator('#hud');
const tag = (page: Page, item: string) => page.locator(`[data-item="${item}"]`);
const canvas = (page: Page) => page.locator('canvas');

async function waitForScene(page: Page) {
  await expect(hud(page)).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/**
 * Un point de l'objet lui-même, dans le canvas : juste sous la pointe de son
 * étiquette, le premier qui n'est couvert par aucune autre étiquette.
 */
async function pointOnItem(page: Page, item: string, from = 6, to = 40) {
  const box = await tag(page, item).boundingBox();
  if (!box) throw new Error(`étiquette invisible : ${item}`);
  const x = box.x + box.width / 2;
  const top = box.y + box.height;
  const dy = await page.evaluate(
    ({ x, top, from, to }) => {
      for (let d = from; d <= to; d += 2) {
        if (document.elementFromPoint(x, top + d)?.tagName === 'CANVAS') return d;
      }
      return null;
    },
    { x, top, from, to },
  );
  if (dy === null) throw new Error(`objet couvert par une autre étiquette : ${item}`);
  return { x, y: top + dy };
}

/** Attend un relevé de ce qui sort du cadre, fait après l'arrivée. */
async function waitForProbe(page: Page) {
  await expect
    .poll(async () => Number((await canvas(page).getAttribute('data-offscreen-probes')) ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(1);
}

type Region = { x: number; y: number; w: number; h: number };

/** Les pixels d'une région du canvas (fractions de sa taille), HUD masqué. */
async function regionPixels(page: Page, region: Region): Promise<number[]> {
  const png = (
    await canvas(page).screenshot({ style: '#hud { visibility: hidden !important; }' })
  ).toString('base64');
  return page.evaluate(
    async ({ data, region: r }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const scratch = document.createElement('canvas');
      scratch.width = image.width;
      scratch.height = image.height;
      const ctx = scratch.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(
        Math.round(image.width * r.x),
        Math.round(image.height * r.y),
        Math.max(1, Math.round(image.width * r.w)),
        Math.max(1, Math.round(image.height * r.h)),
      ).data;
      return Array.from(pixels);
    },
    { data: png, region },
  );
}

/** L'écart moyen entre deux images de même taille, par composante (0 à 255). */
const meanDifference = (a: number[], b: number[]) => {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) sum += Math.abs(a[i + k]! - (b[i + k] ?? 0));
    count += 3;
  }
  return sum / count;
};

/** Où se tient l'objet présenté sur ordinateur (HELD.landscape : à gauche du centre). */
const HELD_REGION: Region = { x: 0.25, y: 0.3, w: 0.2, h: 0.38 };

test.describe('Netherbrain et Homelab', () => {
  test('portent leur étiquette en français et en anglais', async ({ page }) => {
    test.slow();
    await page.goto(SETTLED);
    await waitForScene(page);
    await expect(tag(page, 'netherbrain')).toHaveText(/2026\s*Netherbrain/);
    await expect(tag(page, 'homelab')).toHaveText(/2026\s*Homelab/);
    await expect(tag(page, 'laptop')).toHaveText(/Pile\s*Compétences/);
    await page.goto('/en?t=11000&fige&auto=0&heure=14');
    await waitForScene(page);
    await expect(tag(page, 'netherbrain')).toHaveText(/2026\s*Netherbrain/);
    await expect(tag(page, 'homelab')).toHaveText(/2026\s*Homelab/);
    await expect(tag(page, 'netherbrain')).toHaveAttribute('data-shown', 'true');
  });

  test('se présentent par la puce des projets et par leur étiquette', async ({ page }) => {
    await page.goto(SETTLED);
    await waitForScene(page);
    await page.getByRole('link', { name: /Netherbrain/ }).click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'netherbrain');
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-presented', '');
    await expect(tag(page, 'homelab')).toHaveAttribute('data-shown', 'true');
    await tag(page, 'homelab').click();
    await expect(hud(page)).toHaveAttribute('data-presented', 'homelab');
  });

  for (const item of ['netherbrain', 'homelab'] as const) {
    test(`${item} se présente d’un clic ou d’un tap sur l’objet`, async ({ page, isMobile }) => {
      await page.goto(SETTLED);
      await waitForScene(page);
      await expect(tag(page, item)).toHaveAttribute('data-shown', 'true');
      // Au téléphone, l'objet est petit : juste sous la pointe de l'étiquette.
      const point = await pointOnItem(page, item, isMobile ? 4 : 24);
      if (isMobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await expect(hud(page)).toHaveAttribute('data-presented', item);
    });
  }

  for (const item of ['netherbrain', 'homelab'] as const) {
    test(`${item} retourné montre son dos peint`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'la place de l’objet tenu est celle de l’ordinateur');
      test.slow();
      // Présenté, l'objet fait son geste (un demi-tour : son dos vient à la
      // caméra) ; ?recto le montre de face. Le dos (l'étiquette du bocal,
      // celles de la baie) ne ressemble pas à la face (le cerveau dans le
      // verre, la façade des équipements) : les deux images diffèrent
      // nettement, pixel à pixel.
      await page.goto(`${SETTLED}&prendre=${item}`);
      await waitForScene(page);
      await expect(hud(page)).toHaveAttribute('data-flipped', 'true');
      await page.waitForTimeout(500);
      const back = await regionPixels(page, HELD_REGION);
      await page.goto(`${SETTLED}&prendre=${item}&recto`);
      await waitForScene(page);
      await expect(hud(page)).toHaveAttribute('data-flipped', 'false');
      await page.waitForTimeout(500);
      const front = await regionPixels(page, HELD_REGION);
      // Mesuré : environ 17 pour le bocal, davantage pour la baie.
      expect(meanDifference(back, front)).toBeGreaterThan(8);
    });
  }
});

test.describe("l'usine", () => {
  test('bat au rythme de ses signes de vie', async ({ page, isMobile }) => {
    test.skip(isMobile, 'un cadrage suffit : la mesure est la même');
    test.slow();
    // Le battement suit activityPulse des signes de vie d'exemple : sous
    // &fige, l'image ne dépend que de T. Au coup (phase 0.08) et au repos
    // (phase 0.6) d'un même battement, les fenêtres et la lueur chaude de
    // l'usine changent : les pixels autour de l'usine se réchauffent.
    const { period } = activityPulse(sampleLifeSigns(Date.now()));
    const at = (phase: number) => Math.round((5 + phase) * period * 1000);
    const region = async (t: number) => {
      await page.goto(`/fr?t=${t}&fige&auto=0&heure=23`);
      await waitForScene(page);
      const point = await pointOnItem(page, 'chest', 50, 80);
      const size = page.viewportSize()!;
      await page.waitForTimeout(400);
      return regionPixels(page, {
        x: (point.x - 110) / size.width,
        y: (point.y - 40) / size.height,
        w: 220 / size.width,
        h: 120 / size.height,
      });
    };
    const beat = await region(at(0.08));
    const still = await region(at(0.6));
    let warmer = 0;
    for (let i = 0; i < beat.length; i += 4) {
      const dr = beat[i]! - still[i]!;
      const db = beat[i + 2]! - still[i + 2]!;
      if (dr > 8 && dr > db + 4) warmer++;
    }
    expect(warmer).toBeGreaterThan(30);
  });
});

test.describe('le cadrage', () => {
  test('garde tout le bureau dans le cadre sur ordinateur', async ({ page, isMobile }) => {
    test.skip(isMobile, 'les téléphones ont leurs propres tests ci-dessous');
    await page.goto(SETTLED);
    await waitForScene(page);
    await waitForProbe(page);
    await expect(hud(page)).toHaveAttribute('data-offscreen', '');
  });

  const PHONES = [
    { name: 'en portrait (390x844)', width: 390, height: 844 },
    { name: 'en portrait (360x740)', width: 360, height: 740 },
    { name: 'en portrait (412x915)', width: 412, height: 915 },
    { name: 'en paysage (844x390)', width: 844, height: 390 },
  ] as const;

  for (const { name, width, height } of PHONES) {
    test.describe(`sur téléphone ${name}`, () => {
      test.use({ viewport: { width, height } });

      test('garde tout le bureau dans le cadre, coffret et micro compris', async ({
        page,
        isMobile,
      }) => {
        test.skip(!isMobile, 'profil téléphone seulement');
        await page.goto(SETTLED);
        await waitForScene(page);
        await waitForProbe(page);
        await expect(hud(page)).toHaveAttribute('data-offscreen', '');
        // En portrait, le bureau resserré remplit la hauteur libre : plus de
        // bande de mur vide au-dessus de l'écran.
        if (height > width) {
          const share = Number(await canvas(page).getAttribute('data-desk-share'));
          expect(share).toBeGreaterThan(PORTRAIT_SHARE);
          expect(share).toBeLessThanOrEqual(1.01);
        }
        // L'étiquette du coffret est dans la fenêtre, sous le haut du HUD.
        const chest = await tag(page, 'chest').boundingBox();
        expect(chest).not.toBeNull();
        expect(chest!.x).toBeGreaterThanOrEqual(0);
        expect(chest!.x + chest!.width).toBeLessThanOrEqual(width);
      });
    });
  }

  test('pose le bord avant du bureau juste au-dessus du HUD du bas, en portrait', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'profil téléphone seulement');
    await page.goto(SETTLED);
    await waitForScene(page);
    // Pas de bande vide entre le bureau et le bas de page : l'étiquette la
    // plus basse (le badge n'en a pas : la carte) est dans le tiers du bas
    // de la zone libre.
    const footer = await page.locator('#hud footer').boundingBox();
    const card = await tag(page, 'card').boundingBox();
    expect(footer && card).toBeTruthy();
    expect(footer!.y - (card!.y + card!.height)).toBeLessThan(120);
  });
});
