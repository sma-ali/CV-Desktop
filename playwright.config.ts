import { defineConfig, devices } from '@playwright/test';

// Port dédié aux tests, pour ne pas tomber sur un `npm run dev` déjà lancé.
// E2E_PORT le change, pour que plusieurs worktrees testent en même temps
// (ports réservés : docs/scene-3d.md).
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

// WebGL sans carte graphique : Chromium dessine par SwiftShader (logiciel),
// sur la machine comme en CI. Mêmes arguments que scripts/capture.mjs.
const webgl = {
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // La 3D logicielle est lente : le bureau a besoin de plus de temps.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], ...webgl } },
    // Les en-têtes ne dépendent pas de l'écran : inutile de les retester ici.
    { name: 'telephone', use: { ...devices['Pixel 7'], ...webgl }, testIgnore: /securite/ },
  ],
  // Les tests tournent sur le build de production, que `npm run test:e2e`
  // reconstruit avant chaque passage. Jamais de serveur réutilisé : il
  // pourrait servir un ancien build.
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `${baseURL}/fr/express`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
