# cv_desktop

Le CV d'Ali Smaani en bureau 3D low poly. On arrive sur le plateau d'un bureau vu de haut, et les objets portent le CV : on les prend en main, on les retourne, on les fait glisser. Une version express en HTML donne le même CV en une page.

Destiné à [alismaani.fr](https://alismaani.fr). En construction : l'avancement suit la [feuille de route](docs/feuille-de-route.md).

## Lancer le projet en local

Il faut Node.js 22.12 ou plus récent (24 conseillé, voir `.nvmrc`) et npm.

```bash
npm install
npm run dev
```

Le site répond sur http://localhost:3000 (la racine redirige vers `/fr`, la version anglaise est sur `/en`).

## Vérifier

```bash
npm run check
```

Lance ESLint, Prettier, la vérification des types et les tests unitaires, comme la CI.

Pour les tests de bout en bout, il faut le navigateur de Playwright, à installer une seule fois. `npm run test:e2e` construit ensuite le site et lance les parcours sur le build de production :

```bash
npx playwright install chromium
npm run test:e2e
```

## Scripts

| Commande               | Rôle                                                     |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | serveur de développement                                 |
| `npm run build`        | build de production                                      |
| `npm run start`        | sert le build de production                              |
| `npm run lint`         | ESLint                                                   |
| `npm run format`       | met en forme avec Prettier                               |
| `npm run format:check` | vérifie la mise en forme sans rien changer               |
| `npm run typecheck`    | génère les types des routes puis lance `tsc`             |
| `npm test`             | tests unitaires (Vitest)                                 |
| `npm run test:e2e`     | tests de bout en bout (Playwright, ordinateur et mobile) |
| `npm run check`        | lint, mise en forme, types et tests unitaires            |

## Organisation

- `src/content/` : le contenu du CV en français et en anglais, typé et validé par zod. C'est la seule source des textes : la scène 3D et la version express la lisent toutes les deux. Un contenu invalide fait échouer le build.
- `src/app/[locale]/` : les pages, une par langue (`/fr`, `/en`).
- `next.config.ts` : en-têtes de sécurité (CSP, HSTS, anti-iframe) et redirection de la racine.
- `tests/unit/` : vérifications sur tout le dépôt (aucun tiret cadratin).
- `tests/e2e/` : parcours Playwright sur le build de production.
- `prototype/` : le prototype validé du bureau en Three.js, référence visuelle du site.

## Pile

Next.js (App Router), TypeScript strict, zod, Vitest, Playwright, ESLint, Prettier, GitHub Actions. La 3D (React Three Fiber) arrive à l'étape 3.
