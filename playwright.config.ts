import { defineConfig, devices } from '@playwright/test';

// Port dédié aux tests, pour ne pas tomber sur un `npm run dev` déjà lancé.
const port = 3100;
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    // Les en-têtes ne dépendent pas de l'écran : inutile de les retester ici.
    { name: 'telephone', use: { ...devices['Pixel 7'] }, testIgnore: /securite/ },
  ],
  // Les tests tournent sur le build de production, que `npm run test:e2e`
  // reconstruit avant chaque passage. Jamais de serveur réutilisé : il
  // pourrait servir un ancien build.
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `${baseURL}/fr`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
