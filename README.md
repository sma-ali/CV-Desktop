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

## Le bureau en 3D

La page `/fr` (ou `/en`) s'affiche tout de suite avec son HUD ; la scène React Three Fiber arrive ensuite, dans un fichier JavaScript à part. On assiste à l'arrivée (la lampe s'allume, le code se tape à l'écran, la caméra monte), puis une visite automatique présente les objets du CV un à un. Un clic sur un objet, sur son étiquette ou sur une puce du bas de page le soulève devant la caméra ; Échap ou un clic ailleurs le repose. Le sélecteur en bas à droite change la lumière (matin, après-midi, soir, nuit), « Rejouer » relance l'arrivée. Avec `prefers-reduced-motion`, la scène arrive posée, sans visite ni animation. Sans WebGL ou sans JavaScript, la version express s'affiche à la place.

Paramètres de test, à ajouter à l'adresse du bureau :

| Paramètre              | Effet                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `?t=11000`             | saute à 11 s de l'arrivée (en millisecondes)                                           |
| `&fige`                | gèle l'horloge ; un objet présenté se pose dans son état final                         |
| `?heure=14`            | heure du visiteur (choisit l'ambiance)                                                 |
| `?ambiance=night`      | force une ambiance (`morning`, `afternoon`, `evening`, `night`)                        |
| `?auto=0`              | pas de visite automatique                                                              |
| `?reduit`              | mouvement réduit                                                                       |
| `?prendre=book`        | présente un objet d'office (`book`, `postit`, `laptop`, `card`, `chest`, `monitor`...) |
| `?noshadow`, `?nopost` | sans ombres, sans post-traitement                                                      |

Par exemple http://localhost:3000/fr?t=11000&fige&auto=0&heure=23 montre le bureau posé, de nuit. L'état de la scène est exposé sur `#hud` (`data-ready`, `data-phase`, `data-mood`, `data-presented`, `data-auto`...) pour les tests. Architecture, contrat entre les parties et calage : [docs/scene-3d.md](docs/scene-3d.md).

## Capturer le bureau

```bash
npm run build && npm run start -- --port 3000
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=14" --out bureau.png
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=23" --size 390x844 --dpr 2 --mobile --out telephone.png
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=14&prendre=book" --out livre.png
```

`scripts/capture.mjs` attend que la scène ait dessiné, puis capture la page (Chromium sans écran, 3D par SwiftShader). Options (`--size`, `--dpr`, `--mobile`, `--reduced`, `--delay`, `--port`) et captures du prototype pour comparer : voir [docs/scene-3d.md](docs/scene-3d.md).

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
- `src/scene/` : la scène React Three Fiber, chargée à part. `core/` (Canvas, horloge, store, constantes), `decor/` (pièce, lampe, clavier, décor perso), `items/` (écran et objets du CV, étiquettes, présentation) et `stage/` (lumières, ciel, caméra, visite automatique, post-traitement). Architecture et contrat : [docs/scene-3d.md](docs/scene-3d.md).
- `scripts/capture.mjs` : capture d'une page avec la 3D.
- `src/app/[locale]/express/` : la page de la version express, ses métadonnées et son image de partage, générées au build pour chaque langue.
- `src/app/` : `sitemap.ts`, `robots.ts` et l'icône du site.
- `src/components/express/` : le CV en HTML (composant serveur réutilisable, il servira aussi de repli sans WebGL) et le bouton « Imprimer ».
- `src/lib/` : fonctions pures testées par Vitest (choix de la langue, dates, données structurées JSON-LD, métadonnées, adresse du site).
- `src/proxy.ts` : choix de la langue à la racine, en un seul saut.
- `next.config.ts` : en-têtes de sécurité (CSP, HSTS, anti-iframe).
- `tests/unit/` : vérifications sur tout le dépôt (aucun tiret cadratin), sitemap et robots.
- `tests/e2e/` : parcours Playwright sur le build de production (`bureau.spec.ts` pour le socle, `scene-*.spec.ts` pour chaque partie de la scène, `parcours.spec.ts` pour les parcours complets du visiteur).
- `prototype/` : le prototype validé du bureau en Three.js, référence visuelle du site.

## Pile

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, zod, CSS Modules, polices Fraunces, IBM Plex Mono et Caveat auto-hébergées (`next/font`, et `@fontsource` pour l'image de partage), Three.js, React Three Fiber, drei, postprocessing et zustand pour la 3D, Vitest, Playwright avec axe (`@axe-core/playwright`), ESLint, Prettier, GitHub Actions.
