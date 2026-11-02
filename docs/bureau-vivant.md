# Étape 6 : le bureau vivant

Le bureau devient un vrai terrain de jeu : tout ce qui est posé dessus bouge (objets du CV et décor), on le glisse, on le lance, il bascule, s'empile, tombe du plateau. L'objet présenté se tourne dans tous les sens. Un bouton propose de tout ranger quand le bureau est sens dessus dessous. Le décor change (sans matériel de stream ni gants, avec un kimono plié et sa ceinture), et l'arrivée commence par un vrai écran de chargement.

Ce document est le contrat de l'étape : ce que le socle a posé (branche `feat/bureau-vivant`), et ce que font les trois parties menées en parallèle, chacune dans son worktree et ses fichiers.

## Le socle (fait)

### Le moteur physique

- Paquets : `@react-three/rapier` 2.2.0 (compatible React 19, React Three Fiber 9, three 0.159 et plus) et `@dimforge/rapier3d-compat` 0.19.2, en versions exactes. La version « compat » embarque son WebAssembly en base64 : pas de fichier `.wasm` à servir.
- CSP : `script-src` gagne `'wasm-unsafe-eval'`, qui autorise seulement la compilation de WebAssembly (pas `eval` ni `new Function`). Testé dans `tests/e2e/securite.spec.ts`.
- Chargement à part : `physics/PhysicsGate.tsx` importe `PhysicsLayer` (et Rapier avec) dans son propre fichier JavaScript, quand l'arrivée est posée (`phase === 'settled'`), ou plus tôt au premier appui sur un corps. État dans `store.physics` : `'off' | 'loading' | 'ready' | 'failed'` (`data-physics` sur `#hud`). Si Rapier échoue, le bureau reste statique et tout le reste marche (présentation, fiches).
- `physics/world.ts`, `DeskPhysics` : un monde Rapier piloté à la main, pas fixe de 1/60 s, au plus 4 pas par image (`FIXED_STEP`, `MAX_STEPS_PER_FRAME`). `<Physics paused>` ne sert qu'à charger le WebAssembly ; le monde avance dans `PhysicsLayer`, à `PHYSICS_PRIORITY`. Gravité forte (`GRAVITY` 60) : à l'échelle du bureau, les chutes restent vives.
- Corps : `BODY_IDS` (`core/ids.ts`) = les 8 objets du CV (`ITEM_BODY_IDS`, casque compris) et les 12 morceaux du décor (`DECOR_BODY_IDS` : tasse, pavé, clavier, souris, lampe, plante, mangas, renard, voyageur, corde, bandes, kimono). Formes simples (boîtes, cylindres, capsules, sphères) : objets du CV dans `physics/shapes.ts` (`ITEM_BODY_SPECS`), décor dans `decor/colliders.ts` (`DECOR_BODY_SPECS`).
- Fixe : plateau (au format), sol, mur, barrières invisibles autour de la pièce, plafond, l'écran (pied, cou, dalle) avec son post-it, et le support du casque. Le casque, lui, est un corps accroché au support : endormi, il ne bouge que si on le prend ou qu'on le heurte.
- Au repos, tout dort à sa place d'origine : rien ne bouge sans geste. `store.desk[id]` porte la pose complète de chaque corps (`x, y, z, ry, qx, qy, qz, qw, moved, fallen, hidden`) ; `DeskBody`, `DecorPiece`, `CardPile` et `usePresentation` la dessinent.
- Glisser : le corps saisi (gravité coupée) suit le point visé par une commande en vitesse, à une hauteur qui passe au-dessus de ce qu'il survole (`GRAB.lift`), et se redresse vers son cap de départ. Il pousse ce qu'il heurte, monte dessus, s'y pose. Au lâcher, il garde son élan (plafonné à `GRAB.maxThrow`), sauf en mouvement réduit.
- Présentation : le corps présenté sort du monde (ni collisions ni pose écrite) tant qu'il est en main ou en route, puis y revient endormi à sa place de repos.
- Tombé : un corps sous `FALLEN_Y` (-0.6) est « tombé » (`fallen`, `data-fallen`). Il reste par terre tant que la partie B ne le ramène pas.
- Changement d'orientation (paysage et portrait) : tout revient à sa place d'origine du nouveau format.
- Pour que le bureau se pose vite (et calcule peu sur téléphone) : un corps presque immobile pendant 0.4 s s'endort (`CALM`), les cylindres sont des prismes à 10 côtés (couchés, ils ne roulent pas sans fin), et un amortissement angulaire fort tient lieu de résistance au roulement.
- En portrait, le casque et son support sont décalés de 0.15 vers la droite (`HEADSET_PORTRAIT.x` 3.5) : un écouteur entrait dans la dalle de l'écran.
- `data-penetration` sur le canvas : la plus grande profondeur de contact entre deux corps quand le bureau se pose (test E2E, sous 0.05).

### Le store (`core/store.ts`) : champs et actions de l'étape

| Champ                                  | Qui écrit        | Qui lit                        | Sens                                                       |
| -------------------------------------- | ---------------- | ------------------------------ | ---------------------------------------------------------- |
| `desk[id]`                             | socle (moteur)   | tous                           | pose complète de chaque corps                              |
| `places`, `fallen`                     | socle (au repos) | HUD, tests                     | corps déplacés (`data-places`), tombés (`data-fallen`)     |
| `physics`                              | socle            | B, tests                       | état du moteur                                             |
| `heldSpin` (mutable, pas d'abonnement) | A                | `usePresentation`              | rotation libre ajoutée à l'orientation de l'objet présenté |
| `heldTurned` / `setHeldTurned`         | A                | `UprightButton`, `data-turned` | le visiteur a tourné l'objet présenté                      |
| `uprightRequests` / `requestUpright()` | bouton, clavier  | A                              | compteur : « Remettre droit » demandé                      |
| `disorder` / `setDisorder`             | B                | `TidyButton`, `data-disorder`  | score de désordre, de 0 à 1                                |
| `tidyRequests` / `requestTidy()`       | `TidyButton`     | B                              | compteur : rangement demandé                               |
| `tidying` / `setTidying`               | B                | HUD, `data-tidying`            | rangement en cours                                         |
| `load` / `setLoad(step, value)`        | socle, C         | `Intro`                        | progression réelle du chargement                           |

`heldSpin` repart de l'identité quand un autre objet est présenté, quand l'objet est reposé, quand la visite automatique reprend et à Rejouer. Rejouer remet aussi `fallen`, `disorder`, `tidying` et `heldTurned` à zéro, et tout le bureau à sa place.

### Le pilotage du moteur pour les parties (`gestureHub(store).physics`)

`PhysicsControl` (`physics/world.ts`), null tant que le moteur n'est pas prêt :

- `grab`, `aim`, `release` : le glisser (socle seulement) ;
- `isAwake(id)` : le corps bouge encore ;
- `takeOver(id)` : le corps est repris en main (cinématique), sans effet sur le corps glissé ou présenté ;
- `drive(id, pose)` : pose un corps repris en main (place, hauteur, orientation complète) ;
- `handBack(id, asleep)` : rend le corps au monde, endormi sur place ou non ;
- `sendHome(id)` : remet aussitôt un corps à sa place d'origine, endormi (mouvement réduit).

`homePose(id, portrait)` et `homePlace(id, portrait)` (`core/bodies.ts`) donnent la place d'origine de chaque corps.

### Priorités des `useFrame` (`gestures/priorities.ts`)

`GESTURES_PRIORITY` -14, `TIDY_PRIORITY` -14 (B), `PHYSICS_PRIORITY` -13, `ROTATION_PRIORITY` -12 (A), puis les objets (-11, -10).

### Points d'accroche déjà montés

- A : `src/scene/rotation/HeldRotation.tsx` (dans `Scene.tsx`), `src/components/desk/UprightButton.tsx` (dans la fiche, quand l'objet se retourne), `press.held` dans le hub (l'appui a commencé sur l'objet présenté, `claimHeld`).
- B : `src/scene/tidy/Tidy.tsx` (dans `Scene.tsx`), `src/components/desk/TidyButton.tsx` (dans le HUD).
- C : `src/components/desk/Intro.tsx` (dans `DeskShell`, reçoit `name`, `texts`, `done`), `src/scene/decor/Kimono.tsx` (kimono provisoire, boîtes), `src/scene/core/loading.ts`.
- Textes, déjà dans le contenu FR et EN (à retoucher si besoin, propriété de la partie concernée) : `desk.tidy` (offer, tidying, done), `desk.intro.preparing`, `ui.upright` des fiches, `hint.held`.

## Les trois parties

Chaque partie part de `feat/bureau-vivant`, dans son worktree, sur sa branche (`feat/bureau-rotation`, `feat/bureau-rangement`, `feat/bureau-decor`), et ne touche que ses fichiers. Une modification hors de ses fichiers (socle compris) se signale dans son compte rendu au lieu de se faire en silence ; une retouche d'une ligne dans un fichier partagé est permise si elle est nécessaire et dite.

### A : la rotation libre de l'objet présenté

- Glisser sur l'objet présenté, à la souris ou au doigt : rotation façon trackball, avec un peu d'inertie au lâcher. L'objet garde l'orientation qu'on lui a donnée.
- Un clic sans glisser (moins de 7 px, `DRAG_THRESHOLD`), la touche R ou le bouton « Retourner » le retournent toujours.
- Flèches du clavier : elles tournent l'objet présenté. Le passage à l'objet voisin (aujourd'hui sur les flèches, `Sheet.tsx`) passe sur d'autres touches (par exemple Page précédente et Page suivante) ; adapter `tests/e2e/scene-fiches.spec.ts` et le dire.
- « Remettre droit » : bouton de la fiche, visible quand `heldTurned`, qui ramène l'objet à son orientation de présentation (animé, immédiat en mouvement réduit).
- Mouvement réduit : pas d'inertie.
- Fichiers : `src/scene/rotation/**`, `src/components/desk/UprightButton.*`, `src/components/desk/Sheet.tsx` (touches), `tests/e2e/scene-rotation.spec.ts`. Le texte `hint.held` et `ui.upright` si besoin.
- E2E : `E2E_PORT=3611` ; `next dev` sur 3601.
- Paramètre de test proposé : `?tourne=x,y` (angles en radians appliqués à l'objet présenté), documenté dans `docs/scene-3d.md`.

### B : le désordre, la chute et le rangement

- Score de désordre (0 à 1) d'après l'écart de chaque corps à sa place d'origine (distance, angle, tombé), recalculé quand le bureau se pose, écrit par `setDisorder`.
- Un corps tombé revient en douceur à sa place après un délai (quelques secondes), un par un, par `takeOver` puis `drive` puis `handBack(id, true)`.
- Au-delà d'un seuil, `TidyButton` apparaît : « Oulala, vous avez tout cassé. Je range pour vous ? » (EN « Oops, you broke everything. Shall I tidy up? »). Au clic : `requestTidy()`, puis les objets reviennent l'un après l'autre (`tidying` vrai pendant ce temps), puis « Bureau rangé. » s'annonce (région `aria-live`).
- Mouvement réduit : pas d'animation, retour immédiat (`sendHome`).
- Rejouer remet toujours tout à zéro (socle).
- Fichiers : `src/scene/tidy/**`, `src/components/desk/TidyButton.*` (et son style), `tests/e2e/scene-rangement.spec.ts`.
- E2E : `E2E_PORT=3612` ; `next dev` sur 3602.
- Pour les tests : `?glisse=book:-9,0` fait tomber le livre ; un paramètre proposé `?desordre` (tout le bureau dispersé au démarrage) se documente dans `docs/scene-3d.md`.

### C : le décor et l'intro

- Décor : le matériel de stream et les gants sont déjà retirés par le socle. Reste à dessiner le kimono de grappling plié (bleu marine, ceinture blanche nouée, sans marque, low poly, lisible vu de dessus) dans `Kimono.tsx`, puis à revoir la disposition du décor en paysage et en portrait (`decor/layout.ts`), les formes des corps du décor (`decor/colliders.ts`) et les points fixes du cadrage paysage (`FIXED_EXTENT.edge` dans `stage/framing.ts`, aujourd'hui calés sur l'ancien micro pour garder le cadrage identique).
- Intro : rien de visible au tout début. Un écran de chargement rendu par le serveur (CSS seulement, aucun JavaScript nécessaire pour l'afficher) : fond sombre, le filament de la lampe qui chauffe sert de barre de progression, « Ali Smaani » et « Préparation du bureau ». Progression réelle : `loadProgress(store.load)` (`core/loading.ts`) pondère le code de la scène (déjà signalé par `DeskShell`), les textures, la compilation des shaders et la première image ; C pose les appels `setLoad('assets' | 'shaders' | 'frame', ...)` où il faut. Puis fondu, la lampe s'allume et l'arrivée actuelle suit. Mouvement réduit : un simple fondu. Sans JavaScript, sans WebGL ou passé un délai : la version express.
- L'ancien « Le bureau s'installe » du HUD (`loading` de `Hud.tsx`) cède la place à l'intro.
- Fichiers : `src/scene/decor/**`, `src/scene/stage/framing.ts` (points fixes), `src/scene/core/loading.ts`, `src/components/desk/Intro.*`, `DeskShell.tsx`, `Hud.tsx` (le chargement seulement) et `Desk.module.css`, `tests/e2e/scene-decor.spec.ts` et un `tests/e2e/intro.spec.ts`.
- E2E : `E2E_PORT=3613` ; `next dev` sur 3603.

## Paramètres de test

| Paramètre                       | Effet à l'étape 6                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?t=11000`                      | saute l'arrivée ; le moteur se charge dès qu'elle est posée                                                                                                                                                   |
| `&fige`                         | gèle l'horloge et le monde : il n'avance que pendant un glisser (4 pas par image) et se pose d'un coup ensuite                                                                                                |
| `?auto=0`                       | pas de visite automatique                                                                                                                                                                                     |
| `?prendre=card`                 | objet présenté dès l'arrivée                                                                                                                                                                                  |
| `?glisse` / `?glisse=mug:4.9,0` | glisser joué par le moteur (portable vers la carte par défaut), lâché sans élan au but, bloqué ou trop long ; sous `&fige`, joué d'un coup en une image (déterministe, quelle que soit la lenteur des images) |
| `?reduit`                       | mouvement réduit : pas de lancer, pas d'inertie, retours immédiats                                                                                                                                            |

## Rendez-vous

1. Chaque partie part du dernier commit du socle sur `feat/bureau-vivant`.
2. Chaque partie rend sa branche avec `npm run check` vert et sa suite E2E sur son port.
3. Fusion dans `feat/bureau-vivant` dans l'ordre C, puis A, puis B (B dépend des places d'origine et des formes du décor revues par C), puis la suite E2E complète sur le port 3600, puis relecture avec Ali avant `main`.

Conflits attendus : `Hud.tsx` (C pour le chargement, B pour le bouton déjà monté), `Desk.module.css` (B et C), `docs/scene-3d.md` (paramètres de test de A et B). Les tenir petits.

## Ce qui remplace l'étape 4

Le solveur 2D (`gestures/solver.ts`) et la simulation du glisser (`gestures/drag.ts`) sont retirés : la description de `docs/gestes.md` à leur sujet est historique. Ce qui reste valable de l'étape 4 : le hub des gestes, le seuil de 7 px, la présentation, les fiches, le son, le bureau resserré du portrait (décor revu par C).
