# Architecture

Ce document décrit comment le site est construit : l'arborescence, le flux des données, la scène 3D, les choix techniques et leurs raisons. Le contrat des deux routes serveur est dans [routes-serveur.md](routes-serveur.md).

## Vue d'ensemble

```
src/content/  (FR + EN, validé par zod au build)
   │
   ├─> src/app/[locale]/express/   version express : le CV en HTML, rendu par le serveur
   │
   └─> src/app/[locale]/page.tsx   bureau : HUD et repli dans le HTML
          └─ components/desk/DeskShell.tsx   client : store, scène ou repli
                └─ scene/Scene.tsx            chargé à part (next/dynamic, ssr: false)
                      └─ physics/PhysicsGate  Rapier, chargé encore plus tard

src/app/api/contact          POST du formulaire  ─> lib/contact, lib/env
src/app/api/signes-de-vie    GET du JSON public  ─> lib/life-signs
```

Les pages `/fr`, `/en`, `/fr/express`, `/en/express` et les mentions légales sont rendues au build. La page du bureau se régénère toutes les 10 minutes (`revalidate = 600`) pour reprendre les chiffres de l'usine. `src/proxy.ts` choisit la langue à la racine (`Accept-Language`, français par défaut) en un seul saut.

## Arborescence

| Dossier                      | Contenu                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                   | routes Next (App Router) : bureau, version express, mentions légales, API, `sitemap.ts`, `robots.ts`                                                     |
| `src/content/`               | le seul module de contenu, FR et EN : CV, textes d'interface, fiches (`sheets/`), textes peints (`scene/`), formulaire (`contact/`), mentions (`legal/`) |
| `src/components/desk/`       | la page du bureau côté navigateur : `DeskShell`, repli, grain, synthèse des sons                                                                         |
| `src/components/desk/hud/`   | le HUD : puces des étapes, indication, bouton de rangement, `HudProbe` (état exposé aux tests)                                                           |
| `src/components/desk/sheet/` | la fiche de l'objet tenu, et celle de l'usine (`FactoryPanel`)                                                                                           |
| `src/components/desk/intro/` | l'écran de chargement                                                                                                                                    |
| `src/components/express/`    | le CV en HTML, composant serveur, aussi repli du bureau                                                                                                  |
| `src/components/paper/`      | la page de papier commune à la version express et aux mentions légales                                                                                   |
| `src/components/contact/`    | le formulaire de contact, qui marche aussi sans JavaScript                                                                                               |
| `src/lib/`                   | fonctions pures testées : langue, dates, JSON-LD, métadonnées, adresses, textes du bureau (`desk.ts`)                                                    |
| `src/lib/contact/`           | traitement du formulaire : règles, schéma, limite de débit, envoi                                                                                        |
| `src/lib/env/`               | lecture validée des variables du serveur                                                                                                                 |
| `src/lib/life-signs/`        | signes de vie de l'usine : schéma, lecture, arrondi, rafraîchissement                                                                                    |
| `src/scene/`                 | la scène React Three Fiber, en couches (voir plus bas)                                                                                                   |
| `tests/unit/`                | vérifications sur tout le dépôt (typographie), sitemap et robots                                                                                         |
| `tests/e2e/`                 | parcours Playwright sur le build de production                                                                                                           |
| `scripts/capture.mjs`        | capture d'une page avec la 3D (Chromium sans écran, SwiftShader)                                                                                         |
| `scripts/cv-pdf.mjs`         | le CV en PDF, imprimé depuis la version express vers `public/cv/` (`npm run cv:pdf`)                                                                     |
| `prototype/`                 | le prototype en Three.js d'un seul fichier, référence visuelle                                                                                           |

Les tests unitaires vivent à côté du code (`*.test.ts`) ; `tests/unit/` garde les tests qui portent sur tout le dépôt.

### Les couches de la scène

`src/scene/` est découpé en couches. Une couche n'importe que les couches plus basses : la règle est vérifiée par ESLint (`SCENE_LAYERS` dans `eslint.config.mjs`).

| Couche                  | Rôle                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `core/`                 | Canvas, horloge, store zustand, constantes, identifiants, chargement, outils de géométrie                     |
| `gestures/`             | hub des gestes : appui, clic, glisser, à la souris comme au doigt                                             |
| `decor/`, `items/`      | la pièce, la lampe, le clavier et les objets du décor ; l'écran et les objets du CV, étiquettes, présentation |
| `stage/`                | lumières, ciel, caméra et cadrage, visite automatique, post-traitement, qualité adaptative                    |
| `physics/`, `rotation/` | moteur Rapier ; rotation libre de l'objet tenu                                                                |
| `tidy/`                 | désordre, retour des objets tombés, rangement                                                                 |

Deux autres règles ESLint protègent le navigateur : ni zod ni le module de contenu n'entrent dans `src/scene/**` et `src/components/desk/**` (la scène reçoit ses textes en props, `SceneTexts`), et le HUD, qui part dans le JavaScript initial, n'importe aucun module qui dépend de three.

## Le flux des données

1. `src/content/fr.ts` et `en.ts` portent tous les textes, validés par `contentSchema` au chargement du module : un contenu invalide fait échouer le build. Des tests vérifient que les deux langues ont les mêmes clés, qu'aucun champ n'est vide, et que les textes peints dans la scène correspondent au CV.
2. La version express lit `getContent(locale)` et rend le CV en HTML, imprimable sur une page A4, avec ses métadonnées et ses données structurées (`Person`).
3. La page du bureau lit le même contenu, le réduit à ce dont la scène a besoin (`buildDeskTexts`, `buildSceneTexts` dans `src/lib/desk.ts`) et le passe en props. La version express est aussi rendue dans le HTML du bureau, cachée tant que la scène tourne : c'est le repli.
4. Les signes de vie de l'usine sont lus par le serveur (`getLifeSigns`), validés et arrondis, puis passés à la page ; le navigateur les rafraîchit à l'ouverture de la fiche si la mesure est trop ancienne.

## La scène

### Chargement et arrivée

- Le HTML du serveur contient déjà le HUD, l'écran de chargement et le repli : la page s'affiche tout de suite, et un moteur de recherche lit le CV.
- L'écran de chargement (`components/desk/intro/`) montre un fond noir, le nom et une barre qui avance au rythme du chargement réel (code de la scène, textures, shaders, première image : `core/loading.ts`), avec un rôle `progressbar` pour les lecteurs d'écran.
- three.js n'est pas dans le JavaScript initial : la scène arrive dans son propre fichier (un test E2E le vérifie). L'horloge ne part qu'à la deuxième image, la première servant à compiler les shaders.
- L'arrivée (`core/arrival.ts`, `core/drop.ts`) : dans la pénombre, les objets tombent un à un à leur place, la lampe s'allume en dernier, le code se tape à l'écran, la caméra monte. Elle finit toujours à `SETTLE` (10.4 s). Une visite automatique présente ensuite les objets du CV un à un, jusqu'au premier geste du visiteur.
- Si la scène tarde (20 s de page inoccupée), la version express prend sa place.

### Physique

Tout ce qui est posé sur le bureau est un corps Rapier (`physics/world.ts`) : objets du CV et décor se glissent, se lancent, basculent, s'empilent et tombent. Le monde avance à pas fixe de 1/60 s, piloté à la main. Rapier (environ 800 ko gzip, WebAssembly embarqué) est chargé dans un fichier à part, une fois l'arrivée posée ou au premier appui sur un objet. S'il échoue, le bureau reste statique et tout le reste marche (présentation, fiches). Au repos, tout dort : rien ne bouge sans geste, et rien ne se calcule.

### Gestes

- Un clic sur un objet, son étiquette ou une puce du HUD le soulève devant la caméra et ouvre sa fiche. Un appui de moins de 7 px reste un clic ; au-delà, c'est un glisser.
- L'objet tenu tourne dans tous les sens en le glissant, façon trackball, avec un peu d'élan (`rotation/`), ou avec les flèches. Un clic, le bouton « Retourner » ou la touche R le retourne ; « Remettre droit » (touche Début) le redresse ; Échap, « Reposer » ou un clic ailleurs le repose.
- Un objet tombé du plateau revient seul à sa place après quelques secondes. Quand le bureau est trop en désordre (score de 0 à 1, `tidy/disorder.ts`), un bouton propose de tout ranger : chaque objet rentre chez lui, l'un après l'autre (`tidy/director.ts`).

### Lumière et rendu

La lumière suit l'heure du visiteur, en quatre ambiances (matin, après-midi, soir, nuit) interpolées. Pas de tone mapping : l'étalonnage chaud vient du post-traitement (vignette, courbe, assombrissement autour de l'objet tenu). Ombres PCF, densité de pixels bornée à 2, qualité adaptative, rendu suspendu quand l'onglet est caché. Le son est synthétisé en WebAudio, sans fichier ; l'AudioContext ne se crée qu'au premier geste du visiteur.

### Téléphone

En portrait, le bureau tient en largeur : les objets se rangent sur une zone plus étroite et plus profonde (`BOUNDS_PORTRAIT`, `core/constants.ts` ; places dans `core/views.ts` et `core/decorPlaces.ts`), en rangées autour de l'écran et du clavier, ce qui rapproche la caméra (objets environ 26 % plus gros qu'avec la disposition du paysage). Le décor secondaire est caché, et une étiquette ne se pose jamais sur un objet du CV. Tout le bureau utile reste à l'écran, et un test E2E vérifie qu'aucun objet n'en sort. La fiche devient une feuille en bas de l'écran, et le glisser au doigt ne fait pas défiler la page.

## Choix techniques

- **CSP stricte, sans `unsafe-eval`** (`next.config.ts`) : aucune autre origine que le site, pas de worker en `blob:`. Seul `'wasm-unsafe-eval'` est permis, pour compiler le WebAssembly de Rapier. Conséquence : pas de texte troika (`<Text>` de drei passe par des workers en `blob:`), pas de décodeur Draco ni d'environnement HDR chargé d'un CDN. Tout texte de la scène se peint dans une texture de canvas 2D (`useCanvasTexture`), avec les polices auto-hébergées ; les étiquettes sont une couche DOM maison (`TagLayer`). Un test E2E vérifie la CSP et l'absence d'erreur en console.
- **Repli sans WebGL** : sans JavaScript, `@media (scripting: none)` montre la version express. Sans WebGL (testé avant de charger la scène), si la scène plante (error boundary), perd son contexte ou tarde, `data-fallback` sur la racine affiche la version express à la place. Un seul `h1` visible à la fois.
- **`prefers-reduced-motion`** : l'écran de chargement s'efface en fondu, la scène arrive posée, sans visite, sans élan ni trajet ; un objet rangé revient d'un coup. `?reduit` le simule.
- **Accessibilité** : HUD et fiches au clavier (puces, flèches, R, Début, Échap, Page précédente et Page suivante), focus géré à l'ouverture et à la fermeture d'une fiche, région `role="status"` pour les gestes, onglets ARIA, cibles de 44 px, textes alternatifs sur le canvas et les graphiques. axe (WCAG 2.2 AA) tourne dans les tests E2E, en thème clair et sombre.
- **Serveur jamais dans le navigateur** : `src/lib/env/server.ts` lève une erreur si `window` existe, et aucune variable n'a le préfixe `NEXT_PUBLIC_`.

## L'usine

L'usine est l'objet des projets personnels : une petite halle en brique, une cheminée qui fume, un tapis roulant. Son rythme suit l'activité des 14 derniers jours. Son identifiant interne reste `chest` (`?prendre=chest`).

Sa fiche (`components/desk/sheet/FactoryPanel.tsx`, vue calculée par `factoryView.ts`) montre :

- l'état (« En marche | dernière vidéo aujourd'hui », « hier », « il y a N jours ») en jours UTC, jamais d'heure ;
- le circuit en cinq étapes : création, relecture par agents, validation humaine, publication, statistiques ;
- des chiffres globaux arrondis vers le bas (« plus de N »), le début en mois et année, et un graphique global sur 14 jours (`role="img"`, avec son texte équivalent) ;
- un genre par onglet (récits de fantasy, philosophie, billes 3D, quiz), avec son texte, sans aucun chiffre ni graphique : un genre peut ne compter qu'un projet, et ses chiffres permettraient de le retrouver.

Aucun nom de projet, de compte ni de plateforme, aucun lien : un test le vérifie sur le contenu. Le serveur arrondit tous les chiffres avant de les servir, même si la source envoyait des valeurs exactes (règle dans [routes-serveur.md](routes-serveur.md#arrondi)). Sans source configurée, la fiche affiche des données d'exemple, signalées comme telles.

## Paramètres de test

À ajouter à l'adresse du bureau (`/fr` ou `/en`), lus par `parseTestParams` (`src/scene/core/params.ts`) :

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

Par exemple `/fr?t=11000&fige&auto=0&heure=23` montre le bureau posé, de nuit. L'état de la scène est exposé sur `#hud` (`data-ready`, `data-phase`, `data-mood`, `data-presented`, `data-flipped`, `data-turned`, `data-physics`, `data-places`, `data-fallen`, `data-disorder`, `data-tidying`...) : les tests E2E lisent ces attributs, rien en global.

### Captures

`scripts/capture.mjs` attend que la scène ait dessiné (`#hud[data-ready="true"]`), puis capture la page. Le site doit tourner (`npm run build && npm run start`).

```bash
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=14" --out bureau.png
node scripts/capture.mjs /fr --params "t=11000&fige&auto=0&heure=23" --size 390x844 --dpr 2 --mobile --out telephone.png
node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0&heure=14" --out prototype.png
```

Options : `--size LxH`, `--dpr`, `--mobile`, `--theme light|dark`, `--reduced`, `--delay ms`, `--port` (ou `CAPTURE_PORT`).

## Tests de bout en bout

Playwright tourne sur le build de production, en deux profils (ordinateur et téléphone). Chromium dessine la 3D sans carte graphique (SwiftShader), environ trois images par seconde : la CI découpe donc chaque profil en trois parts, six jobs en parallèle. Les fichiers suivent les parties du site : `bureau.spec.ts` (socle, repli, CSP), `intro.spec.ts`, `scene-*.spec.ts` (décor, objets, gestes, rotation, rangement, fiches, projets), `parcours.spec.ts` (parcours complets), `express.spec.ts`, `contact*.spec.ts` et `signes.spec.ts` (routes serveur), `securite.spec.ts` (en-têtes).
