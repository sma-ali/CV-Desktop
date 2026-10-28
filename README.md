# cv_desktop

Le CV d'Ali Smaani en bureau 3D low poly. On arrive sur le plateau d'un bureau vu de haut, et les objets portent le CV : on les prend en main, on les retourne, on les fait glisser. Une version express en HTML donne le même CV en une page.

Destiné à [alismaani.fr](https://alismaani.fr). En construction : l'avancement suit la [feuille de route](docs/feuille-de-route.md).

## Lancer le projet en local

Il faut Node.js 22.12 ou plus récent (24 conseillé, voir `.nvmrc`) et npm.

```bash
npm install
npm run dev
```

Le site répond sur http://localhost:3000.

| Adresse       | Ce qui s'affiche                                                                        |
| ------------- | --------------------------------------------------------------------------------------- |
| `/`           | redirige vers `/fr` ou `/en` selon la langue du navigateur (`Accept-Language`)          |
| `/fr`, `/en`  | le bureau en 3D, avec son HUD ; sans WebGL ni JavaScript, la version express à la place |
| `/fr/express` | la version express : le CV en une page, en français, imprimable sur une page A4         |
| `/en/express` | la même en anglais, chacune avec un lien « Revenir au bureau »                          |

Un navigateur sans langue reconnue, ou sans en-tête `Accept-Language`, arrive en français. Le site sert aussi `/sitemap.xml`, `/robots.txt` et une image de partage par langue (`/fr/express/opengraph-image`).

## Vérifier

```bash
npm run check
```

Lance ESLint, Prettier, la vérification des types et les tests unitaires, comme la CI.

Pour les tests de bout en bout, il faut le navigateur de Playwright, à installer une seule fois. `npm run test:e2e` construit ensuite le site et lance les parcours sur le build de production, sur ordinateur et sur téléphone, avec un audit d'accessibilité axe (WCAG 2.2 AA) en thème clair et sombre :

```bash
npx playwright install chromium
npm run test:e2e
```

Les tests lancent le site sur le port 3100 ; `E2E_PORT=3411 npm run test:e2e` en choisit un autre (utile pour plusieurs worktrees à la fois). Chromium dessine la 3D sans carte graphique (SwiftShader).

## Capturer le bureau

```bash
npm run build && npm run start -- --port 3000
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=14" --out bureau.png
```

`scripts/capture.mjs` attend que la scène ait dessiné, puis capture la page. Paramètres de test (`?t=`, `&fige`, `?heure=`, `?auto=0`, `?reduit`, `?prendre=book`) et options : voir [docs/scene-3d.md](docs/scene-3d.md).

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

- `src/content/` : le contenu du CV en français et en anglais, typé et validé par zod, avec les textes de l'interface et ceux du bureau (`src/content/scene/` pour les textes peints dans la 3D). C'est la seule source des textes : la scène 3D et la version express la lisent toutes les deux. Un contenu invalide fait échouer le build.
- `src/app/[locale]/page.tsx` : le bureau, rendu au build pour chaque langue (HUD et repli dans le HTML).
- `src/components/desk/` : le HUD, le grain, le repli et le chargement de la scène.
- `src/scene/` : la scène React Three Fiber, chargée à part. `core/` (Canvas, horloge, store, constantes), `decor/`, `items/` et `stage/`. Architecture et contrat : [docs/scene-3d.md](docs/scene-3d.md).
- `scripts/capture.mjs` : capture d'une page avec la 3D.
- `src/app/[locale]/express/` : la page de la version express, ses métadonnées et son image de partage, générées au build pour chaque langue.
- `src/app/` : `sitemap.ts`, `robots.ts` et l'icône du site.
- `src/components/express/` : le CV en HTML (composant serveur réutilisable, il servira aussi de repli sans WebGL) et le bouton « Imprimer ».
- `src/lib/` : fonctions pures testées par Vitest (choix de la langue, dates, données structurées JSON-LD, métadonnées, adresse du site).
- `src/proxy.ts` : choix de la langue à la racine, en un seul saut.
- `next.config.ts` : en-têtes de sécurité (CSP, HSTS, anti-iframe).
- `tests/unit/` : vérifications sur tout le dépôt (aucun tiret cadratin), sitemap et robots.
- `tests/e2e/` : parcours Playwright sur le build de production.
- `prototype/` : le prototype validé du bureau en Three.js, référence visuelle du site.

## Pile

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, zod, CSS Modules, polices Fraunces, IBM Plex Mono et Caveat auto-hébergées (`next/font`, et `@fontsource` pour l'image de partage), Three.js, React Three Fiber, drei, postprocessing et zustand pour la 3D, Vitest, Playwright avec axe (`@axe-core/playwright`), ESLint, Prettier, GitHub Actions.
