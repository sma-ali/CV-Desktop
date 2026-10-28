# Le bureau en 3D (étape 3)

Ce document fixe le contrat entre les parties de la scène. Le socle a été posé sur la branche `feat/bureau-3d` ; trois parties (décor, objets, mise en scène) se sont construites en parallèle, chacune dans son worktree et dans ses propres fichiers, puis une passe d'assemblage les a fusionnées et a calé le rendu sur le prototype (voir « État à la fin de l'étape 3 »). Le contrat reste valable pour l'étape 4.

Référence visuelle et de comportement : `prototype/bureau-plateau.html` (Three.js r128). On le reproduit et on l'améliore, on ne le recopie pas : ses textes ne sont pas des faits (voir « Textes »).

## Périmètre

Dans l'étape 3 : le port du prototype en composants React Three Fiber avec un Three.js récent. Plateau, mur et fenêtre, lampe, écran au code TypeScript, objets du CV, décor, lumière selon l'heure du visiteur (quatre ambiances et sélecteur), arrivée (carton, lampe qui s'allume, LED du clavier, code tapé à l'écran, montée de caméra), étiquettes des objets, survol, présentation d'un objet (il se soulève devant la caméra, tourne lentement, puis se repose) déclenchée par le mode auto, un clic sur l'objet ou une puce du bas de page, mode auto (visite), Rejouer, `prefers-reduced-motion`, chargement progressif, repli sur la version express. Défauts du prototype à corriger ici : code de l'écran illisible en vue large, micro illisible vu de dessus, coffret petit et sombre.

Hors périmètre (étape 4) : retourner un objet, le faire glisser, les collisions, les fiches (le bristol), le son, les nouveaux objets de Netherbrain et Homelab, les signes de vie du coffret, la correction complète des bords coupés sur téléphone (le cadrage portrait du prototype suffit ici).

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
| `src/scene/decor/`                                                                    | décor                  | plateau, mur et fenêtre (cadre, embrasure), modèle de la lampe, clavier, tapis, souris, câbles, pavé de boutons, micro sur bras, panneau de lumière et gants, corde à sauter, bandes, plante, mangas, figurines, tasse et vapeur, manette |
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
- Objets : `ITEM_POSES` (position, rotation, encombrement présenté `hold`, mode de présentation, accroche de l'étiquette), `POSTIT_ON_MONITOR`, `CHEST_PORTRAIT`, `BOUNDS`.
- Caméra : `PORTRAIT_MAX_ASPECT`, `REST` et `REST_FIT` (vue de repos et points à cadrer), `START_L`, `START_P`, `HELD`, `HELD_MAX_DISTANCE`, `SCREEN_FOCUS`.
- Temps : `SETTLE` (10.4 s), `AUTO_START` (12.6 s), `IDLE_DELAY` (12 s), `AUTO_SEQ`, `AUTO_TIMING`, `ARRIVAL` (tous les temps de l'arrivée), `TYPING_END_DEFAULT`, `MOOD_TRANSITION`.
- Ambiances et lumières : `MOODS` (valeurs du prototype), `MOOD_SWATCHES`, `LAMP_COLOR`, `legacyIntensity()`, `POINT_DECAY` et `legacyPointIntensity()`.

Les niveaux de l'arrivée sont des fonctions pures de T dans `arrival.ts` (`lampLevel`, `screenLevel`, `typedChars`, `extraLineChars`, `windowLevel`, `cameraProgress`, `deckLedOn`...), testées.

## Identifiants (`src/scene/core/ids.ts`)

Objets : `book`, `badge`, `postit`, `headset`, `laptop`, `card`, `chest`, `monitor`. Étapes du CV (puces) : `defi-metiers`, `dares`, `projects`, `perso`, `contact`.

| Étape          | Objets              | Objet présenté (`STEP_ITEM`) | Puce                         |
| -------------- | ------------------- | ---------------------------- | ---------------------------- |
| `defi-metiers` | `book`, `badge`     | `book`                       | 2020, DEFI-METIERS           |
| `dares`        | `postit`, `headset` | `postit`                     | 2024, DARES                  |
| `projects`     | `laptop`, `monitor` | `laptop`                     | 2026, Netherbrain et Homelab |
| `perso`        | `chest`             | `chest`                      | Projets perso                |
| `contact`      | `card`              | `card`                       | Contact                      |

Visite automatique (`AUTO_SEQ`) : `book`, `postit`, `laptop`, `card`, `chest`. Chaque puce est un lien vers la section de la version express (`#defi-metiers`, `#dares`, `#projects`, `#contact`) ; quand la scène tourne, le HUD l'intercepte et présente l'objet.

## Rendu

- Gestion des couleurs active (défaut de three) : textures de canvas en `SRGBColorSpace` (fait par `useCanvasTexture`), sortie sRGB. r128 n'en avait pas : les couleurs en hexadécimal restent les mêmes, mais les intensités des lumières se recalibrent.
- Pas de tone mapping (`flat`) : l'étalonnage chaud du prototype (vignette, courbe, assombrissement autour de l'objet tenu) revient au post-traitement de la mise en scène. La page pose déjà un grain et une légère vignette en CSS : le post-traitement ne double pas la vignette sans le décider.
- Intensités : `legacyIntensity(i)` (facteur π des lumières physiques) est le point de départ. Le spot de la lampe garde `decay: 0` (sans atténuation, comme dans le prototype). Les lumières ponctuelles (écran, objet tenu, panneau, lueur du coffret) prennent `decay: POINT_DECAY` (1) et `legacyPointIntensity(i, D)` : la courbe 1 / d coupée à D suit à quelques pour cent près le (1 - d / D)² du prototype, alors qu'avec `decay: 0` la lueur de l'écran éclairait tout le bureau. Les facteurs de calage sont dans `src/scene/stage/lighting.ts` (`CALIBRATION`, `MOOD_REFERENCE`, `SPOT_BOOST`).
- Ombres PCF, densité de pixels bornée à 2, rendu suspendu quand l'onglet est caché.
- Outils : `rng` (graine), `grainy`, `roundRect`, `fitFont` (canvas 2D), `useCanvasTexture` (redessinée quand les polices arrivent, avec les vrais noms de famille de next/font : `fonts.serif`, `fonts.mono`, `fonts.hand`), `paintCanvasTexture` (pour l'écran qui se tape), `standardMaterial` (cache, ne jamais modifier un matériau du cache), `brass()`, `iron()`, `texturedMaterial` (texture qui luit au survol), `applyRgb`, et les briques `Box`, `Cyl`, `Sph`, `Rod`, `Cable`, `flatPlaneGeometry`.
- Règle `react-hooks/immutability` : ne pas modifier un objet renvoyé par un hook (`useThree((s) => s.camera)`). Le lire avec `get()` dans un effet, ou le recevoir dans `useFrame((state) => ...)`, ou passer par une ref.

## Interdits (CSP)

La CSP du site n'a ni `unsafe-eval`, ni workers en `blob:`, ni d'autre origine que le site. On ne l'ouvre pas pour la 3D. Donc, dans drei et ailleurs :

- pas de `<Text>` ni de `<Text3D>` de drei (troika passe par des workers en `blob:`) : le texte se peint dans une texture de canvas ;
- pas de `useGLTF` avec Draco ou Meshopt (décodeurs en worker ou chargés d'un CDN), pas d'`<Environment preset>` (fichiers HDR sur un CDN), pas de `<Stats>` ;
- aucun fichier chargé d'une autre origine : tout modèle ou image vit dans le dépôt ;
- `<Html>` de drei (étiquettes) et `@react-three/postprocessing` sont permis.

Un test E2E vérifie la CSP du bureau et l'absence d'erreur dans la console.

## Textes

Tout texte factuel affiché ou peint vient du module de contenu et du CV (`src/content/`, FR et EN). Les textes du prototype ne sont pas des faits : « Support applicatif N1 », « Développeur JS/TS », « Montée en TypeScript », « 3 ans », « 2023 » sont faux ou arrondis. Les dates exactes : DEFI-METIERS de sept. 2020 à août 2023, DARES de janv. 2024 à juin 2026 ; Netherbrain et Homelab en 2026 ; « Disponible » validé le 28/10/2026.

- Textes d'interface du bureau : `content.desk` (HUD, carton, puces, phrase de l'heure, ambiances, indication, aria-label du canvas, repli).
- Textes peints dans la scène : `content.scene` (`src/content/scene/`, schéma zod, `fr.ts`, `en.ts`). Le socle n'y met qu'un squelette (étiquettes, code de l'écran) ; la partie objets le complète. Les lignes de code peuvent être vides ou indentées et tiennent en 60 caractères.
- Décor sans marque, jeu, anime ni pseudo réels.
- Coffret scellé : jamais les mots automatisation, usine, vidéos, ni aucun nom de chaîne, de compte ou de plateforme. Un test le vérifie sur `desk` et `scene`.
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
| `?ambiance=night`      | force une ambiance                                                  |
| `?noshadow`, `?nopost` | sans ombres, sans post-traitement (mesures)                         |

État exposé aux tests sur `#hud` (attributs, rien en global) : `data-ready`, `data-phase`, `data-mood`, `data-presented`, `data-auto`, `data-reduced`, `data-frozen`. La racine porte `data-fallback` (`no-webgl` ou `crashed`) quand le repli s'affiche.

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

Les trois worktrees de l'étape 3 ont été fusionnés puis supprimés. Pour reprendre ce mode de travail à l'étape 4 :

```bash
git worktree add .claude/worktrees/decor -b feat/bureau-3d-decor feat/bureau-3d
cd .claude/worktrees/decor && npm ci
npm run dev -- --port 3401              # développement
E2E_PORT=3411 npm run test:e2e          # tests de bout en bout
```

`.claude/worktrees/` est ignoré par git, ESLint, Prettier et TypeScript du dépôt principal. `next.config.ts` fixe la racine de Turbopack et du traçage des fichiers sur le dossier du worktree. Chaque worktree a ses `node_modules` et son `.next`. Un seul `next dev` peut tourner par dossier : pour un second serveur dans le même dossier, servir le build (`npm run build && npm run start -- --port 3420`).

| Partie        | `next dev` | E2E (`E2E_PORT`) |
| ------------- | ---------- | ---------------- |
| décor         | 3401       | 3411             |
| objets        | 3402       | 3412             |
| mise en scène | 3403       | 3413             |
| assemblage    | 3420       | 3100 (défaut)    |

## Vérifier

- `npm run check` : ESLint, Prettier, types, tests unitaires. Socle : paramètres, horloge, arrivée, ambiances, store, textes du bureau, contenu. Décor : disposition, clavier et frappe, pavé, micro, mangas, fusion des géométries. Objets : code de l'écran (généré depuis le CV, lisible, tapé avant la ligne finale), présentation, contenu peint contre le CV. Mise en scène : cadrage, arrivée, lumières et calage sur le prototype, visite automatique, qualité adaptative, lumière de la fenêtre.
- `npm run test:e2e` : build de production puis Playwright sur ordinateur et téléphone.
  - `bureau.spec.ts` (socle) : HUD visible sans la 3D, pixels du canvas, repli sans WebGL et sans JavaScript, mouvement réduit, nuit à 23 h, sélecteur d'ambiance, langues, liens bureau et version express, axe sur le HUD, console propre, en-têtes et CSP, scène hors du JavaScript initial, puce qui présente un objet, Rejouer.
  - `scene-decor.spec.ts` : décor immobile sous `&fige`, vivant sinon, nuit sans erreur.
  - `scene-objets.spec.ts` : étiquettes FR et EN, cachées pendant l'arrivée et la présentation, puce, étiquette, survol et clic, clic hors des objets, mouvement réduit.
  - `scene-scene.spec.ts` : arrivée du noir à `settled`, Rejouer trois fois sans fuite WebGL, visite dans l'ordre, arrêt et reprise, `?auto=0`, puce qui reprend la main, mouvement réduit, changement d'ambiance.
  - `parcours.spec.ts` (assemblage) : puce au clavier puis Échap, gros plan sur l'écran au clic et par `?prendre=monitor`, visite arrêtée par une touche, Rejouer qui repose l'objet et garde l'ambiance, passage en anglais scène comprise, aller-retour avec la version express.

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

Ce qui reste pour l'étape 4 : retourner et glisser les objets, collisions (`DECOR_FOOTPRINTS` dans `src/scene/decor/layout.ts` donne déjà l'encombrement du décor), fiches, son, objets dédiés à Netherbrain et Homelab, signes de vie du coffret, bords coupés sur téléphone (le coffret et le micro y sont en partie hors champ, comme dans le prototype).

## Décisions du socle

- Le HUD est visible dès le HTML du serveur (recruteur pressé, référencement, repli). Une fois la scène prête et pendant l'arrivée, l'identité et les puces s'effacent puis reviennent à 7.4 s et 8.1 s, comme dans le prototype ; en mouvement réduit, l'arrivée est déjà finie.
- En mouvement réduit, l'horloge démarre après l'arrivée, sans visite automatique ; « Rejouer » est masqué.
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
- `CHEST_PORTRAIT.z` avance de 0.3 (le coffret agrandi touchait le pied du casque en portrait).
- Un clic n'importe où hors de l'objet tenu le repose, décor compris (le décor garde ses propres réactions : lampe, figurines, tasse...).
- Les deux vignettes restent : celle du CSS et celle de `GradeEffect` (0.75), qui ensemble retrouvent celle du prototype.
- Le test du coffret attrape « chaîne » comme mot entier (`\bcha[iî]nes?\b`) : « prochaine étape » revient à l'écran.
