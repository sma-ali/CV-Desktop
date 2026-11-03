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

| Adresse              | Ce qui s'affiche                                                                        |
| -------------------- | --------------------------------------------------------------------------------------- |
| `/`                  | redirige vers `/fr` ou `/en` selon la langue du navigateur (`Accept-Language`)          |
| `/fr`, `/en`         | le bureau en 3D, avec son HUD ; sans WebGL ni JavaScript, la version express à la place |
| `/fr/express`        | la version express : le CV en une page, en français, imprimable sur une page A4         |
| `/en/express`        | la même en anglais, chacune avec un lien « Revenir au bureau »                          |
| `/api/contact`       | POST du formulaire de contact (JSON, ou formulaire HTML sans JavaScript)                |
| `/api/signes-de-vie` | GET des signes de vie du coffret (JSON public validé, ou données d'exemple)             |

Un navigateur sans langue reconnue, ou sans en-tête `Accept-Language`, arrive en français. Le site sert aussi `/sitemap.xml`, `/robots.txt` et une image de partage par langue (`/fr/express/opengraph-image`).

## Variables d'environnement

Aucune n'est nécessaire pour lancer le site : sans elles, le formulaire répond qu'il est indisponible (503) et le coffret affiche ses données d'exemple. La liste est dans [`.env.example`](.env.example) ; le détail dans [docs/routes-serveur.md](docs/routes-serveur.md).

| Variable                                                              | Rôle                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `CONTACT_TO`, `CONTACT_FROM`, `MAILJET_API_KEY`, `MAILJET_API_SECRET` | envoi du formulaire par Mailjet (destinataire, expéditeur validé, clés) |
| `CONTACT_DRY_RUN`                                                     | `1` : le formulaire n'envoie rien et journalise seulement               |
| `CONTACT_RATE_LIMIT_MAX`                                              | envois permis par IP et par 10 minutes (5 par défaut)                   |
| `LIFE_SIGNS_URL`                                                      | adresse https du JSON public des signes de vie                          |

En local, le projet lit son `.env`, puis `~/.config/cles/*.env` (seulement les noms ci-dessus, sans écraser une variable déjà posée ; `CLES_DIR` remplace ce dossier). Sur Vercel, ce sont les variables du projet. Aucune valeur n'est jamais affichée.

## Le formulaire de contact en local

```bash
CONTACT_DRY_RUN=1 npm run dev
```

Le formulaire (version express, section Contact, et fiche de la carte de visite du bureau) n'envoie rien : le terminal affiche « message accepté (dry run) » avec la longueur du message. Sans dry run, il faut les quatre variables de Mailjet ; s'il en manque une, la route répond 503 et le journal nomme les variables manquantes. Le formulaire marche aussi sans JavaScript (redirection 303, message affiché par l'ancre).

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

Le serveur de test tourne en dry run, avec `CLES_DIR=/nonexistent` (jamais de vraies clés) et une limite de débit relevée ; les tests unitaires fixent aussi `CLES_DIR=/nonexistent`. Les tests lancent le site sur le port 3100 ; `E2E_PORT=3411 npm run test:e2e` en choisit un autre (utile pour plusieurs worktrees à la fois). Chromium dessine la 3D sans carte graphique (SwiftShader).

## Le bureau en 3D

La page `/fr` (ou `/en`) s'ouvre sur un écran de chargement rendu par le serveur : une ampoule dont le filament chauffe au rythme du chargement réel (code de la scène, textures, shaders, première image), « Ali Smaani » et « Préparation du bureau ». La scène React Three Fiber arrive dans un fichier JavaScript à part ; quand elle est prête, l'écran s'efface et l'arrivée commence (la lampe s'allume, le code se tape à l'écran, la caméra monte), puis une visite automatique présente les objets du CV un à un. Si la scène tarde (20 s de page inoccupée), la version express prend sa place.

Un clic sur un objet, sur son étiquette ou sur une puce du bas de page le soulève devant la caméra et ouvre sa fiche (Préc. / Suiv., Page précédente et Page suivante). On fait tourner l'objet tenu dans tous les sens en le glissant (souris ou doigt, avec un peu d'élan), ou avec les flèches du clavier, et « Remettre droit » (touche Début) le redresse ; un clic sur l'objet tenu, le bouton « Retourner » ou la touche R le retourne ; Échap, « Reposer » ou un clic ailleurs le repose.

Tout le bureau est physique (Rapier, chargé après l'arrivée) : objets du CV et décor se font glisser et lancer, à la souris comme au doigt, se renversent, s'empilent et tombent du plateau ; un objet tombé revient seul à sa place quelques secondes plus tard. Quand le bureau est trop en désordre, un bouton propose « Oulala, vous avez tout cassé. Je range pour vous ? » : chaque objet rentre chez lui, l'un après l'autre. « Rejouer » remet tout en place et relance l'arrivée. Le bouton « Son » ouvre le son (synthétisé, coupé par défaut). Le sélecteur en bas à droite change la lumière (matin, après-midi, soir, nuit). Avec `prefers-reduced-motion`, l'écran de chargement s'efface en simple fondu, la scène arrive posée, sans visite, sans élan ni trajet : tout revient à sa place d'un coup. Sans WebGL ou sans JavaScript, la version express s'affiche à la place.

Paramètres de test, à ajouter à l'adresse du bureau :

| Paramètre              | Effet                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `?t=11000`             | saute à 11 s de l'arrivée (en millisecondes) ; le moteur physique se charge dès qu'elle est posée      |
| `&fige`                | gèle l'horloge et le monde physique (il n'avance que pendant un glisser, puis se pose d'un coup)       |
| `?heure=14`            | heure du visiteur (choisit l'ambiance)                                                                 |
| `?ambiance=night`      | force une ambiance (`morning`, `afternoon`, `evening`, `night`)                                        |
| `?auto=0`              | pas de visite automatique                                                                              |
| `?reduit`              | mouvement réduit                                                                                       |
| `?prendre=book`        | présente un objet d'office (`book`, `postit`, `netherbrain`, `chest`, `monitor`...)                    |
| `&recto`               | avec `?prendre=`, l'objet reste à l'endroit (sans son geste)                                           |
| `&tourne=0.6,1.2`      | avec `?prendre=`, tourne l'objet présenté (radians : horizontal, vertical)                             |
| `?glisse`              | glisse le portable sur la carte ; `?glisse=mug:1.5,-0.25` un autre, `?glisse=book:-9,0` le fait tomber |
| `?desordre`            | lance tout le bureau en l'air dès que le moteur est prêt (bouton de rangement)                         |
| `?attente=1500`        | délai avant la version express si la scène tarde (ms ; `0` : jamais)                                   |
| `?noshadow`, `?nopost` | sans ombres, sans post-traitement                                                                      |

Par exemple http://localhost:3000/fr?t=11000&fige&auto=0&heure=23 montre le bureau posé, de nuit. L'état de la scène est exposé sur `#hud` (`data-ready`, `data-phase`, `data-mood`, `data-presented`, `data-flipped`, `data-turned`, `data-physics`, `data-places`, `data-fallen`, `data-disorder`, `data-tidying`...) pour les tests. Architecture, contrat entre les parties et calage : [docs/scene-3d.md](docs/scene-3d.md) ; gestes, fiches, son et signes de vie : [docs/gestes.md](docs/gestes.md) ; moteur physique, rotation libre, rangement, décor et écran de chargement : [docs/bureau-vivant.md](docs/bureau-vivant.md).

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
- `src/components/desk/` : le HUD, la fiche de l'objet tenu, la synthèse des sons, le grain, le repli, l'écran de chargement et le bouton de rangement.
- `src/lib/life-signs/` : les signes de vie du coffret, lus par le serveur dans un JSON public (validé, avec repli sur des données d'exemple) et formatés en FR et EN.
- `src/app/api/` : les routes serveur, `contact` et `signes-de-vie` ; `src/lib/contact/` porte le traitement du formulaire (règles, limite de débit, envoi), `src/lib/env/` la lecture des variables du serveur, `src/components/contact/` le formulaire. Contrat : [docs/routes-serveur.md](docs/routes-serveur.md).
- `src/scene/` : la scène React Three Fiber, chargée à part. `core/` (Canvas, horloge, store, constantes), `decor/` (pièce, lampe, clavier, décor perso, sonde du chargement), `items/` (écran et objets du CV, étiquettes, présentation), `physics/` (moteur Rapier, chargé à part), `gestures/` (hub des gestes, glisser), `rotation/` (rotation libre de l'objet tenu), `tidy/` (désordre, retour des objets tombés, rangement) et `stage/` (lumières, ciel, caméra, visite automatique, post-traitement). Architecture et contrat : [docs/scene-3d.md](docs/scene-3d.md).
- `scripts/capture.mjs` : capture d'une page avec la 3D.
- `src/app/[locale]/express/` : la page de la version express, ses métadonnées et son image de partage, générées au build pour chaque langue.
- `src/app/` : `sitemap.ts`, `robots.ts` et l'icône du site.
- `src/components/express/` : le CV en HTML (composant serveur réutilisable, il servira aussi de repli sans WebGL) et le bouton « Imprimer ».
- `src/lib/` : fonctions pures testées par Vitest (choix de la langue, dates, données structurées JSON-LD, métadonnées, adresse du site).
- `src/proxy.ts` : choix de la langue à la racine, en un seul saut.
- `next.config.ts` : en-têtes de sécurité (CSP, HSTS, anti-iframe).
- `tests/unit/` : vérifications sur tout le dépôt (aucun tiret cadratin), sitemap et robots.
- `tests/e2e/` : parcours Playwright sur le build de production (`bureau.spec.ts` pour le socle, `scene-*.spec.ts` pour chaque partie de la scène, `parcours.spec.ts` pour les parcours complets du visiteur, `contact*.spec.ts` et `signes.spec.ts` pour les routes serveur).
- `prototype/` : le prototype validé du bureau en Three.js, référence visuelle du site.

## Pile

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, zod, CSS Modules, polices Fraunces, IBM Plex Mono et Caveat auto-hébergées (`next/font`, et `@fontsource` pour l'image de partage), Three.js, React Three Fiber, drei, postprocessing, Rapier (`@react-three/rapier`) et zustand pour la 3D, Vitest, Playwright avec axe (`@axe-core/playwright`), ESLint, Prettier, GitHub Actions.
