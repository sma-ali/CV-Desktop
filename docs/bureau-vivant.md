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

## Partie C : ce qui est fait (branche `feat/bureau-vivant-decor-intro`)

### Le kimono

- `decor/kimono.ts` décrit le paquet en pavés, sans three (testé par `kimono.test.ts`) ; `Kimono.tsx` les fusionne. Vu de dessus : trois couches étagées bleu marine (pantalon, veste, manches repliées, un ton plus clair dessus pour lire le pli), le col épais en V sur la moitié gauche avec une couture ton sur ton, et la ceinture crème qui fait le tour du paquet par le travers, nouée sur le dessus, ses deux pans en V vers le visiteur. Aucune marque, aucun écusson, aucune broderie : seules les couleurs de `KIMONO_COLORS`.
- Taille : 1.5 x 1.02, 0.26 de haut (0.33 avec le nœud). Un vrai kimono plié serait deux fois plus grand que le livre : le bureau ne le porterait pas.
- Places : en paysage, `KIMONO` (-2.72, -0.78), à gauche du clavier, sous la lampe, assez loin derrière le livre pour que sa tranche ne le cache pas. En portrait, (-1.3, -1.92), derrière le clavier, entre la lampe, le coffret et le pied de l'écran, remis d'équerre ; il ne chevauche plus le clavier (l'écart de 0.03 du socle est éliminé). Corps : une boîte à son encombrement (`KIMONO_FOOTPRINT`), nœud compris.
- La ceinture est crème (`0xd9d1bf`) et non blanc pur : sous le cône de la lampe, un blanc pur sature.
- Cadrage paysage : `FIXED_EXTENT.edge` suit la corde à sauter et ses poignées (`ROPE_EXTENT`), le morceau du décor le plus à gauche depuis le retrait du micro. La vue ne bouge presque pas (capture 1440x900 comparée à l'œil).

### L'écran de chargement

- `Intro.tsx` et `Intro.module.css`, rendus par le serveur : fond sombre, une ampoule au trait dont le filament chauffe de gauche à droite (`--p`, l'avancement), « Ali Smaani », « Préparation du bureau », et en bas un lien discret « Lire le CV sans attendre » vers la version express. Il couvre tout le bureau, HUD compris ; pendant l'attente, le HUD est `inert` (hors du clavier et des lecteurs d'écran), seul le lien reste au clavier. Le nom n'est pas un titre : le seul `h1` reste celui du HUD.
- Avancement réel (`introProgress`) : le code de la scène (DeskShell), puis `decor/LoadProbe.tsx`, monté dans le décor (Scene.tsx ne change pas) : textures peintes au montage (assets à moitié), polices des textures chargées (assets entier), première image demandée (frame à moitié), deuxième image (shaders : la première a tout compilé), puis `markReady`. Il ne recule jamais. Mesuré sous SwiftShader (build de production, une page seule) : 45 % à 2 s, 65 % à 3.3 s, puis la compilation des shaders bloque la page 16 à 19 s, puis 100 %. Sur une vraie carte graphique, cette compilation prend moins d'une seconde.
- Les animations de l'écran passent par `transform` et `opacity` (le front de chaleur glisse par deux translations opposées, la lueur et le filament froid respirent sur leurs propres calques) : le navigateur les joue même quand la compilation occupe la page.
- Scène prête : le filament blanchit et la lueur s'ouvre (0.3 s), l'écran s'efface (0.7 s), puis l'arrivée part du noir et la lampe du bureau s'allume à 0.95 s. Mouvement réduit : ni chaleur animée ni respiration, un fondu de 0.4 s. Sous `&fige`, l'écran part d'un coup (les transitions sont gelées).
- Repli : sans JavaScript, la feuille de style le cache (la version express s'affiche, comme avant). Si JavaScript ne démarre jamais (fichiers bloqués), il s'efface de lui-même au bout de 12 s (animation CSS annulée dès l'hydratation) et laisse le HUD du serveur, dont les liens mènent à la version express. Si la scène tarde, `data-fallback="timeout"` montre la version express avec `desk.intro.slow`.
- Le délai : 20 s d'attente onglet visible, page inoccupée (`LOAD_TIMEOUT_MS`, `idleWait`). Un battement toutes les 250 ms cumule le temps qui passe ; un écart de plus d'une seconde entre deux battements veut dire que la page travaillait (montage, compilation) et ne compte pas. Un réseau qui ne livre pas renonce donc après 20 s ; un appareil lent qui compile n'est jamais coupé en plein travail (et le lien reste là). Sous SwiftShader, avec 4 pages à la fois, la scène met jusqu'à 45 s à démarrer : un délai en temps total aurait fait basculer les tests dans le repli. `?attente=ms` règle le délai (0 : jamais).
- Le « Le bureau s'installe » du HUD et son texte `desk.loading` sont retirés. Textes ajoutés (propositions à valider par Ali) : `desk.intro.skip` (« Lire le CV sans attendre », « Read the CV without waiting » : un nom qui ne contient pas « version express », pour ne pas se confondre avec le lien du HUD) et `desk.intro.slow`.

### Tests

- Vitest : `decor/kimono.test.ts` (dans sa forme de collision, bleu marine, ceinture contrastée, lisible de dessus, sans autre couleur, places sans chevauchement), `core/loading.test.ts` (poids, ordre, délai, attente qui compte).
- E2E : `intro.spec.ts` et un test du kimono dans `scene-decor.spec.ts` (sur ordinateur seulement, comme les `?glisse=` de `scene-gestes` : le même moteur sur les deux profils ; sa place en portrait est vérifiée par `kimono.test.ts`).
- Adaptations de `bureau.spec.ts`, dites ici : « basculent vers le bureau anglais » et « vont du bureau à la version express et retour » attendent la scène prête avant de cliquer, puisque l'écran de chargement couvre le HUD jusque-là (avant, ils cliquaient pendant le chargement). « est là sans attendre la 3D » n'a pas changé : avec tous les fichiers JavaScript bloqués, son clic sur une puce attend que l'écran se soit effacé de lui-même (12 s de plus).

## Partie B : ce qui est fait

- Score de désordre (`tidy/disorder.ts`) : par corps visible et déplacé, 0.5 point au prorata de la distance (de 0.4 à 3 unités de sa place), 0.6 point s'il est renversé (plus de 35 degrés), 1 point s'il est tombé ; 6 points font un score de 1. Le bouton paraît à 0.5 et s'en va sous 0.4 (pas de clignotement au seuil). Valeurs proposées, à valider avec Ali : pousser deux ou trois objets ne le fait pas paraître, renverser la moitié du bureau ou en vider un coin par terre, oui. Le score se recalcule quand `places` ou `fallen` changent (le bureau s'est posé, un corps est rentré).
- Retour d'un corps tombé (`tidy/director.ts`, `TidyDirector`) : 2.5 s par terre, puis un trajet en arc de 0.9 s (repris en main, `drive`), un seul à la fois. Il est lâché 0.3 au-dessus de sa place (ou au-dessus de ce qui l'occupe, d'après des sphères englobantes, `tidy/reach.ts`) et s'y pose de lui-même ; posé à moins de 0.15 de sa place, il y est remis exactement (`sendHome`). Tombé sous le plateau, il en sort d'abord par le sol : remonter à travers le plateau lançait en l'air ce qui était posé dessus.
- Rangement : tous les corps déplacés sont repris en main d'un coup (cinématiques, ils ne se poussent plus entre eux), puis rentrent de gauche à droite, un départ toutes les 0.13 s, 0.6 s de trajet chacun, et sont posés exactement chez eux. Un dernier passage remet d'un coup ce qu'un trajet aurait bousculé. Un corps saisi par le visiteur n'est jamais repris ; présenté pendant son retour, il rentre sur-le-champ.
- Mouvement réduit : aucun trajet, chaque corps est remis à sa place aussitôt. Sous `&fige` : le corps tombé reste par terre (le temps est arrêté), et le rangement se fait d'un coup.
- Le bouton (`TidyButton`) : un vrai bouton dans l'ordre du clavier, au milieu de l'écran (sous l'indication sur grand écran). Pendant le rangement, il dit « Je range le bureau. » (`aria-disabled`), puis « Bureau rangé. » 2.2 s, puis s'en va ; s'il avait le focus, le focus revient d'où il venait (ou sur la première puce). Chaque étape s'annonce dans sa région `role="status"` (`data-tidy-status`). Attribut `data-tidy` : `offer`, `tidying`, `done`.
- `?desordre` : tous les corps lancés en l'air au-dessus d'une grille qui déborde du plateau, penchés au hasard (graine fixe), puis lâchés. Sous `&fige`, le résultat est toujours le même.
- Retouches hors de la partie, d'une ligne ou presque : `takeOver` coupe la CCD du corps repris en main et `handBack` / `sendHome` la rétablissent (`physics/world.ts`) : avec elle, un grand `drive` s'arrêtait au premier contact. `?desordre` ajoute `scatter` à `TestParams` et à `SceneSettings`.
- Tests : `tidy/*.test.ts` (score, trajet, sortie de sous le plateau, retour et rangement avec le vrai Rapier), `tests/e2e/scene-rangement.spec.ts`.
