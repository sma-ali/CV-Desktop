# Le bureau en 3D (étapes 3 et 4)

Ce document fixe le contrat entre les parties de la scène. Le socle a été posé sur la branche `feat/bureau-3d` ; trois parties (décor, objets, mise en scène) se sont construites en parallèle, chacune dans son worktree et dans ses propres fichiers, puis une passe d'assemblage les a fusionnées et a calé le rendu sur le prototype (voir « État à la fin de l'étape 3 »). Le contrat reste valable pour l'étape 4, que [`docs/gestes.md`](gestes.md) complète (gestes, fiches, son, signes de vie, nouveaux objets) et corrige là où il le dit.

Référence visuelle et de comportement : `prototype/bureau-plateau.html` (Three.js r128). On le reproduit et on l'améliore, on ne le recopie pas : ses textes ne sont pas des faits (voir « Textes »).

## Périmètre

Dans l'étape 3 : le port du prototype en composants React Three Fiber avec un Three.js récent. Plateau, mur et fenêtre, lampe, écran au code TypeScript, objets du CV, décor, lumière selon l'heure du visiteur (quatre ambiances et sélecteur), arrivée (carton, lampe qui s'allume, LED du clavier, code tapé à l'écran, montée de caméra), étiquettes des objets, survol, présentation d'un objet (il se soulève devant la caméra, tourne lentement, puis se repose) déclenchée par le mode auto, un clic sur l'objet ou une puce du bas de page, mode auto (visite), Rejouer, `prefers-reduced-motion`, chargement progressif, repli sur la version express. Défauts du prototype à corriger ici : code de l'écran illisible en vue large, micro illisible vu de dessus, coffret petit et sombre.

Hors périmètre (étape 4, voir [`docs/gestes.md`](gestes.md)) : retourner un objet, le faire glisser, les collisions, les fiches (le bristol), le son, les nouveaux objets de Netherbrain et Homelab, les signes de vie du coffret, la correction complète des bords coupés sur téléphone (le cadrage portrait du prototype suffit ici).

## Architecture

```
src/app/[locale]/page.tsx          serveur : lit le contenu, rend le HUD et le repli
└─ components/desk/DeskShell.tsx   client : store, choix scène ou repli, Échap
   ├─ Hud.tsx                      HUD (identité, commandes, puces, heure, ambiances, carton, indication)
   ├─ <section> repli              ExpressCv (serveur), caché tant que la scène tourne
   └─ scene/Scene.tsx              chargé à part (next/dynamic, ssr: false)
      └─ core/SceneCanvas.tsx      Canvas R3F + core/ClockDriver.tsx (horloge, frame)
         ├─ decor/Decor.tsx        partie « décor »
         ├─ items/CvItems.tsx      partie « objets »
         └─ stage/Stage.tsx        partie « mise en scène »
```

- La page est statique (rendue au build pour `/fr` et `/en`). Le HUD et la version express sont dans le HTML : la page s'affiche tout de suite.
- La scène est un composant client chargé après l'hydratation, dans son propre fichier JavaScript (three n'est pas dans le JavaScript initial, un test E2E le vérifie). Elle apparaît en fondu à sa première image.
- Elle reçoit ses textes en props (`SceneTexts`, `src/scene/core/texts.ts`). Ni zod ni le module de contenu n'entrent dans le navigateur : une règle ESLint l'interdit dans `src/scene/**` et `src/components/desk/**` (les imports de types restent permis).
- Repli : sans JavaScript, `@media (scripting: none)` montre la version express et cache le HUD. Sans WebGL (test avant de charger la scène), si la scène plante (error boundary) ou si le contexte WebGL est perdu, `data-fallback` sur la racine fait de même. Un seul `h1` visible à la fois.

## Dossiers et propriétaires

| Dossier                                                                               | Propriétaire           | Contenu                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scene/core/`, `src/scene/Scene.tsx`                                              | socle (figé)           | Canvas, horloge, store, constantes, identifiants, outils communs                                                                                                                                                                          |
| `src/scene/decor/`                                                                    | décor                  | plateau, mur et fenêtre (cadre, embrasure), modèle de la lampe, clavier, tapis, souris, câbles, kimono plié et sa ceinture (étape 6 : sans stream, ni gants), corde à sauter, bandes, plante, mangas, figurines, tasse et vapeur, manette |
| `src/scene/items/`, `src/content/scene/`                                              | objets                 | l'écran (cadre, pied, webcam, post-it décoratifs, code TypeScript), livre, badge et lanière, post-it à décoller, casque sur support, portable, carte de visite, coffret scellé, textures peintes, étiquettes, survol, présentation        |
| `src/scene/stage/`                                                                    | mise en scène          | lumières, cône et poussière de la lampe, ciel derrière la fenêtre, ambiances, arrivée, caméra et cadrage, mode auto, Rejouer, mouvement réduit, post-traitement, qualité adaptative                                                       |
| `src/components/desk/`, `src/lib/desk.ts`, `src/app/`, `src/content/` (hors `scene/`) | socle, puis assemblage | page, HUD, repli, textes d'interface                                                                                                                                                                                                      |

Règles :

- Chaque partie remplace le composant provisoire de son dossier (`<Decor />`, `<CvItems texts />`, `<Stage />`) en gardant son nom et ses props. `Scene.tsx` ne change pas.
- Une partie ne modifie aucun fichier hors de ses dossiers. Un besoin dans le socle (une constante, un champ du store) se note pour l'assemblage ; en attendant, la partie le garde chez elle.
- Les tests unitaires d'une partie vont dans son dossier (`*.test.ts`, lancés par `npm test`). Ses tests E2E vont dans `tests/e2e/scene-<partie>.spec.ts` (`scene-decor.spec.ts`, `scene-objets.spec.ts`, `scene-scene.spec.ts`) : un fichier chacun, pas de modification des autres. Les parcours complets du visiteur (assemblage) sont dans `tests/e2e/parcours.spec.ts`, ceux du socle dans `tests/e2e/bureau.spec.ts`.

## Repère et unités

Celui du prototype : le dessus du plateau est en `y = 0`, `x` va de `-6.6` (gauche) à `6.6` (droite), `z` de `-3.55` (mur du fond) à `3.4` (bord avant, côté visiteur). `y` monte. Une unité vaut environ 10 cm. Le mur est en `z = -3.66`, la fenêtre s'ouvre de `x = -6.3` à `-2.5` et de `y = 0.62` à `4.5`.

## Le store (`src/scene/core/store.ts`)

Un store zustand, créé par page dans `DeskShell` et passé par contexte (`SceneStoreProvider`). React Three Fiber relaie le contexte dans le Canvas. Rien en global.

- `useSceneStore(selector)` : s'abonner à l'état réactif (le composant se redessine quand la valeur change).
- `useSceneStoreApi().getState()` : lire l'horloge et `frame` dans `useFrame`, appeler une action. Toujours relire `getState()` à chaque image : `init()` remplace l'horloge.

État réactif :

| Champ                      | Sens                                                                                  | Écrit par                     |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| `initialized`, `settings`  | réglages lus dans l'adresse et `prefers-reduced-motion` (voir « Paramètres de test ») | `DeskShell` (`init`)          |
| `ready`                    | la scène a dessiné ses premières images                                               | socle                         |
| `phase`                    | `dark`, `lamp`, `screen`, `window`, `settled`                                         | socle (`syncArrival`)         |
| `hud`                      | `carton`, `brand`, `chips`, `tags`, `hint` : ce que l'arrivée montre                  | socle                         |
| `mood`, `moodPinned`       | ambiance (`morning`, `afternoon`, `evening`, `night`) ; choisie ou déduite de l'heure | HUD (`setMood`)               |
| `autoOn`                   | visite automatique en cours                                                           | mise en scène (`setAutoOn`)   |
| `presented`, `presentedBy` | objet présenté (ou `monitor` : gros plan sur l'écran) et sa source                    | objets, HUD, mise en scène    |
| `hovered`                  | objet sous le pointeur                                                                | objets (`setHovered`)         |
| `lastUserAt`               | T de la dernière action du visiteur (`Infinity` avec `?prendre=` : jamais de visite)  | `markUser()`                  |
| `lamp`                     | interrupteur de la lampe et instant d'allumage                                        | décor (`toggleLamp`), Rejouer |
| `replays`                  | nombre de « Rejouer » : s'y abonner pour remettre un état d'arrivée à zéro            | HUD (`replay`)                |

Actions : `present(item, source)` (toute source autre que `auto` compte comme une action du visiteur), `putBack()`, `setHovered(item)`, `markUser()` (coupe la visite et repose son objet), `setAutoOn(on)`, `setMood(mood, pinned)`, `toggleLamp()`, `replay(now)`. Le socle seul appelle `init`, `markReady` et `syncArrival`.

Valeurs par image, mutables, jamais réactives :

- `clock` : `t` (secondes depuis le début de l'arrivée), `dt` (borné à 0.1), `frozen`. Suspendue quand l'onglet est caché.
- `frame` : recalculé par le socle avant tous les autres `useFrame` (priorité `CLOCK_PRIORITY = -100`) : `t`, `dt`, `lamp` (scintillement compris, interrupteur compris), `lampFlash`, `screen`, `keyboardLed`, `typed` (caractères tapés, sans borne : chaque objet borne à sa longueur), `window`, `ambient`, `camera` (montée, 0 à 1), `mood` (ambiance interpolée en 1.4 s, couleurs en composantes sRGB : `applyRgb(color, rgb)`), `portrait` (largeur / hauteur < 0.9). Deux champs sont écrits par la partie objets : `presentLevel` (avancement de la présentation, 0 à 1), que la mise en scène lit (assombrissement, lumière de l'objet tenu) ; `typingEnd` (T où le code de l'écran est entièrement tapé, `TYPING_END_DEFAULT` avant la première image), que le clavier du décor suit.

Priorités de `useFrame` : le socle à `-100`. Les parties restent à `0` (défaut) ou entre `-99` et `-1` ; une priorité positive coupe le rendu automatique et revient au seul post-traitement (mise en scène). Ordre retenu à l'assemblage :

| Priorité | Qui                                                    |
| -------- | ------------------------------------------------------ |
| -100     | socle : horloge et `frame`                             |
| -95      | mise en scène : visite automatique                     |
| -90      | mise en scène : caméra                                 |
| -80      | mise en scène : lumières, ciel, lumière de la fenêtre  |
| -11      | objets : matrices de la caméra à jour                  |
| -10      | objets : présentation, écran (`typingEnd`), étiquettes |
| -10      | mise en scène : effets (lisent `presentLevel` à -9)    |
| -9       | objets : `presentLevel`                                |
| 0        | décor (clavier, LED, petites animations)               |
| 1        | mise en scène : rendu du post-traitement               |

## Constantes (`src/scene/core/constants.ts`)

Portées du prototype, sans dépendance à three :

- Bureau et pièce : `DESK`, `DESK_THICKNESS`, `WIN`, `WALL_Z`, `WINDOW_SKY` (le plan du ciel, peint par la mise en scène, avec le fond sombre du décor derrière), `FLOOR_Y`, `BACKGROUND`.
- Matériel partagé : `LAMP` (pied, coude, tête, point visé), `STAND`, `MONITOR` (position, hauteur et inclinaison de la dalle, tailles), `KEYBOARD`, `HEADSET_STAND`.
- Objets : `ITEM_POSES` (position, rotation, encombrement présenté `hold`, mode de présentation, accroche de l'étiquette), `POSTIT_ON_MONITOR`, `BOUNDS`, `SHEET` (étape 4). Encombrement vu de dessus : `src/scene/core/bodies.ts` (étape 4).
- Vues de la caméra (`src/scene/core/views.ts`, à ne pas confondre avec le calcul du cadrage, `stage/framing.ts`) : `PORTRAIT_MAX_ASPECT`, `PORTRAIT_PLACES`, `REST` et `REST_FIT` (vue de repos et points à cadrer), `START_L`, `START_P`, `HELD`, `HELD_MAX_DISTANCE`, `SCREEN_FOCUS`.
- Temps : `SETTLE` (10.4 s), `AUTO_START` (12.6 s), `IDLE_DELAY` (12 s), `AUTO_SEQ`, `AUTO_TIMING`, `ARRIVAL` (tous les temps de l'arrivée), `TYPING_END_DEFAULT`, `MOOD_TRANSITION`.
- Ambiances et lumières : `MOODS` (valeurs du prototype), `MOOD_SWATCHES`, `LAMP_COLOR`, `legacyIntensity()`, `POINT_DECAY` et `legacyPointIntensity()`.

Les niveaux de l'arrivée sont des fonctions pures de T dans `arrival.ts` (`lampLevel`, `screenLevel`, `typedChars`, `extraLineChars`, `windowLevel`, `cameraProgress`, `deckLedOn`...), testées.

## Identifiants (`src/scene/core/ids.ts`)

Objets : `book`, `badge`, `postit`, `headset`, `laptop`, `card`, `chest`, `monitor`, et depuis l'étape 4 `netherbrain` et `homelab` (tableau à jour dans [`docs/gestes.md`](gestes.md) : l'étape `projects` présente désormais `netherbrain`). Étapes du CV (puces) : `defi-metiers`, `dares`, `projects`, `perso`, `contact`.

| Étape          | Objets              | Objet présenté (`STEP_ITEM`) | Puce                         |
| -------------- | ------------------- | ---------------------------- | ---------------------------- |
| `defi-metiers` | `book`, `badge`     | `book`                       | 2020, DEFI-METIERS           |
| `dares`        | `postit`, `headset` | `postit`                     | 2024, DARES                  |
| `projects`     | `laptop`            | `laptop`                     | 2026, Netherbrain et Homelab |
| `perso`        | `chest`             | `chest`                      | Projets perso                |
| `contact`      | `card`              | `card`                       | Contact                      |

L'écran (`monitor`) n'appartient à aucune étape : il montre tout le parcours, et son gros plan n'allume aucune puce.

Visite automatique (`AUTO_SEQ`) à l'étape 3 : `book`, `postit`, `laptop`, `card`, `chest` (étape 4 : `book`, `postit`, `netherbrain`, `homelab`, `laptop`, `card`, `chest`). Chaque puce est un lien vers la section de la version express (`#defi-metiers`, `#dares`, `#projects`, `#contact`) ; quand la scène tourne, le HUD l'intercepte et présente l'objet.

## Rendu

- Gestion des couleurs active (défaut de three) : textures de canvas en `SRGBColorSpace` (fait par `useCanvasTexture`), sortie sRGB. r128 n'en avait pas : les couleurs en hexadécimal restent les mêmes, mais les intensités des lumières se recalibrent.
- Pas de tone mapping (`flat`) : l'étalonnage chaud du prototype (vignette, courbe, assombrissement autour de l'objet tenu) revient au post-traitement de la mise en scène. La page pose déjà un grain et une légère vignette en CSS : le post-traitement ne double pas la vignette sans le décider.
- Intensités : `legacyIntensity(i)` (facteur π des lumières physiques) est le point de départ. Le spot de la lampe garde `decay: 0` (sans atténuation, comme dans le prototype). Les lumières ponctuelles (écran, objet tenu, panneau, lueur du coffret) prennent `decay: POINT_DECAY` (1) et `legacyPointIntensity(i, D)` : la courbe 1 / d coupée à D suit à quelques pour cent près le (1 - d / D)² du prototype, alors qu'avec `decay: 0` la lueur de l'écran éclairait tout le bureau. Les facteurs de calage sont dans `src/scene/stage/lighting.ts` (`CALIBRATION`, `MOOD_REFERENCE`, `SPOT_BOOST`).
- Ombres PCF, densité de pixels bornée à 2, rendu suspendu quand l'onglet est caché.
- Outils : `rng` (graine), `grainy`, `roundRect`, `fitFont` (canvas 2D), `useCanvasTexture` (redessinée quand les polices arrivent, sauf avec `usesFonts: false` pour une texture sans texte, avec les vrais noms de famille de next/font : `fonts.serif`, `fonts.mono`, `fonts.hand`), `paintCanvasTexture` (pour l'écran qui se tape), `standardMaterial` (cache, ne jamais modifier un matériau du cache), `brass()`, `texturedMaterial` (texture qui luit au survol), `applyRgb`, et les briques `Box`, `Cyl`, `Sph`, `Cable`, `flatPlaneGeometry`.
- Règle `react-hooks/immutability` : ne pas modifier un objet renvoyé par un hook (`useThree((s) => s.camera)`). Le lire avec `get()` dans un effet, ou le recevoir dans `useFrame((state) => ...)`, ou passer par une ref.

## Interdits (CSP)

La CSP du site n'a ni `unsafe-eval`, ni workers en `blob:`, ni d'autre origine que le site. On ne l'ouvre pas pour la 3D. Donc, dans drei et ailleurs :

- pas de `<Text>` ni de `<Text3D>` de drei (troika passe par des workers en `blob:`) : le texte se peint dans une texture de canvas ;
- pas de `useGLTF` avec Draco ou Meshopt (décodeurs en worker ou chargés d'un CDN), pas d'`<Environment preset>` (fichiers HDR sur un CDN), pas de `<Stats>` ;
- aucun fichier chargé d'une autre origine : tout modèle ou image vit dans le dépôt ;
- `<Html>` de drei et `@react-three/postprocessing` sont permis. Les étiquettes n'utilisent pas `<Html>` : c'est une couche DOM maison (`TagLayer`). drei a été retiré le 06/11/2026 : aucun fichier ne l'importait.

Un test E2E vérifie la CSP du bureau et l'absence d'erreur dans la console. La console garde un avertissement qui ne vient pas du dépôt : « THREE.Clock: This module has been deprecated », émis par React Three Fiber 9 (son store crée un `THREE.Clock`) avec three 0.186 ; il partira avec une version de R3F qui passe à `THREE.Timer`.

## Textes

Tout texte factuel affiché ou peint vient du module de contenu et du CV (`src/content/`, FR et EN). Les textes du prototype ne sont pas des faits : « Support applicatif N1 », « Développeur JS/TS », « Montée en TypeScript », « 3 ans », « 2023 » sont faux ou arrondis. Les dates exactes : DEFI-METIERS de sept. 2020 à août 2023, DARES de janv. 2024 à juin 2026 ; Netherbrain et Homelab en 2026 ; « Disponible » validé le 28/10/2026.

- Textes d'interface du bureau : `content.desk` (HUD, carton, puces, phrase de l'heure, ambiances, indication, aria-label du canvas, repli).
- Textes peints dans la scène : `content.scene` (`src/content/scene/`, schéma zod, `fr.ts`, `en.ts`). Le socle n'y met qu'un squelette (étiquettes, code de l'écran) ; la partie objets le complète. Les lignes de code peuvent être vides ou indentées et tiennent en 60 caractères.
- Décor sans marque, jeu, anime ni pseudo réels.
- Coffret scellé (remplacé par l'usine le 04/11/2026, voir [`usine-et-intro.md`](usine-et-intro.md)) : jamais les mots automatisation, usine, vidéos, ni aucun nom de chaîne, de compte ou de plateforme. Un test le vérifie sur `desk` et `scene`.
- Commentaires et textes en français, identifiants en anglais, jamais de tiret cadratin ni demi-cadratin (test sur tout le dépôt).

## Paramètres de test

Ceux du prototype, lus par `parseTestParams` (`src/scene/core/params.ts`) :

| Paramètre              | Effet                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| `?t=11000`             | saute à 11 s de l'arrivée (en ms)                                   |
| `&fige`                | gèle l'horloge (et les animations CSS du HUD)                       |
| `?heure=14`            | heure du visiteur (0 à 24)                                          |
| `?auto=0`              | pas de visite automatique                                           |
| `?reduit`              | mouvement réduit, comme `prefers-reduced-motion`                    |
| `?prendre=book`        | présente un objet dès le départ (identifiants anglais), sans visite |
| `?tourne=0.6,1.2`      | tourne l'objet de `?prendre=` (radians : horizontal, vertical)      |
| `?ambiance=night`      | force une ambiance                                                  |
| `?noshadow`, `?nopost` | sans ombres, sans post-traitement (mesures)                         |
| `?attente=1500`        | délai avant la version express (ms ; 0 : jamais), étape 6           |
| `?desordre`            | étape 6 : tout le bureau lancé en l'air dès que le moteur est prêt  |

`?tourne=` est lu par la rotation libre (`parseTurn`, `src/scene/rotation/trackball.ts`), pas par `parseTestParams`.

État exposé aux tests sur `#hud` (attributs, rien en global) : `data-ready`, `data-phase`, `data-mood`, `data-presented`, `data-auto`, `data-reduced`, `data-frozen`. La racine porte `data-fallback` (`no-webgl`, `crashed`, `context-lost` ou, depuis l'étape 6, `timeout`) quand le repli s'affiche.

## Captures

`scripts/capture.mjs` capture une page avec la 3D (Chromium sans écran, WebGL par SwiftShader), depuis n'importe quel worktree :

```bash
# le site doit tourner (npm run build && npm run start -- --port 3401, ou npm run dev -- --port 3401)
node scripts/capture.mjs /fr --port 3401 --params "t=11000&fige&auto=0&heure=14" --out /tmp/bureau-14.png
node scripts/capture.mjs /fr --port 3401 --params "t=11000&fige&auto=0&heure=23" --size 390x844 --mobile --dpr 2 --out /tmp/tel-23.png
node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0&heure=8" --out /tmp/proto-8.png
```

Options : `--size LxH`, `--dpr`, `--mobile`, `--theme light|dark`, `--reduced`, `--delay ms`, `--port` (ou `CAPTURE_PORT`). Sur le site, la capture attend `#hud[data-ready="true"]`.

Captures de référence du prototype : elles restent hors du dépôt. Pour les recréer (le prototype charge three r128 et les polices depuis des CDN) :

```bash
REF=/chemin/hors/du/depot/reference
for h in 8 14 19 23; do
  node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0&heure=$h" --out $REF/ordinateur-heure-$h.png
  node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0&heure=$h" --size 390x844 --dpr 2 --mobile --out $REF/telephone-heure-$h.png
done
for t in 500 2000 4000 6000 8000 10400; do
  node scripts/capture.mjs prototype/bureau-plateau.html --params "t=$t&fige&auto=0&heure=14" --out $REF/arrivee-$t.png
done
node scripts/capture.mjs prototype/bureau-plateau.html --params "t=11000&fige&auto=0&heure=14&prendre=livre" --delay 2500 --out $REF/objet-livre.png
```

Pour comparer, capturer le site avec les mêmes paramètres (`prendre=book` pour le livre) et regarder les deux images côte à côte. Avec `&fige`, la présentation d'un objet se pose tout de suite dans son état final (livre ouvert, portable ouvert) : la capture ne dépend plus de la cadence de SwiftShader.

## Worktrees et ports

Les worktrees des étapes 3 et 4 ont été fusionnés puis supprimés. Les ports de l'étape 4 sont dans [`docs/gestes.md`](gestes.md). Commande de l'étape 3, pour mémoire :

```bash
git worktree add .claude/worktrees/decor -b feat/bureau-3d-decor feat/bureau-3d
cd .claude/worktrees/decor && npm ci
npm run dev -- --port 3401              # développement
E2E_PORT=3411 npm run test:e2e          # tests de bout en bout
```

`.claude/worktrees/` est ignoré par git, ESLint, Prettier et TypeScript du dépôt principal. `next.config.ts` fixe la racine de Turbopack et du traçage des fichiers sur le dossier du worktree. Chaque worktree a ses `node_modules` et son `.next`. Un seul `next dev` peut tourner par dossier : pour un second serveur dans le même dossier, servir le build (`npm run build && npm run start -- --port 3420`).

| Partie                        | `next dev` | E2E (`E2E_PORT`) |
| ----------------------------- | ---------- | ---------------- |
| décor                         | 3401       | 3411             |
| objets                        | 3402       | 3412             |
| mise en scène                 | 3403       | 3413             |
| assemblage                    | 3420       | 3100 (défaut)    |
| étape 6 : A (rotation)        | 3601       | 3611             |
| étape 6 : B (rangement)       | 3602       | 3612             |
| étape 6 : C (décor, intro)    | 3603       | 3613             |
| étape 6 : socle et assemblage | 3600       | 3600             |

## Vérifier

- `npm run check` : ESLint, Prettier, types, tests unitaires. Socle : paramètres, horloge, arrivée, ambiances, store, textes du bureau, contenu. Décor : disposition, clavier et frappe, pavé, micro, mangas, fusion des géométries. Objets : code de l'écran (généré depuis le CV, lisible, tapé avant la ligne finale), présentation, contenu peint contre le CV. Mise en scène : cadrage, arrivée, lumières et calage sur le prototype, visite automatique, qualité adaptative, lumière de la fenêtre. Étape 4 : encombrements au repos (`bodies.test.ts`), hub des gestes (`gestures/`), présentation et suivi du pointeur, signes de vie (`src/lib/life-signs`, vue de la fiche), battements du coffret, LED de la baie, pile du portable comparée au CV, cadrage sur 14 fenêtres réelles, pile sous la carte dans son encombrement (`cardPile.test.ts`), étiquettes écartées (`tagSpread.test.ts`). Étape 6 : le monde physique avec le vrai Rapier (`physics/world.test.ts` : repos immobile, glisser sans interpénétration, empilement, chute, lancer, retour, format, déterminisme).
- `npm run test:e2e` : build de production puis Playwright sur ordinateur et téléphone.
  - `bureau.spec.ts` (socle) : HUD visible sans la 3D, pixels du canvas, repli sans WebGL et sans JavaScript, mouvement réduit, nuit à 23 h, sélecteur d'ambiance, langues, liens bureau et version express, axe sur le HUD, aucune erreur en console, en-têtes et CSP, scène hors du JavaScript initial, puce qui présente un objet, Rejouer.
  - `scene-decor.spec.ts` : décor immobile sous `&fige`, vivant sinon, nuit sans erreur, kimono glissé sans rien chevaucher (étape 6).
  - `intro.spec.ts` (étape 6, écran de chargement) : dans le HTML du serveur en FR et EN, avancement réel qui ne recule jamais, HUD hors du clavier et lien vers la version express pendant l'attente, repli quand la scène tarde (`?attente`), écran qui s'efface si JavaScript ne démarre pas, absent sans JavaScript, sans animation en mouvement réduit.
  - `scene-objets.spec.ts` : étiquettes FR et EN, cachées pendant l'arrivée et la présentation, puce, étiquette, survol et clic, clic hors des objets, mouvement réduit.
  - `scene-scene.spec.ts` : arrivée du noir à `settled`, Rejouer trois fois sans fuite WebGL, visite dans l'ordre, arrêt et reprise, `?auto=0`, puce qui reprend la main, mouvement réduit, changement d'ambiance.
  - `parcours.spec.ts` (assemblage) : puce au clavier puis Échap, gros plan sur l'écran au clic et par `?prendre=monitor`, visite arrêtée par une touche, Rejouer qui repose l'objet et garde l'ambiance, passage en anglais scène comprise, aller-retour avec la version express.
  - `scene-gestes.spec.ts` (étape 4, gestes) : bureau au repos, objet présenté retourné sauf avec `?recto`, portable glissé contre la carte sans la chevaucher, objet tiré vers le bord qui reste sur le plateau, `?glisse=mug`, appui de moins de 7 px qui reste un clic, retourner puis remettre d'un clic, objet déplacé présenté puis reposé à sa nouvelle place jusqu'à Rejouer, `?glisse` sous `&fige` et sans, mouvement réduit (Rejouer compris), objet glissé puis présenté au clavier qui reste présenté, visite coupée par un glisser, pas de défilement au doigt. Les recouvrements se vérifient avec le solveur, à partir de `data-places`.
  - `scene-fiches.spec.ts` (étape 4, fiches et son) : chaque puce ouvre la bonne fiche en FR et en EN (comparée au contenu), Préc. / Suiv. et Page précédente / Page suivante (les flèches à l'étape 4) sur tout `SHEET_ORDER`, focus au clavier rendu par Échap et Reposer, visite qui ne vole pas le focus, Retourner au bouton et à `R`, aucun lien vers un dépôt privé, axe fiche ouverte, boutons et liens de 44 px sans `aria-label`, signes de vie FR et EN sans mot interdit, son coupé jusqu'au clic (aucun AudioContext avant), indication de l'objet tenu, feuille du bas en 390x844, 360x740 et 412x915, fiche à droite en 844x390.
  - `scene-projets.spec.ts` (étape 4, objets et cadrage) : étiquettes de Netherbrain, Homelab et de la pile, présentation par la puce, l'étiquette, un clic ou un tap, dos peint des deux objets retournés, coffret qui bat au rythme de ses signes de vie, `data-offscreen` vide sur ordinateur, en trois portraits et en paysage, bureau resserré qui remplit la hauteur libre en portrait (`data-desk-share` au-dessus de 0.65), bord avant du bureau sur le HUD du bas.
  - `scene-rotation.spec.ts` (étape 6, partie A) : glisser sur l'objet tenu qui le tourne sans le retourner ni le reposer, à la souris et au doigt, arc au bord (axe de la vue), clic et `R` qui retournent toujours, « Remettre droit » et Début, flèches, Page précédente et Page suivante, flèches ignorées dans un champ, écran qui ne tourne pas, `?tourne=`, élan puis arrêt en temps réel, ni élan ni animation en mouvement réduit. L'angle se lit sur le canvas (`data-spin`), l'état sur `#hud` (`data-turned`).
  - `contact.spec.ts`, `contact-api.spec.ts` et `signes.spec.ts` (étape 5, routes serveur) : voir [`routes-serveur.md`](routes-serveur.md).
  - La CI découpe chaque profil en trois parts (`--shard`), six jobs en parallèle : voir « Décisions de l'assemblage de l'étape 4 ».

## État à la fin de l'étape 3

Tout le périmètre est en place : plateau, mur et fenêtre avec ciel par ambiance, lampe d'architecte (cliquable), écran au code TypeScript généré depuis le CV, les huit objets du CV, le décor perso, quatre ambiances et leur sélecteur, l'arrivée complète, les étiquettes, le survol, la présentation (visite automatique, clic, puce, étiquette, clavier), Rejouer, le mouvement réduit, le chargement progressif et le repli.

Défauts du prototype corrigés :

- code de l'écran : texture de 2048 px, police 1.7 fois plus grande en proportion, lisible en vue large (et en gros plan) ;
- micro : bras crème à double tige, micro presque horizontal à grille claire, lisible vu de dessus ;
- coffret : plus grand, bois clair, plaque, sceau, LED et liseré qui pulse.

Calage sur le prototype (captures côte à côte, mêmes paramètres, luminance moyenne par zones) :

- après-midi, matin, soir et livre présenté : à quelques pour cent du prototype ;
- nuit : un peu plus claire que le prototype (environ +25 % de luminance moyenne), surtout sur le clavier et la carte ;
- arrivée : de +10 à +25 % pendant les premières secondes, à cause du cône de la lampe et du flou lumineux, identique dès 8 s ;
- ajouts par rapport au prototype : ombres douces du soleil, ciel en fondu entre ambiances, poussière dans la lumière.

Réglages : `CALIBRATION` (hémisphère 0.62, soleil 0.7, spot 2.0, cône 0.3, tache 0.45, rais 0.35, poussière 0.7, écran et objet tenu 1), `MOOD_REFERENCE` (les intensités des ambiances relatives à l'après-midi, élevées à la puissance 2.2), `SPOT_BOOST` (0.3), `POINT_DECAY` (1) et `skyLevel` à la puissance 2.2.

Ce qui reste pour l'étape 4 : retourner et glisser les objets, collisions (devenu `DECOR_OBSTACLES`, des rectangles orientés, à l'étape 4), fiches, son, objets dédiés à Netherbrain et Homelab, signes de vie du coffret, bords coupés sur téléphone (le coffret et le micro y sont en partie hors champ, comme dans le prototype).

## Décisions du socle

- Le HUD est visible dès le HTML du serveur (recruteur pressé, référencement, repli). Une fois la scène prête et pendant l'arrivée, l'identité et les puces s'effacent puis reviennent à 7.4 s et 8.1 s, comme dans le prototype ; en mouvement réduit, l'arrivée est déjà finie.
- En mouvement réduit, l'horloge démarre après l'arrivée, sans visite automatique. « Rejouer » était masqué ; depuis la relecture de l'étape 4, il reste là et remet les objets déplacés en place sans rejouer l'arrivée.
- Le carton dit « Bienvenue chez Ali » (prénom tiré du nom) et le titre du CV.
- La puce « Projets perso » mène à la section des projets de la version express, qui n'a pas de section dédiée.
- `?prendre=` prend les identifiants anglais (`book`, pas `livre`).

## Décisions de l'assemblage

- Les lumières ponctuelles passent à `decay: 1` avec `legacyPointIntensity` (voir « Rendu ») ; le spot de la lampe reste à `decay: 0`.
- Les intensités des ambiances sont relatives à l'après-midi et élevées à la puissance 2.2 : sans cela, le soir et la nuit restaient presque aussi clairs que l'après-midi.
- Le ciel est noir avant l'arrivée de la fenêtre (`skyLevel` à la puissance 2.2) : il se voyait dès la première seconde.
- `WINDOW_SKY` vit dans les constantes du socle : le ciel (mise en scène) et le fond de secours (décor) partagent le même emplacement.
- L'écran écrit `frame.typingEnd` : le clavier s'arrête de taper à la dernière lettre du code, quelle que soit sa longueur.
- Sous `&fige`, la présentation se pose aussitôt dans son état final (comme en mouvement réduit) : captures et tests ne dépendent plus de la cadence.
- L'étiquette du post-it passe sous le post-it : au-dessus, elle cachait la fin des lignes de code de l'écran.
- `CHEST_PORTRAIT.z` avance de 0.3 (le coffret agrandi touchait le pied du casque en portrait). Supprimé à l'étape 4 : voir [`docs/gestes.md`](gestes.md).
- Un clic n'importe où hors de l'objet tenu le repose, décor compris (le décor garde ses propres réactions : lampe, figurines, tasse...).
- Les deux vignettes restent : celle du CSS et celle de `GradeEffect` (0.75), qui ensemble retrouvent celle du prototype.
- L'horloge ne part qu'à la deuxième image : la première compile les shaders et peut prendre des secondes sur une machine lente, et le visiteur manquait alors le début de l'arrivée.
- Les tests de bout en bout tournent sur 4 pages à la fois en local (`workers` dans `playwright.config.ts`) : au-delà, SwiftShader sature le processeur et les scènes mettent plus de 45 s à démarrer.
- Le test du coffret attrape « chaîne » comme mot entier (`\bcha[iî]nes?\b`) : « prochaine étape » revient à l'écran.

## Décisions de la relecture

- Le verso du badge passe sous la pochette (`y = 0.001`, pochette de 0.003 à 0.033) : à l'intérieur, la face du dessous de la pochette le cachait quand le badge se retourne. Un test E2E mesure le contraste du verso présenté.
- Le coffret recule (`ITEM_POSES.chest.z` de -0.12 à -0.7) : agrandi, il passait derrière le livre en vue large et sa plaque ne se lisait plus.
- L'écran ne repeint plus toute sa texture (2048 x 1152) en continu : une fois le code tapé, la ligne finale et le curseur vivent dans une bande à part (`closingBand`, 150 px de haut), posée sur la dalle. La grande texture ne change plus que pour le numéro de ligne de la barre d'état, deux fois par boucle.
- La barre d'état de l'écran commence à `STATUS_LEFT` (104 px) : le post-it rose du cadre cachait le T de TypeScript.
- Les textures sans texte (bois, plâtre, feutre, point, touches du portable) ne sont plus redessinées à l'arrivée des polices (`usesFonts: false`).
- Le canvas n'a plus d'anticrénelage quand le post-traitement est branché : celui-ci dessine dans ses propres cibles (`multisampling`).
- L'écran n'allume plus aucune puce (`ITEM_STEP.monitor = null`) : il montre tout le parcours, pas les projets.
- La perte du contexte WebGL a son propre avis (`data-fallback="context-lost"`, « Le bureau en 3D s'est interrompu. »).
- L'heure n'est plus une région `aria-live` (elle se relisait chaque minute). Une région `role="status"` masquée annonce seulement les gestes du visiteur : objet présenté par une puce, ambiance choisie. La puce de l'objet présenté porte `aria-current`.
- HUD : sous 1300 px, l'indication se pose juste au-dessus du bas de page (elle est dans le footer) au lieu de toucher les commandes ; sous 1000 px, l'heure et les ambiances passent au-dessus des cinq puces ; téléphone à l'horizontale (hauteur de 500 px au plus), les puces perdent leur détail et partagent la ligne de l'heure. Un test E2E vérifie 844x390, 1024x768 et 768x1024.
- L'identité du HUD a un voile sombre local et une ombre serrée : le titre et le statut dépassent 4.5 de contraste sur la fenêtre claire du matin et de l'après-midi.
- Le carton d'arrivée a un voile plus dense : le code de l'écran, devenu lisible, se brouillait avec « Bienvenue chez ».
- Le soir, la tache du soleil sous la fenêtre est plus forte (`patchOpacity` de 0.6 à 1.1) : passée en linéaire, elle se perdait et le soir tirait vers la nuit.
- La CI lance les tests de bout en bout en deux jobs parallèles (ordinateur, téléphone), 30 minutes au plus chacun.

## État à la fin de l'étape 4

Tout le périmètre de [`docs/gestes.md`](gestes.md) est en place, fusionné sur `feat/gestes` :

- prendre : l'objet se soulève devant la caméra, tourne, et suit un peu le pointeur ;
- retourner : un clic ou un tap sur l'objet tenu, le bouton « Retourner » de la fiche ou la touche `R`, selon le mode de chaque objet (`flip`, `open`, `laptop`, `turn`, `shake`, `spin`) ;
- glisser : neuf corps (livre, badge, portable, carte, coffret, Netherbrain, Homelab, tasse, manette), à la souris et au doigt, avec soulèvement, inclinaison, rebond et écrasement, poussée en chaîne et collisions entre rectangles orientés contre le décor, les autres corps et les bords ; le portable ne chevauche plus la carte ; les places tiennent jusqu'à « Rejouer » ;
- fiches : une par objet, en FR et en EN, tirée du CV, avec Préc. / Reposer / Suiv., flèches, Échap, focus géré, feuille du bas sur téléphone ;
- Netherbrain (bocal au cerveau qui luit) et Homelab (mini baie aux LED qui clignotent), sans lien vers leurs dépôts, encore privés ;
- coffret : signes de vie (données d'exemple signalées comme telles) et battement de sa LED et de son liseré ;
- son : synthèse WebAudio, coupé par défaut, AudioContext créé au clic sur « Son » ;
- téléphone : tout le bureau utile à l'écran en portrait et en paysage (`data-offscreen` vide), glisser au doigt sans défiler ; en portrait, le bureau se resserre (voir « Le bureau resserré du téléphone ») ;
- mouvement réduit : glisser sans retard, inclinaison ni rebond ; retournement et présentation immédiats.

Vérifié à la main, hors du dépôt, avec de vrais gestes : chaque corps glissé vers chacun des autres, vers les trois obstacles du décor les plus proches et vers les quatre bords, sur ordinateur (1440x900, 135 glissers) et sur téléphone (Pixel 7, au doigt, 93 glissers) : aucun recouvrement, rien hors du plateau, aucun objet présenté par un glisser, aucune erreur dans la console. Les fiches parcourues au clavier (puce, Entrée, flèches, `R`, Échap) : focus sur le titre puis rendu à la puce, chaque objet retourné puis remis, l'écran sans bouton ; aucun AudioContext avant le clic sur « Son ». Le rendu au repos des quatre ambiances, sur ordinateur, comparé au prototype avec les mêmes paramètres, ne montre pas de régression par rapport à l'étape 3 ; les deux nouveaux objets s'y ajoutent.

Ce qui reste ouvert (après la relecture, voir plus bas) :

- en portrait, la feuille du bas couvre le bureau quand un objet est tenu : on glisse après l'avoir reposé, ou pendant les pauses de la visite ;
- à valider avec Ali : ce qu'affichent les signes de vie, les étiquettes réduites à leur mot sur téléphone, l'allure des deux nouveaux objets et le son ;
- en 412x915 seulement, sous SwiftShader, un triangle du plan des autocollants du portable se dessine en rayures (texture de 1200 x 840, anisotropie 8). Ni en 390x844, ni en 360x740, ni sur ordinateur ; jamais vu sur un vrai processeur graphique : à vérifier sur un vrai téléphone avant d'y toucher ;
- la CI découpe chaque profil en trois parts dans l'ordre des fichiers : les parts sont déséquilibrées (la plus longue tient dans le temps imparti). Les équilibrer demanderait `PWTEST_SHARD_WEIGHTS`, une variable interne de Playwright, non documentée ;
- étape 5 (faite, voir [`routes-serveur.md`](routes-serveur.md)) : `getLifeSigns()` lit le JSON public, partagé avec `/api/signes-de-vie`.

## Décisions de l'assemblage de l'étape 4

- Les trois parties ne partageaient aucun fichier : fusion sans conflit, dans l'ordre gestes, objets, fiches.
- Un glisser qui commence alors qu'un objet est tenu le repose (décision de la partie gestes, gardée) : le prototype le laissait en main, mais la fiche ouverte parlerait alors d'un autre objet que celui qu'on déplace. Un glisser ne passe jamais par `onPointerMissed` : son clic est avalé avant React Three Fiber.
- Le coffret ne cliquette (`rattle`) que tenu et retourné : il ne tremble plus remis à l'endroit (partie gestes), le son suit.
- La pile du portable vient de la section compétences du CV : `SceneTexts.skills` (les compétences à plat, `buildSceneTexts`) filtre les technologies des projets (`laptopChips`). WireGuard, qui n'est pas une compétence du CV mais une brique du Homelab, quitte l'écran du portable et reste sur la baie. Un test compare chaque pastille au CV.
- Sur téléphone (portrait, ou hauteur de 500 px au plus), les étiquettes ne gardent que leur mot (`TagLayer.module.css`) : entières, elles couvraient le bocal, le badge et la manette, qu'on ne pouvait plus ni toucher ni glisser. Les années restent sur les puces.
- Le test « coupent la visite automatique » glisse le premier corps que le pointeur atteint : la fiche du livre, ouverte par la visite, couvre le portable sur ordinateur et le bas du bureau sur téléphone.
- Les tests qui chargent deux scènes de suite sont marqués `test.slow()`.
- CI : les tests de bout en bout prennent 10.7 min (ordinateur) et 9.0 min (téléphone) en local, sur 16 cœurs et 4 pages ; un profil entier sur 4 cœurs et 2 pages, comme un exécuteur de GitHub (simulé avec `taskset -c 0-3 --workers=2`), prend 36.6 min, au-delà des 30 min du job. Chaque profil se découpe donc en trois parts (`--shard=1/3` à `3/3`), six jobs en parallèle. En CI, le délai d'un test passe à 120 s et celui d'une attente à 30 s (`playwright.config.ts`) : sur 4 cœurs, la scène dessine environ deux fois moins vite (avec les délais de 60 s, la simulation comptait 8 tests instables). Simulées avec ces réglages, les parts 2/3 et 3/3 de l'ordinateur, les plus lourdes (les tests de la 3D), prennent 15.5 et 16 min sans échec ni reprise, la part 1/3 du téléphone 1.4 min (accueil, socle, version express) : avec l'installation et le build, environ 20 min pour le job le plus long. Les parts sont déséquilibrées parce que Playwright découpe la liste dans l'ordre des fichiers.
- Le rendu par image n'a pas changé avec l'étape 4 (même cadence sous SwiftShader que l'étape 3, environ 3 images par seconde par page) : le temps des tests vient de leur nombre (156 sur ordinateur, 142 sur téléphone).

## Décisions de la relecture de l'étape 4

- Un objet qui revient sur le plateau pendant le glisser d'un autre corps est écarté dans la même image (`settleBodies` avec le corps glissé dans `fixed`) : il restait dans un autre corps jusqu'au lâcher. Le cas arrive à chaque glisser commencé quand un objet est tenu, puisque le glisser le repose.
- Quand le corps glissé est présenté au clavier (puce, flèches, Préc. / Suiv.), l'appui en cours oublie son corps : au mouvement suivant, il relançait un glisser qui reposait l'objet qu'on venait de présenter.
- Au repos, les gestes n'allouent plus rien à chaque image : corps actifs en masque de bits, tableaux et événements réutilisés, axes du solveur partagés. Le plateau ne se revérifie que quand il a pu changer : un objet revient, un glisser finit, Rejouer, changement de format (`DragSim.invalidate()`).
- « Rejouer » reste en mouvement réduit : le glisser y est permis, et sans ce bouton on ne pouvait remettre le bureau en ordre qu'en rechargeant la page.
- Les liens de la méta de la fiche (e-mail, LinkedIn) font 44 px de haut, comme les boutons ; le test des cibles mesure tous les liens et tous les boutons de la fiche.
- Les boutons de la fiche n'ont plus d'`aria-label` : leur nom commence par leur texte visible (WCAG 2.5.3, commande vocale). « Reposer » et « Retourner » se suffisent ; « Préc. » et « Suiv. » se complètent par un texte masqué (« Préc. (objet précédent) »). `closeLabel` et `flipLabel` quittent le contenu.
- La pile sous la carte suit la carte (`items/cardPile.ts`, posée chaque image sur `store.desk.card`, soulèvement du glisser compris ; elle reste sur le bureau quand la carte est présentée). L'encombrement de la carte la contient (`hw` 0.91, `hd` 0.575, testé) : un portable poussé contre la carte ne s'enfonce plus dans la pile.
- Les étiquettes de Netherbrain et de Homelab reculent derrière leur objet (`z` -0.55 et -0.6), comme les autres : elles cachaient le couvercle du bocal et le haut de la baie.
- Les étiquettes ne se chevauchent plus (`items/tagSpread.ts`, pur et testé) : celles qui se touchent s'écartent du moins qu'il faut, le plus souvent en hauteur, et restent dans la fenêtre. Sur téléphone, Homelab et DEFI-METIERS, Netherbrain et Compétences se couvraient. Leur taille se remesure quand la fenêtre change.
- L'écran n'est jamais retourné : `present('monitor')` laisse `flipped` à faux, et `data-flipped` aussi.
- Constat rejeté : élever la vue portrait (`elev` 1.1 à 1.2) pour remplir la bande de mur. Mesuré sur les trois portraits : le plateau grandit de 10 à 20 %, mais la hauteur du bureau utile reste la même (environ 220 px en 390x844) et la bande ne rétrécit pas, alors que l'écran se lit moins bien de plus haut.

## Décisions d'Ali sur l'étape 4 (29/10)

- Le sens du retournement reste celui du prototype : l'objet présenté fait son geste d'office (badge retourné, livre ouvert, dos du bocal), le premier clic le remet à l'endroit.
- La fiche du coffret ne garde qu'une note, « Le contenu se raconte en entretien. » : la note des signes de vie (« Le contenu, lui, reste scellé. ») disparaît, avec son champ `live.note`.
- Sur téléphone en portrait, le bureau se resserre au lieu de laisser une bande de mur vide (voir « Le bureau resserré du téléphone »).

## Le bureau resserré du téléphone

En portrait (largeur / hauteur sous 0.9), et seulement là, les objets et le décor se rangent sur une zone plus étroite et plus profonde (détail et places : [`docs/gestes.md`](gestes.md), « Le bureau resserré du portrait »). C'est la largeur qui fixait l'échelle : tenir tout le bureau (x de -6.42 à 5.91) laissait une bande de mur vide au-dessus de l'écran. Les corps tiennent maintenant dans `BOUNDS_PORTRAIT` (x de -3.75 à 3.95), le plateau s'allonge vers le visiteur (`DESK_PORTRAIT_Z1`), le casque passe à droite de l'écran, la lampe et la plante reculent au fond à gauche, le pavé de boutons passe derrière le clavier (le kimono plié à sa place depuis l'étape 6), les mangas et le robot devant. Le micro sur son bras (retiré à l'étape 6), la corde à sauter, les bandes, le renard et le voyageur sont cachés en portrait : ils n'avaient plus de place, et le micro sortait du cadre. Aucun objet du CV n'est caché.

Mesures au repos (bande : de 112 px, bas de l'identité du HUD, au haut du bureau utile ; part : hauteur du bureau utile sur la hauteur libre entre les bandes du HUD, `data-desk-share`) :

| Fenêtre  | Bureau avant | Bande avant | Part avant | Bureau après | Bande après | Part après |
| -------- | ------------ | ----------- | ---------- | ------------ | ----------- | ---------- |
| 390x844  | 214 px       | 313 px      | 0.41       | 375 px       | 134 px      | 0.74       |
| 360x740  | 197 px       | 226 px      | 0.47       | 343 px       | 62 px       | 0.84       |
| 412x915  | 227 px       | 371 px      | 0.38       | 398 px       | 182 px      | 0.69       |
| 768x1024 |              |             | 0.59       | 677 px       | 12 px       | 0.98       |

La tablette en portrait (768x1024) en profite aussi. Le paysage ne change pas : comparées pixel à pixel, avant et après, les captures en 1440x900 (14 h) et en 844x390 ne diffèrent que du bruit d'une capture à l'autre (moins de 0.07 % des pixels, au plus 10 sur 255) et de l'anneau animé du HUD. Le grain du HUD avance en cinq pas par seconde : pour comparer deux captures, il faut le même hasard (graine fixe) et la même phase.

`PORTRAIT_HUD.bottom` passe de 205 à 222 px : la rangée avant du bureau resserré passait sous l'indication du HUD.

Le 06/11, le bureau resserré se resserre encore (zone de 6.1 de large au lieu de 7.7) : les objets sont 26 % plus gros sur téléphone. Places, décor caché et mesures : [`docs/gestes.md`](gestes.md), « Des objets plus gros sur téléphone ».

Tests de bout en bout : en portrait, « coupent la visite automatique » glisse la baie pendant la pause qui suit le livre, mesurée au début de la pause. Le bureau agrandi dépasse entre la feuille du bas et le livre présenté, mais le livre qui s'ouvre finit par couvrir ce qui dépasse : le test glissait le coffret au moment où le livre le cachait. « Gardent sur le plateau un objet glissé vers le bord » (au doigt), « chaque puce ouvre la bonne fiche » et « Préc. / Suiv. » sont marqués `test.slow()` : seuls, 16 à 45 s ; avec 4 pages sous SwiftShader, ils passaient parfois les 60 s. Le rendu, lui, n'est pas plus lent : mesuré sous SwiftShader avant et après, de 2.5 à 3.4 images par seconde en portrait (Pixel 7), de 1.5 à 1.8 sur ordinateur.
