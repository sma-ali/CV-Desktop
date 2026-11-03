# Étape 4 : les gestes

À l'étape 6, le solveur 2D et la simulation du glisser décrits ici laissent la place à un moteur physique : voir [`bureau-vivant.md`](bureau-vivant.md). Ce qui suit les concernant est historique.

Ce document fixe le contrat de l'étape 4. Il complète `docs/scene-3d.md` (architecture, repère, store, interdits CSP, textes, captures), qui reste valable. Le socle de l'étape 4 est posé sur la branche `feat/gestes` ; trois parties (gestes, fiches, objets) travaillent ensuite en parallèle, chacune dans son worktree et dans ses propres fichiers, puis une passe d'assemblage les fusionne.

Référence de comportement : `prototype/bureau-plateau.html` (gestes et clic l. 1218-1287, collisions l. 1048-1052 et 1289-1318, glissement l. 1336-1390, fiche l. 116-125, 205-220 et 276-300, signes de vie l. 343-395, son l. 1189-1216). Ses textes de fiche sont faux : les faits viennent du CV, par `src/content` uniquement.

## Périmètre

1. **Prendre** : la présentation de l'étape 3 reste (l'objet se soulève devant la caméra et tourne). L'objet tenu suit un peu le pointeur.
2. **Retourner** : un clic ou un tap sur l'objet tenu le retourne, un autre le remet à l'endroit, selon son mode (`flip` pour le badge, le post-it et la carte, `open` pour le livre, `laptop`, `turn` pour le casque, `shake` pour le coffret, `spin` pour le bocal et la baie). Comme dans le prototype, un objet présenté fait d'abord son geste (`flipped` vaut vrai) : le premier clic le remet à l'endroit. Au clavier : bouton « Retourner » de la fiche et touche `R` (`sheets.ui.flipKey`).
3. **Glisser** : livre, badge, portable, carte, coffret, Netherbrain, Homelab, tasse et manette. Seuil de 7 px, capture du pointeur, l'objet se soulève un peu, s'incline selon sa vitesse, rebondit et s'écrase au lâcher, pousse les autres. Collisions entre rectangles orientés (OBB), contre le décor, les autres corps et les bords (`BOUNDS`, `BOUNDS_PORTRAIT` sur le bureau resserré) ; un portable ne chevauche plus la carte. Petit solveur 2D maison, pur, déterministe et testé (pas de moteur tiers : WASM et workers sont interdits par la CSP). Les places tiennent jusqu'à « Rejouer ». Un clic reste un clic (moins de 7 px) ; un glisser ne présente pas l'objet.
4. **Fiches** : une fiche HTML par objet, ouverte quand il est présenté (sur-titre, étape, titre, méta, texte, note, appel au contact, Préc. / Reposer / Suiv., flèches, Échap). Sur téléphone, elle monte du bas sans cacher l'objet tenu. Focus géré, titre annoncé, cibles de 44 px.
5. **Netherbrain et Homelab** : un bocal au cerveau qui luit (retourné : son étiquette et sa pile), une mini baie de 10 pouces aux LED qui clignotent. Lien GitHub seulement si `repository.public` (aujourd'hui, aucun).
6. **Coffret et signes de vie** : projets en marche, dernière activité, en route depuis, graphique sur 14 jours (`role="img"` et texte équivalent), mention « Données d'exemple ». La LED et le liseré battent au rythme de l'activité.
7. **Son** : synthèse WebAudio, aucun fichier, coupé par défaut, bouton « Son » (`aria-pressed`), AudioContext créé au clic seulement.
8. **Téléphone** : en portrait (390x844, 360x740, 412x915) et en paysage (844x390), tout le bureau utile tient à l'écran, coffret compris, sans grande bande vide : en portrait, le bureau se resserre (voir « Le bureau resserré du portrait »). Glisser au doigt sans faire défiler la page, tap pour prendre.
9. **Mouvement réduit** : glisser reste possible, sans rebond ni inclinaison ; retournement et présentation immédiats.

## Identifiants et étapes (`src/scene/core/ids.ts`)

Objets : ceux de l'étape 3, plus `netherbrain` et `homelab`.

| Étape          | Objets                             | Objet présenté (`STEP_ITEM`) | Puce                         |
| -------------- | ---------------------------------- | ---------------------------- | ---------------------------- |
| `defi-metiers` | `book`, `badge`                    | `book`                       | 2020, DEFI-METIERS           |
| `dares`        | `postit`, `headset`                | `postit`                     | 2024, DARES                  |
| `projects`     | `netherbrain`, `homelab`, `laptop` | `netherbrain`                | 2026, Netherbrain et Homelab |
| `perso`        | `chest`                            | `chest`                      | Projets perso                |
| `contact`      | `card`                             | `card`                       | Contact                      |

Le portable porte désormais la pile technique (section compétences du CV), dans l'étape `projects`. L'écran reste sans étape.

- `SHEET_ORDER` : l'ordre des fiches (Préc. / Suiv., flèches), en boucle : `book`, `badge`, `postit`, `headset`, `netherbrain`, `homelab`, `laptop`, `chest`, `card`, `monitor`. `neighborItem(item, 1 | -1)` donne le voisin.
- `BODY_IDS` : les corps glissables, `book`, `badge`, `laptop`, `card`, `chest`, `netherbrain`, `homelab`, `mug`, `pad` (`DECOR_BODY_IDS` : `mug`, `pad`). `isBodyId()`, types `BodyId`, `DecorBodyId`, `DraggableItemId`. Le post-it, le casque et l'écran ne glissent pas.
- `AUTO_SEQ` (`constants.ts`) : `book`, `postit`, `netherbrain`, `homelab`, `laptop`, `card`, `chest`. `AUTO_TIMING` inchangé (6 s par défaut, 6.6 pour le livre, 7.4 pour le coffret).
- `PresentSource` gagne `sheet` (Préc. et Suiv. de la fiche). `PresentMode` gagne `spin` (objet debout, demi-tour autour de la verticale : sa face locale `-z` vient vers la caméra quand il est retourné).

## Le store : ce qui s'ajoute

Réactif (`useSceneStore`) :

| Champ       | Sens                                                                                             | Écrit par                                    | Lu par                       |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------- |
| `flipped`   | l'objet présenté a fait son geste ; vrai à chaque `present()` (sauf l'écran), faux avec `?recto` | `present`, `toggleFlip` (gestes, fiches)     | présentation, HUD, fiche     |
| `dragging`  | le corps qu'on fait glisser, ou `null`                                                           | gestes (`startDrag`, `endDrag`)              | HUD, visite, cadrage         |
| `places`    | places des corps déplacés (`{ x, z, ry }`), copiées en fin de glisser                            | gestes (`endDrag`, `commitPlaces`), `replay` | HUD (`data-places`)          |
| `soundOn`   | le son est ouvert                                                                                | HUD (`toggleSound`)                          | HUD                          |
| `offscreen` | identifiants qui sortent du cadre au repos (corps, `monitor`, `headset`, `mic`, `lamp`)          | cadrage (`setOffscreen`, partie objets)      | HUD (`data-offscreen`)       |
| `lifeSigns` | signes de vie du coffret (`LifeSigns`), recalés sur l'heure du visiteur                          | `DeskShell` (`setLifeSigns`)                 | fiche du coffret, coffret 3D |

Actions : `toggleFlip()` (sans effet sur l'écran ; l'objet de la visite passe au visiteur), `startDrag(body)` (compte comme une action du visiteur, joue `slide`), `endDrag()`, `commitPlaces()`, `toggleSound()` (appelée seulement par un clic : crée l'AudioContext), `setOffscreen(ids)` (n'écrit que si la liste change), `setLifeSigns(signs)`. `present()` et `putBack()` jouent `pick` (`hum` pour l'écran) et `putBack`, `toggleLamp()` joue `switch` et `lampOn`. `replay()` remet tous les corps à leur place (`places` vide, `dragging` nul, `flipped` faux).

Mutable, lu dans `useFrame` avec `getState()`, jamais réactif :

- `desk: DeskBodies` : un `DeskBodyState` par corps, `{ x, z, ry, moved, lift, tiltX, tiltZ, squash }`. Les gestes l'écrivent à chaque image ; `usePresentation` (objets du CV) et `DeskBody` (tasse, manette) s'y posent. Le socle (`updateFrame`) cale avant tout le monde les corps non déplacés (`moved: false`) sur leur place de repos du format courant (`syncDeskBodies`).
- `sound: SoundPlayer` : `play(cue, strength?)` ne fait rien tant que le son est coupé.

Réglages (`settings`) : `recto` (`?recto`), `initialDrag` (`?glisse`, `{ item, x, z }` ou `null`).

## Le plateau vu de dessus (`src/scene/core/bodies.ts`)

Repère du prototype ; rotation `ry` dans le sens de three : un point local `(lx, lz)` va en `x = lx cos ry + lz sin ry`, `z = -lx sin ry + lz cos ry`.

Encombrement des corps (`BODY_FOOTPRINTS`, repère de l'objet : centre `cx`, `cz`, demi-côtés `hw` en x, `hd` en z) et places de repos :

| Corps         | Place (x, z, ry)   | `cx`, `cz` | `hw`, `hd`  |
| ------------- | ------------------ | ---------- | ----------- |
| `book`        | -3.25, 1.42, 0.2   | 0, 0       | 0.95, 1.25  |
| `badge`       | -1.25, 2.05, -0.32 | 0, 0       | 0.43, 0.62  |
| `laptop`      | 2.95, 1.42, -0.12  | 0, 0       | 1.35, 0.93  |
| `card`        | 0.52, 2.1, -0.05   | 0, 0       | 0.91, 0.575 |
| `chest`       | -4.45, -0.7, 0.35  | 0, -0.2    | 0.83, 0.54  |
| `netherbrain` | 0.75, 0.92, -0.15  | 0, 0       | 0.42, 0.42  |
| `homelab`     | -5.35, 0.7, 0.25   | 0, 0       | 0.5, 0.4    |
| `mug`         | 4.55, -0.62, 0     | 0.08, 0    | 0.4, 0.31   |
| `pad`         | 5.1, 1.95, 0.45    | 0, 0.08    | 0.68, 0.38  |

Obstacles fixes : `DECOR_OBSTACLES` (`src/scene/decor/layout.ts` : clavier, pavé, souris, pied de la lampe, pince du micro, corde, bandes, plante, mangas, deux figurines) et `FIXED_ITEM_OBSTACLES` (pied de l'écran, support du casque). Limites : `BOUNDS = { x0: -6.15, x1: 6.2, z0: -3.2, z1: 3.05 }`, qu'aucun coin ne dépasse. En portrait, `decorObstacles(true)`, `fixedItemObstacles(true)` et `deskBounds(true)` donnent le bureau resserré. Les lanières, câbles et tapis plats ne comptent pas.

Outils : `homePlace(id, portrait)`, `bodyObb(id, place)`, `obbCorners(box)`, `obbPenetration(a, b, margin)` (axe séparateur : 0 ou la profondeur), `obbOutside(box, bounds)`, `createDeskBodies`, `resetDeskBodies`, `syncDeskBodies`, `movedPlaces`, `formatPlaces`. `bodies.test.ts` vérifie qu'au repos rien ne se chevauche (écart de 0.02), en paysage et en portrait, et que tout tient dans les limites du format (`deskBounds(portrait)`).

`PORTRAIT_PLACES` (`core/framing.ts`) : les places du bureau resserré (portrait), décrites plus bas.

## Le bureau resserré du portrait

Décision d'Ali du 29/10 : sur téléphone en portrait, et seulement là, les objets et le décor se rangent sur une zone plus étroite et plus profonde. C'est la largeur qui fixe l'échelle du cadrage : plus étroit, le bureau grandit à l'écran et la bande de mur vide disparaît. Tout format sous `PORTRAIT_MAX_ASPECT` (0.9) en profite, tablette en portrait comprise (768x1024). Le paysage (téléphone couché, tablette, ordinateur) ne change pas d'un pixel.

- Zone des corps : `BOUNDS_PORTRAIT = { x0: -3.75, x1: 3.95, z0: -3.2, z1: 4.3 }` (7.7 de large au lieu de 12.35, 7.5 de profondeur au lieu de 6.25). Le plateau s'allonge vers le visiteur (`DESK_PORTRAIT_Z1` = 4.65, `decor/Room.tsx`).
- Places des corps (`PORTRAIT_PLACES`) :

| Corps         | x, z, ry         | Où                          |
| ------------- | ---------------- | --------------------------- |
| `chest`       | -2.8, -0.45, 0.1 | à gauche du clavier         |
| `book`        | -2.6, 2.05, 0.12 | à gauche, devant le coffret |
| `pad`         | -2.75, 3.82, 0   | avant gauche                |
| `netherbrain` | 0.35, 1.2        | devant le clavier           |
| `badge`       | -0.75, 1.75      | devant le clavier, à gauche |
| `card`        | -0.3, 3.6        | au bord avant, au milieu    |
| `mug`         | 3.45, -1.35      | à droite, devant le casque  |
| `homelab`     | 3.3, 0.75, -0.2  | à droite                    |
| `laptop`      | 2.45, 2.55       | avant droit                 |

- Le casque et son support passent à droite de l'écran (`HEADSET_PORTRAIT = { x: 3.5, z: -2.4, ry: -0.25 }`, décalé de 0.15 à l'étape 6 : un écouteur entrait dans la dalle de l'écran, `headsetStand(portrait)`, `headsetPose(portrait)`) : à gauche, l'abat-jour de la lampe le cachait.
- Le décor (`decor/layout.ts`) se découpe en morceaux rigides (`DecorPieceId` : lampe, micro, pavé de boutons, souris, corde, bandes, plante, mangas, renard, voyageur). Chaque morceau tourne de `ry` autour de son ancre (`DECOR_ANCHORS`, sa place en paysage), puis l'ancre va en (x, z) : `PORTRAIT_DECOR`. `DecorPiece` (`decor/DecorPiece.tsx`) dessine cette transformation, l'identité exacte en paysage ; ses obstacles (`decorObstacles(true)`) et ses points de cadrage (`decorExtentPortrait()`) suivent la même transformation (testé contre three). Le spot de la lampe et son cône (`stage/Lights.tsx`, `stage/LampCone.tsx`) suivent la lampe.
- En portrait : la lampe recule au fond à gauche (-2.4, -3.0, tournée de -0.75) ; la plante passe dans le coin du fond à gauche, où elle dépasse de l'abat-jour ; le pavé de boutons se pose derrière le clavier, à gauche de l'écran ; la souris se rapproche du clavier ; les mangas et le robot passent devant le clavier, à droite.
- Cachés en portrait, faute de place (jamais un objet du CV) : le micro sur son bras (il encombrait le bord gauche et sortait du cadre), la corde à sauter, les bandes, le renard et le voyageur. Liste testée (`layout.test.ts`).
- Changement d'orientation (`DragSim.reframe(world, desk, portrait)`, appelé par `Gestures`) : le monde du solveur passe à `deskWorld(portrait)` ; les corps jamais déplacés vont à leur place du format (`syncDeskBodies`) ; les corps déplacés gardent la leur, et le solveur range le plateau en les écartant d'abord, puis tous les corps. En dernier recours, un corps déplacé qui reste en recouvrement ou hors du plateau retourne à sa place du format. `drag.test.ts` tourne le téléphone dans les deux sens, avec des corps poussés aux bords et au hasard : jamais de recouvrement ni rien hors du plateau.
- Cadrage : `restPoints(true)` = les coins de `BOUNDS_PORTRAIT` (un corps glissé au bord reste à l'écran), le haut de l'écran, le bureau utile et le décor posé. `PORTRAIT_HUD.bottom` passe de 205 à 222 px : le haut de l'indication du HUD est à 211 à 218 px du bas, et la rangée avant passait dessous.
- Mesure : `OffscreenProbe` écrit `data-desk-share` sur le canvas, la part de la hauteur libre entre les bandes du HUD (`restLimits`) que couvre le bureau utile au repos (`screenShare`). `framing.test.ts` l'exige au-dessus de 0.65 sur sept portraits, avec le décor dans le cadre ; `scene-projets.spec.ts` la vérifie sur le profil téléphone en 390x844, 360x740 et 412x915.

Avant et après, au repos (bande : du bas de l'identité du HUD, à 112 px, au haut du bureau utile ; part : hauteur du bureau utile sur la hauteur libre) :

| Fenêtre         | Bureau avant | Bande avant | Part avant | Bureau après | Bande après | Part après |
| --------------- | ------------ | ----------- | ---------- | ------------ | ----------- | ---------- |
| 390x844         | 214 px       | 313 px      | 0.41       | 375 px       | 134 px      | 0.74       |
| 360x740         | 197 px       | 226 px      | 0.47       | 343 px       | 62 px       | 0.84       |
| 412x915         | 227 px       | 371 px      | 0.38       | 398 px       | 182 px      | 0.69       |
| 768x1024 (tab.) |              |             | 0.59       | 677 px       | 12 px       | 0.98       |

Ce qui reste de bande en 390x844 et 412x915 sert de scène à l'objet tenu ; sur ces fenêtres plus hautes, c'est encore la largeur qui fixe l'échelle.

## Le son (`src/scene/core/sound.ts`)

```ts
type SoundCue =
  | 'pick'
  | 'putBack'
  | 'flip'
  | 'thud'
  | 'slide'
  | 'lampOn'
  | 'switch'
  | 'tick'
  | 'rattle'
  | 'hum'
  | 'blip';
interface SoundPlayer {
  readonly enabled: boolean;
  setEnabled(on: boolean): boolean; // le premier true crée l'AudioContext
  play(cue: SoundCue, strength?: number): void; // muet tant que coupé
  dispose(): void;
}
```

Qui appelle quoi : le store (`pick`, `putBack`, `hum`, `flip`, `slide`, `switch`, `lampOn`, `blip` à l'ouverture), le décor (`tick` à chaque clic d'un élément, `blip` pour le micro), les gestes (`thud` avec la force du choc, 0 à 1), les objets s'ils le veulent (`rattle` pour le coffret). Personne ne connaît la synthèse : `DeskShell` crée le store avec `createWebAudioSound()` (`src/components/desk/sound.ts`, partie fiches), les tests avec `createSilentSound()` (qui retient `played`).

## Les signes de vie (`src/lib/life-signs/`)

```ts
interface LifeSigns {
  running: number; // projets en marche
  lastActivityAt: string; // ISO 8601
  since: string; // ISO 8601, premier jour
  activity: readonly number[]; // LIFE_SIGNS_DAYS (14) jours, du plus ancien au jour de la mesure
  measuredAt: string; // ISO 8601
  sample: boolean; // données d'exemple
}
```

- `sample.ts` : `SAMPLE_LIFE_SIGNS` et `sampleLifeSigns(now)`, signalés comme données d'exemple (valeurs du prototype : 3 projets, 2 h 14, 47 jours).
- `source.ts` : `getLifeSigns(now?)`, le point d'entrée du serveur. Depuis l'étape 5 : le JSON public (`LIFE_SIGNS_URL`), validé par `schema.ts`, avec repli sur l'exemple ; partagé par la page (régénérée toutes les 10 minutes) et `/api/signes-de-vie`. Le navigateur les rafraîchit à l'ouverture du coffret (`src/components/desk/lifeSignsRefresh.ts`). Voir [`routes-serveur.md`](routes-serveur.md).
- `types.ts` : `rebaseLifeSigns(signs, now)` recale l'exemple sur l'heure du visiteur (la page est rendue au build) ; `activityPulse(signs)` donne `{ period, strength }` du battement du coffret (de 3.4 s et 0.35 au calme à 1.6 s et 1 quand les trois derniers jours sont les plus actifs).
- `format.ts` : `formatLifeSigns(signs, now, texts, locale)` donne `{ running, lastActivity, since, activity, max, chartLabel, axisStart, axisEnd, sample }` ; `agoText()` pour « il y a 2 h 14 » ou « 2 h 14 min ago ». Gabarits dans `content.sheets.ui.live`.

Chemin : `page.tsx` (serveur) appelle `getLifeSigns()` et passe le résultat à `DeskShell` (prop `lifeSigns`), qui le met dans le store (`createSceneStore(mood, { sound, lifeSigns })`, puis `setLifeSigns(rebaseLifeSigns(...))` côté client). La fiche et le coffret lisent `store.lifeSigns`. La règle ESLint reste respectée : `src/lib/life-signs` n'importe ni zod ni le contenu.

## Les textes (`src/content`)

Tout est écrit et testé par le socle ; les parties ne touchent pas `src/content`.

- `content.sheets` (`src/content/sheets/`) : `ui` (libellés de la fiche, `flipKey`, `contact`, `repository`, `sound`, `live` pour les signes de vie) et `items`, une fiche par objet dans l'ordre de `SHEET_ORDER` : `{ kicker, step, title, meta: { term, value, href? }[], body, note? }`. `sheets.test.ts` compare chaque fait au CV (périodes au mois près, rôles, organisations, pile groupe par groupe, projets, contact) et refuse tout lien vers un dépôt.
- Côté HUD : `DeskHudTexts.sheets` (`buildDeskSheets` dans `src/lib/desk.ts`) ajoute `contactHref` (`/fr/express#contact`) et, par fiche, `repository: { label, href } | null`, non nul seulement si `repository.public`.
- `content.desk.hint` gagne `held: { pointer, touch }` (comment retourner l'objet tenu) ; `pointer` et `touch` parlent du glisser.
- `content.scene` : étiquettes `netherbrain` et `homelab` (« 2026 »), celle du portable devient « Pile | Compétences » ; `scene.netherbrain.label` (nom, accroche, année, pile, tests) et `scene.homelab` (nom, `units.server`, `units.firewall`, `access`), comparés au CV.
- Coffret : le test des mots interdits couvre `desk`, `scene` et `sheets`.

## Paramètres de test (nouveaux)

| Paramètre               | Effet                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `?prendre=card&recto`   | présente l'objet sans son geste (`flipped` faux)                                      |
| `?glisse`               | glisse le portable vers (-0.3, 2.15), sur la carte, comme le prototype, puis le lâche |
| `?glisse=mug:1.5,-0.25` | glisse un corps (`BODY_IDS`) vers une place ; collisions comprises                    |

`?glisse` et `?prendre` empêchent la visite automatique. Sous `&fige`, le glisser demandé se pose aussitôt dans son état final (même règle que la présentation). Le socle lit `?glisse` (`settings.initialDrag`) ; la partie gestes le joue.

## État exposé aux tests

Sur `#hud`, en plus de ceux de l'étape 3 :

| Attribut         | Valeur                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- |
| `data-flipped`   | `true` si un objet est présenté et retourné, sinon `false`                             |
| `data-dragging`  | le corps qui glisse, ou vide                                                           |
| `data-sound`     | `on` ou `off`                                                                          |
| `data-places`    | `id:x,z,ry` des corps déplacés, séparés par des espaces, au centième, ordre `BODY_IDS` |
| `data-offscreen` | identifiants hors du cadre au repos, séparés par des espaces (vide : tout tient)       |

Sur le canvas : `data-offscreen-probes` (nombre de relevés au repos) et `data-desk-share` (part de la hauteur libre couverte par le bureau au repos, trois décimales).

La fiche : `#sheet` porte `data-open` (`true` ou `false`) et `data-sheet` (l'objet, ou vide). Pas `data-item` : les étiquettes le portent déjà. Le bouton du son porte `aria-pressed` et `data-sound-toggle`.

## Priorités de `useFrame`

| Priorité | Qui                                                                |
| -------- | ------------------------------------------------------------------ |
| -100     | socle : horloge, `frame`, `syncDeskBodies`                         |
| -95      | mise en scène : visite automatique                                 |
| -90      | caméra (partie objets à l'étape 4)                                 |
| -80      | lumières, ciel, lumière de la fenêtre                              |
| -12      | gestes : glisser et solveur, écrivent `desk` (`GESTURES_PRIORITY`) |
| -11      | objets : matrices de la caméra                                     |
| -10      | présentation (`usePresentation`), écran, étiquettes ; effets       |
| -9       | `presentLevel`                                                     |
| -8       | cadrage : relevé de ce qui sort du cadre (`OFFSCREEN_PRIORITY`)    |
| 0        | décor, et `DeskBody` (tasse, manette)                              |
| 1        | rendu du post-traitement                                           |

## Fichiers de chaque partie

Aucun fichier n'a deux propriétaires. Un besoin hors de ses fichiers se note pour l'assemblage.

| Partie | Fichiers                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gestes | `src/scene/gestures/**` (`Gestures.tsx`, `DeskBody.tsx`, `priorities.ts`, et ses nouveaux modules : solveur, glisser, tests) ; `src/scene/items/usePresentation.ts`, `presentation.ts`, `presentation.test.ts` ; `tests/e2e/scene-gestes.spec.ts` ; dans `tests/e2e/scene-objets.spec.ts`, seulement le test « se survolent à la souris et se présentent au clic » (un clic sur l'objet tenu le retourne au lieu de le reposer)                   |
| fiches | `src/components/desk/Hud.tsx`, `Sheet.tsx`, `sound.ts`, `Desk.module.css`, et ses nouveaux fichiers dans `src/components/desk/` (sauf `DeskShell.tsx`, `Grain.tsx`, `SceneBoundary.tsx`) ; `tests/e2e/scene-fiches.spec.ts`                                                                                                                                                                                                                       |
| objets | `src/scene/items/**` sauf `usePresentation.ts`, `presentation.ts`, `presentation.test.ts`, `CvItems.tsx`, `TagLayer.tsx`, `TagLayer.module.css` ; `src/scene/core/framing.ts` ; `src/scene/stage/framing.ts`, `framing.test.ts`, `CameraRig.tsx`, `OffscreenProbe.tsx` ; les entrées `netherbrain` et `homelab` de `ITEM_POSES` (`constants.ts`) et de `BODY_FOOTPRINTS` (`bodies.ts`), `bodies.test.ts` vert ; `tests/e2e/scene-projets.spec.ts` |
| socle  | tout le reste, figé : `src/scene/core/**` (hors ce qui précède), `Scene.tsx`, `CvItems.tsx`, `TagLayer.*`, `src/scene/decor/**`, le reste de `src/scene/stage/`, `DeskShell.tsx`, `src/lib/**`, `src/content/**`, `src/app/**`, les autres tests                                                                                                                                                                                                  |

Squelettes à remplacer, qui marchent déjà :

- gestes : `Gestures` (ne fait rien), `DeskBody` (suit `desk` sans gestionnaire) ; `usePresentation` lit déjà `desk` et `flipped`, et un clic sur l'objet tenu le repose encore.
- fiches : `Sheet` (titre et « Reposer »), `createWebAudioSound()` (muet, sans AudioContext), le bouton « Son » du HUD.
- objets : `Netherbrain` et `Homelab` (boîtes à leur place, qui se présentent, étiquetées), `OffscreenProbe` (relevé simple), le coffret qui bat sur un rythme fixe.

## Ports

| Partie     | `next dev` | E2E (`E2E_PORT`) |
| ---------- | ---------- | ---------------- |
| gestes     | 3401       | 3411             |
| fiches     | 3402       | 3412             |
| objets     | 3403       | 3413             |
| assemblage | 3420       | 3100 (défaut)    |
| relecture  | 3430       | 3432             |

```bash
git worktree add .claude/worktrees/gestes -b feat/gestes-gestes feat/gestes
cd .claude/worktrees/gestes && npm ci
npm run dev -- --port 3401
npm run build && E2E_PORT=3411 npx playwright test tests/e2e/scene-gestes.spec.ts --workers=2
```

Pendant que les trois parties tournent, chacune lance Playwright avec `--workers=2` au plus et seulement sur ses fichiers ; la suite complète est le travail de l'assemblage. Captures : `scripts/capture.mjs`, hors du dépôt.

## Feuille du bas sur téléphone

`SHEET` (`constants.ts`) : en portrait, la fiche monte du bas et ne dépasse jamais `SHEET.portrait.maxHeight` (0.42) de la hauteur de la fenêtre ; le cadrage (`HELD.portrait`) pose l'objet tenu au-dessus. En paysage, elle reste à droite, au plus `SHEET.landscape.maxWidth` (400 px) et `SHEET.landscape.maxFraction` (0.36) de la largeur ; l'objet tenu est à gauche du centre (`HELD.landscape.x = -0.3`).

## Décisions du socle

- Un objet présenté fait son geste d'office, comme dans le prototype et à l'étape 3 : `flipped` vaut vrai à chaque présentation, le premier clic le remet à l'endroit. `?recto` montre l'endroit.
- Le coffret ne change plus de place en portrait : son encombrement réel mordait sur le support du casque et le pavé. Depuis le bureau resserré (29/10), tous les corps ont une place en portrait, coffret compris.
- La fiche porte `data-sheet`, pas `data-item`, que les étiquettes portent déjà (les sélecteurs des tests de l'étape 3 auraient trouvé deux éléments).
- Netherbrain se pose devant le clavier, à droite de la lanière du badge ; Homelab à l'avant gauche, entre la corde, le coffret et le livre. Ce sont les deux seules places libres du plateau sans toucher au décor.
- L'écran a sa fiche (le profil et les dates) et ferme la boucle de `SHEET_ORDER`.
- La visite passe par les deux nouveaux objets et par le portable (la pile) : 7 objets.

## Décisions des parties

Gestes (`src/scene/gestures/`) :

- `gestureHub(store)` (`hub.ts`, un par store, dans une `WeakMap`) porte ce que partagent les gestes et les objets : l'appui en cours, le glisser (`DragSim`), le pointeur lissé que l'objet tenu suit (0 au doigt), et l'avancement de la présentation de chaque objet, écrit par `usePresentation` : un objet présenté, ou qui revient, ne compte pas dans les collisions.
- Les gestes écoutent eux-mêmes `pointerdown` et `pointermove` sur le canvas, `pointerup` et `pointercancel` sur la fenêtre : React Three Fiber ne compte un clic qu'en deçà de 2 px, le seuil du glisser est de 7 px (`DRAG.threshold`). Un appui qui a parcouru 7 px ou plus n'est jamais un clic : le clic qui suit est avalé en phase de capture sur la fenêtre, avant React Three Fiber (ni présentation, ni réaction du décor). Un appui bougé de 2 à 7 px hors des objets repose quand même l'objet tenu.
- `claimBody` (`pointer.ts`) n'attribue l'appui à un corps que s'il est le premier objet sous le pointeur : la lampe ou l'objet tenu devant lui ne font pas glisser ce qui est derrière.
- Un glisser qui commence alors qu'un objet est tenu le repose (le prototype le laissait en main) : un glisser ne présente rien, et la fiche ne parle jamais d'un autre objet que celui qu'on tient.
- Solveur (`solver.ts`, pur, sans three) : axe séparateur sur les quatre axes, relaxation bornée à 8 itérations (le corps tenu reste immobile face aux autres, qui se poussent en chaîne), voisinage limité aux corps et obstacles à portée du pas. `moveBody` avance par sous-pas d'au plus `MAX_STEP` (0.12, pas de tunnel) ; un pas qui créerait un recouvrement est refusé, puis il tente de glisser le long de l'obstacle (x seul, z seul), puis un quart de pas. Un état valide reste valide. `CONTACT_MARGIN` = 0.012. `DESK_WORLD` (`drag.ts`) = `DECOR_OBSTACLES` + `FIXED_ITEM_OBSTACLES` + `BOUNDS` ; `deskWorld(portrait)` donne celui du format (le bureau resserré en portrait).
- `DragSim` (`drag.ts`, réglages du prototype dans `DRAG`) : retard sur la main, soulèvement de 0.32, inclinaison selon la vitesse (0.05 par unité, au plus 0.3), un seul `thud` par contact ; au lâcher, chute, rebond et écrasement, `thud` selon la force. `endDrag` est appelé au lâcher : x et z ne bougent plus, le rebond n'est que visuel. Un objet reposé sur une place prise pendant sa présentation est écarté (relaxation, puis place libre la plus proche).
- `?glisse` animé : le corps est lâché arrivé, bloqué depuis 0.4 s, ou au bout de 3 s ; sous `&fige` ou en mouvement réduit, l'état final est posé dans la même image.
- Objet tenu : un clic dessus appelle `toggleFlip` (l'écran, lui, quitte le gros plan) ; il se décale vers le pointeur de `HELD_FOLLOW` (0.025 de sa distance à la caméra), en plus de pencher. En mode `shake`, la secousse du coffret est multipliée par `f` : retourné il tremble, remis à l'endroit il est calme.
- `usePressable` (décor) garde son seuil de 9 px pour un clic : sans effet, le clic étant avalé dès 7 px.

Fiches et son (`src/components/desk/`) :

- `Sheet` prend `texts`, `locale` et `onAnnounce` (la région `status` du HUD). Bouton « Retourner » (`aria-pressed`, `aria-keyshortcuts="R"`, absent pour l'écran) ; Préc. et Suiv. passent par `neighborItem` et `present(id, 'sheet')`. Flèches et `R` tant que la fiche est ouverte, ignorées avec Ctrl, Alt ou Meta et dans un champ ; `R` est le seul écouteur du raccourci. Échap reste dans `DeskShell`.
- Focus : ouverte au clavier, la fiche le prend sur son titre (`tabIndex -1`) et le rend à l'élément d'où il venait, sinon à la puce de l'étape. Ouverte au pointeur ou par la visite, elle le laisse où il est.
- La fiche s'appelle `.bristol` en CSS : `.sheet` reste le cadre du repli (version express).
- Sous `?fige`, l'animation d'entrée de la fiche est coupée (sinon elle resterait gelée à opacité 0) : toute nouvelle animation d'entrée du HUD a le même piège.
- L'indication du HUD (`#hud p[data-on]`, seul de son espèce) se découpe en phrases, une par ligne sur téléphone ; avec la fiche ouverte, elle se centre à gauche de la fiche sous 1300 px et se masque en portrait.
- Signes de vie : `lifeSignsView.ts` (pur, testé) appelle `formatLifeSigns` et résiste aux données mal formées ; l'horloge de la fiche avance par pas de 20 s et ne remonte jamais avant `measuredAt`.
- `createWebAudioSound()` : les 11 sons d'après `Snd` du prototype, un souffle de pièce et un compresseur, sans fichier. L'AudioContext naît au premier `setEnabled(true)` ; couper met le gain à 0 et suspend le contexte. La préférence du son n'est pas gardée d'une page à l'autre : la rouvrir sans clic créerait un AudioContext sans geste du visiteur.

Objets et cadrage (`src/scene/items/`, `src/scene/stage/`) :

- Netherbrain : bocal de verre teinté, couvercle et socle en laiton, cerveau en icosaèdre déformé dont l'émissif respire (`breath`), halo additif ; retourné (`spin`), l'étiquette enroulée au dos (nom, accroche, année, pile, tests). Homelab : baie de 10 pouces fusionnée en un appel de dessin, 14 LED sur un `InstancedMesh`, déterministes (`items/homelab.ts`, `ledLevel(t)`), figées sous `&fige`, allumées sans clignoter en mouvement réduit ; au dos, trois étiquettes à pictogramme sans logo réel. Aucune lumière ponctuelle ajoutée (chaque lumière recompile tous les matériaux).
- Coffret : LED, liseré et lueur battent selon `activityPulse(store.lifeSigns)` (`heartbeat`, `items/beats.ts`), sans battement en mouvement réduit ; `rattle` au début de chaque à-coup quand il est tenu et retourné.
- Cadrage : `fitRestView(aspect, size)` cadre `REST_FIT` plus tout le bureau utile, `deskExtent(portrait)` (les 8 coins de chaque corps à sa place, hauteurs `BODY_HEIGHTS`, et les points fixes `FIXED_EXTENT` : haut de l'écran, casque, micro, lampe). En portrait, les limites se calculent en pixels d'après `PORTRAIT_HUD` (112 px en haut, 222 px en bas, calés sur le HUD actuel : à recaler si sa hauteur change), le bas du bureau se pose sur le HUD du bas (`align: 'bottom'`), `REST.portrait` passe à `elev` 0.85 et `fov` 40, et `camera.far` suit la distance (au moins 90). Le paysage ne change pas.
- `HELD.portrait` = `{ x: 0, y: 0.3, fracH: 0.34, fracW: 0.9 }` : l'objet tenu se tient de -0.04 à 0.64 en y, au-dessus de la feuille du bas (42 %), qui doit rester sous 0.58 de la hauteur.
- `OffscreenProbe` reprend les points du cadrage sur les places du moment ; il écrit `data-offscreen-probes` (nombre de relevés) sur le canvas, pour qu'un test sache qu'une liste vide vient d'une mesure, et `data-desk-share` (bureau resserré).
- `ITEM_POSES.netherbrain.hold` = `{ w: 1.4, h: 1.85, oy: 0.55 }`, `homelab.hold` = `{ w: 1.9, h: 1.85, oy: 0.46 }`. `MergedParts` et `mergeColored` (`merged.tsx`) fusionnent des géométries quelconques.
