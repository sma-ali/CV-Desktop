#!/usr/bin/env node
// Capture d'une page du site (ou du prototype) avec la 3D, dans Chromium sans
// écran (WebGL par SwiftShader, comme les tests de bout en bout).
//
//   node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=14" --out bureau.png
//   node scripts/capture.mjs /fr --port 3401 --size 390x844 --mobile --out tel.png
//   node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0" --out ref.png
//
// Options :
//   <adresse>         chemin du site (/fr), adresse complète, ou fichier local (prototype)
//   --out <fichier>   image PNG à écrire (défaut : capture.png)
//   --port <n>        port du site pour un chemin (défaut : $CAPTURE_PORT, sinon 3000)
//   --params <q>      paramètres ajoutés à l'adresse (« t=11000&fige&auto=0 »)
//   --size <LxH>      taille de la fenêtre (défaut : 1440x900)
//   --dpr <n>         densité de pixels (défaut : 1)
//   --mobile          téléphone : écran tactile, isMobile
//   --theme <t>       light ou dark (prefers-color-scheme, défaut : dark)
//   --reduced         prefers-reduced-motion: reduce
//   --delay <ms>      attente après la scène prête (défaut : 1500)
//   --timeout <ms>    attente maximale de la scène (défaut : 60000)
//
// Sur le site, la capture attend #hud[data-ready="true"] (première image de
// la scène) ; ailleurs, l'événement load. Ensuite, --delay.

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

/** Arguments de Chromium pour WebGL sans carte graphique (partagés avec playwright.config.ts). */
export const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'capture.png' },
    port: { type: 'string', default: process.env.CAPTURE_PORT ?? '3000' },
    params: { type: 'string', default: '' },
    size: { type: 'string', default: '1440x900' },
    dpr: { type: 'string', default: '1' },
    mobile: { type: 'boolean', default: false },
    theme: { type: 'string', default: 'dark' },
    reduced: { type: 'boolean', default: false },
    delay: { type: 'string', default: '1500' },
    timeout: { type: 'string', default: '60000' },
  },
});

const target = positionals[0];
if (!target) {
  console.error('Adresse manquante : node scripts/capture.mjs /fr --out bureau.png');
  process.exit(2);
}

function buildUrl(input) {
  let url;
  if (/^(https?|file):\/\//.test(input)) url = new URL(input);
  else if (input.startsWith('/')) url = new URL(input, `http://localhost:${values.port}`);
  else if (existsSync(input.split('?')[0])) url = pathToFileURL(resolve(input.split('?')[0]));
  else throw new Error(`adresse introuvable : ${input}`);
  // Les paramètres sans valeur (fige, reduit) restent sans « = ».
  const extra = values.params.replace(/^[?&]/, '');
  if (extra) url.search = url.search ? `${url.search}&${extra}` : `?${extra}`;
  return url.toString();
}

const [width, height] = values.size.split('x').map(Number);
if (!width || !height) throw new Error(`taille illisible : ${values.size}`);
const url = buildUrl(target);
const out = resolve(values.out);

const browser = await chromium.launch({ args: WEBGL_ARGS });
try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: Number(values.dpr),
    isMobile: values.mobile,
    hasTouch: values.mobile,
    colorScheme: values.theme === 'light' ? 'light' : 'dark',
    reducedMotion: values.reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: Number(values.timeout) });
  if (await page.locator('#hud').count()) {
    await page
      .locator('#hud[data-ready="true"]')
      .waitFor({ state: 'attached', timeout: Number(values.timeout) });
  }
  await page.waitForTimeout(Number(values.delay));
  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(`${out}  (${width}x${height}, ${url})`);
  if (errors.length) console.warn(`erreurs dans la page :\n  ${errors.join('\n  ')}`);
} finally {
  await browser.close();
}
