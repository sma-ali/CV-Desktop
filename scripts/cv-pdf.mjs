#!/usr/bin/env node
// Produit le CV en PDF, en français et en anglais, depuis la version express :
// le même contenu que le site, imprimé par Chromium sur une page A4.
//
//   npm run cv:pdf            build, PDF, puis empreinte
//   npm run cv:pdf -- --no-build   réutilise le build existant
//
// Les fichiers vont dans public/cv/ (servis tels quels par le site). L'empreinte
// (public/cv/empreinte.json) est refaite ensuite par src/lib/cv-pdf.test.ts
// (vitest -u) : ce test échoue tant que le PDF est en retard sur le contenu.

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const LOCALES = ['fr', 'en'];
const OUT_DIR = resolve('public/cv');

const { values } = parseArgs({
  options: {
    'no-build': { type: 'boolean', default: false },
  },
});

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Un port libre, choisi par le système : un vieux serveur resté ouvert sur un
// port fixe servirait un ancien build.
function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => done(String(port)));
    });
    probe.on('error', fail);
  });
}

async function waitFor(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Le serveur démarre encore.
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`le serveur ne répond pas : ${url}`);
}

if (!values['no-build']) run('npx', ['next', 'build']);

const port = await freePort();
const base = `http://localhost:${port}`;
// Comme pour les tests : jamais les vraies clés, jamais d'envoi.
const server = spawn('npx', ['next', 'start', '--port', port], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, CLES_DIR: '/nonexistent', CONTACT_DRY_RUN: '1' },
  detached: true,
});

try {
  server.on('exit', (code) => {
    if (code) console.error(`le serveur s'est arrêté (code ${code})`);
  });
  await waitFor(`${base}/fr/express`, 60_000);
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const locale of LOCALES) {
      await page.goto(`${base}/${locale}/express`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print', colorScheme: 'light' });
      // preferCSSPageSize : le format et les marges viennent du @page du site.
      // tagged : PDF balisé, lisible par un lecteur d'écran.
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
      if (pages !== 1) throw new Error(`le CV ${locale} tient sur ${pages} pages, pas une`);
      const out = resolve(OUT_DIR, `ali-smaani-cv-${locale}.pdf`);
      await writeFile(out, pdf);
      console.log(`${out}  (${Math.round(pdf.length / 1024)} Kio)`);
    }
  } finally {
    await browser.close();
  }
} finally {
  // Le serveur et ses enfants (groupe de processus), s'il tourne encore.
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // Déjà arrêté.
  }
}

run('npx', ['vitest', 'run', '-u', 'src/lib/cv-pdf.test.ts']);
