import type { ItemId, MoodId } from './ids';

// Constantes du prototype (prototype/bureau-plateau.html), portées telles
// quelles. Repère : le plateau du bureau est en y = 0, x va de -6.6 (gauche)
// à 6.6 (droite), z de -3.55 (mur du fond) à 3.4 (bord avant, côté visiteur).
// Les unités sont celles du prototype (environ 10 cm). Aucune dépendance à
// three : ce module sert aussi au HUD et aux tests.

export type Vec3 = readonly [x: number, y: number, z: number];

// ------------------------------------------------------------------
// Le bureau, le mur et la fenêtre
// ------------------------------------------------------------------

/** Le plateau du bureau, vu de dessus. */
export const DESK = { x0: -6.6, x1: 6.6, z0: -3.55, z1: 3.4 } as const;

/** Épaisseur du plateau (sa face supérieure est en y = 0). */
export const DESK_THICKNESS = 0.36;

/** Ouverture de la fenêtre dans le mur du fond. */
export const WIN = { x0: -6.3, x1: -2.5, y0: 0.62, y1: 4.5, z: -3.62 } as const;

/** Plan du mur du fond. */
export const WALL_Z = -3.66;

/**
 * Le ciel derrière la vitre : un plan centré en position, de taille size,
 * un peu plus grand que l'ouverture. La mise en scène le peint (Sky.tsx), le
 * décor met un fond sombre derrière (WINDOW_BACKSTOP).
 */
export const WINDOW_SKY = {
  position: [(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z - 0.55] as Vec3,
  size: [WIN.x1 - WIN.x0 + 0.4, WIN.y1 - WIN.y0 + 0.4] as const,
} as const;

/** Le sol, sous le bureau. */
export const FLOOR_Y = -3.2;

/** Couleur de fond de la scène, et du fond de la page derrière le canvas. */
export const BACKGROUND = 0x0e0a08;

// ------------------------------------------------------------------
// Le matériel fixe partagé entre les parties
// ------------------------------------------------------------------

/** La lampe d'architecte : pied, coude, tête et point visé sur le plateau. */
export const LAMP = {
  base: [-4.9, 0, -2.95],
  elbow: [-4.55, 2.75, -2.55],
  head: [-3.05, 3.55, -0.75],
  aim: [-2.35, 0, 0.95],
} as const satisfies Record<string, Vec3>;

/**
 * L'écran principal : position du pied, hauteur et inclinaison de la dalle.
 * La dalle (monTilt dans le prototype) est un groupe placé en (0, tiltY, 0)
 * dans le groupe de l'écran, tourné de tiltX autour de x.
 */
export const MONITOR = {
  position: [0.3, 0, -2.78],
  tiltY: 2.32,
  tiltX: -0.17,
  frame: { width: 5.0, height: 2.92 },
  screen: { width: 4.82, height: 2.72 },
} as const;

/** Le clavier, posé devant l'écran. */
export const KEYBOARD: Vec3 = [0.3, 0, -0.58];

// ------------------------------------------------------------------
// Les objets du CV
// ------------------------------------------------------------------

/**
 * Comment un objet se présente une fois soulevé devant la caméra, et ce que
 * fait son geste (retourner) : open (le livre s'ouvre), flip (un objet plat se
 * retourne), laptop (s'ouvre), turn (le casque tourne sur lui-même), spin
 * (un objet debout fait un demi-tour pour montrer son dos : le bocal, la
 * baie, l'usine), screen (la caméra s'approche de l'écran).
 */
export type PresentMode = 'open' | 'flip' | 'laptop' | 'turn' | 'spin' | 'screen';

export interface ItemPose {
  /** Position de repos sur le bureau (y = hauteur du bas de l'objet). */
  x: number;
  y: number;
  z: number;
  /** Rotation autour de l'axe vertical. */
  ry: number;
  /** Encombrement pour la présentation : largeur et hauteur à l'écran, décalage vertical. */
  hold: { w: number; h: number; oy?: number };
  mode: PresentMode;
  /** Point d'accroche de l'étiquette, dans le repère de l'objet. */
  tag: { y: number; z: number } | null;
}

/**
 * Poses des objets du CV. Le post-it est collé au
 * cadre de l'écran (voir POSTIT_ON_MONITOR) : sa position ici n'est qu'un
 * repli. Le coffret change de place en portrait (PORTRAIT_PLACES). Netherbrain
 * et Homelab prennent deux places libres : le bocal devant le
 * clavier, à droite de la lanière du badge ; la baie à l'avant gauche, entre
 * le pendule, le coffret et le livre (bodies.test.ts vérifie qu'aucun
 * encombrement ne se chevauche).
 */
export const ITEM_POSES = {
  book: {
    x: -3.25,
    y: 0,
    z: 1.42,
    ry: 0.2,
    hold: { w: 3.9, h: 2.6 },
    mode: 'open',
    tag: { y: 0.6, z: -1.1 },
  },
  badge: {
    x: -1.25,
    y: 0,
    z: 2.05,
    ry: -0.32,
    hold: { w: 1.1, h: 2.3, oy: 0.5 },
    mode: 'flip',
    tag: null,
  },
  postit: {
    x: 2.42,
    y: 1.27,
    z: -2.5,
    ry: 0,
    hold: { w: 0.82, h: 0.82 },
    mode: 'flip',
    // Sous le post-it, et non au-dessus comme dans le prototype : au-dessus,
    // l'étiquette cachait la fin des lignes de code de l'écran.
    tag: { y: 0.05, z: 0.9 },
  },
  headset: {
    x: -2.72,
    y: 1.08,
    z: -0.78,
    ry: 0.25,
    hold: { w: 1.95, h: 1.95 },
    mode: 'turn',
    tag: null,
  },
  // Le boîtier d'accès au CASD (DARES), derrière le clavier, à droite du pied
  // de l'écran, sous le post-it : les deux objets de DARES côte à côte.
  casd: {
    x: 2.1,
    y: 0,
    z: -1.85,
    ry: -0.18,
    hold: { w: 2.1, h: 1.6, oy: 0.18 },
    mode: 'spin',
    tag: null,
  },
  laptop: {
    x: 2.95,
    y: 0,
    z: 1.42,
    ry: -0.12,
    hold: { w: 3.1, h: 3.3, oy: 0.8 },
    mode: 'laptop',
    tag: { y: 0.3, z: -0.85 },
  },
  card: {
    x: 0.52,
    y: 0.045,
    z: 2.1,
    ry: -0.05,
    hold: { w: 1.75, h: 1.05 },
    mode: 'flip',
    tag: { y: 0.15, z: -0.5 },
  },
  chest: {
    x: -4.45,
    y: 0,
    z: -0.7,
    ry: 0.35,
    hold: { w: 2.5, h: 2.3, oy: 0.42 },
    mode: 'spin',
    tag: { y: 1.0, z: -0.3 },
  },
  monitor: {
    x: 0.3,
    y: 0,
    z: -2.78,
    ry: 0,
    hold: { w: 5.0, h: 2.92 },
    mode: 'screen',
    tag: null,
  },
  netherbrain: {
    x: 0.75,
    y: 0,
    z: 0.92,
    ry: -0.15,
    hold: { w: 1.4, h: 1.85, oy: 0.55 },
    mode: 'spin',
    // En arrière du bocal, comme les autres : au-dessus, elle cachait son couvercle.
    tag: { y: 1.15, z: -0.55 },
  },
  homelab: {
    x: -5.35,
    y: 0,
    z: 0.7,
    ry: 0.25,
    hold: { w: 1.9, h: 1.85, oy: 0.46 },
    mode: 'spin',
    tag: { y: 1.05, z: -0.6 },
  },
} as const satisfies Record<ItemId, ItemPose>;

/** Le post-it du CV, collé en bas à droite du cadre : position et rotation dans le repère de la dalle. */
export const POSTIT_ON_MONITOR = {
  position: [2.12, -1.08, 0.1] as Vec3,
  rotation: [Math.PI / 2, -0.1, 0] as Vec3,
} as const;

/** Le support du casque, sur lequel le casque est posé. */
export const HEADSET_STAND: Vec3 = [-2.72, 0, -0.78];

/**
 * Le casque et son support en portrait (bureau resserré) : à droite de
 * l'écran (à gauche, la lampe passe juste devant lui et le cachait), tourné
 * de profil, un écouteur devant l'autre. De face, ses écouteurs élargissaient
 * le bureau et le premier entrait dans la dalle de l'écran.
 */
const HEADSET_PORTRAIT = { x: 3.2, z: -2.15, ry: 1.25 } as const;

/** Le pied du support du casque, selon le format. */
export const headsetStand = (portrait: boolean): Vec3 =>
  portrait ? [HEADSET_PORTRAIT.x, 0, HEADSET_PORTRAIT.z] : HEADSET_STAND;

/** La pose de repos du casque sur son support, selon le format. */
export const headsetPose = (portrait: boolean): Pick<ItemPose, 'x' | 'y' | 'z' | 'ry'> =>
  portrait ? { ...HEADSET_PORTRAIT, y: ITEM_POSES.headset.y } : ITEM_POSES.headset;

/**
 * Limites du plateau pour poser ou glisser un objet : aucun rectangle
 * d'encombrement (voir bodies.ts) n'en sort.
 */
export const BOUNDS = { x0: -6.15, x1: 6.2, z0: -3.2, z1: 3.05 } as const;

/** Des limites du plateau : x de x0 à x1, z de z0 à z1. */
export interface DeskBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * Le bureau resserré du téléphone en portrait :
 * les objets et le décor se rangent sur une zone plus étroite et plus
 * profonde, pour que le bureau grandisse à l'écran. Le plateau s'allonge
 * vers le visiteur (DESK_PORTRAIT_Z1, ses côtés sortent du cadre) et les
 * objets restent dans BOUNDS_PORTRAIT. Le paysage ne change pas.
 */
export const DESK_PORTRAIT_Z1 = 5.25;
export const BOUNDS_PORTRAIT = { x0: -2.75, x1: 3.35, z0: -3.2, z1: 4.9 } as const;

/** Les limites du plateau du format. */
export const deskBounds = (portrait: boolean): DeskBounds => (portrait ? BOUNDS_PORTRAIT : BOUNDS);

// ------------------------------------------------------------------
// Le temps : arrivée, mode auto
// ------------------------------------------------------------------

/** Fin de la séquence d'arrivée (secondes). */
export const SETTLE = 10.4;

/** Début de la visite automatique (secondes). */
export const AUTO_START = 12.6;

/** Secondes sans action du visiteur avant la reprise du mode auto. */
export const IDLE_DELAY = 12;

/**
 * L'ordre de la visite automatique : les deux postes, les deux projets, la
 * pile technique, le contact, puis le coffret.
 */
export const AUTO_SEQ = [
  'book',
  'postit',
  'casd',
  'netherbrain',
  'homelab',
  'laptop',
  'card',
  'chest',
] as const satisfies ItemId[];

/** Durées de la visite automatique (secondes). */
export const AUTO_TIMING = {
  /** Temps de présentation d'un objet (la fiche s'ouvre avec lui). */
  hold: { book: 6.6, chest: 7.4, default: 6.0 },
  /** Pause entre deux objets. */
  gap: 1.9,
  /** Pause avant de reprendre la boucle au début. */
  loopPause: 6.5,
  /** Délai avant la première présentation quand le mode auto reprend. */
  resume: 0.6,
} as const;

/**
 * Les temps de l'arrivée (secondes depuis l'ouverture de la page). Les
 * niveaux qui en dérivent sont calculés dans arrival.ts.
 */
export const ARRIVAL = {
  /**
   * Le clic de l'interrupteur, puis la lampe qui s'allume : en dernier, une
   * fois tous les objets tombés à leur place (DROP, core/drop.ts).
   */
  lampOn: 3.1,
  /** La montée de la caméra, pendant la chute des objets. */
  cameraStart: 0.2,
  cameraEnd: 9.7,
  /** Le carton « Bienvenue chez Ali ». */
  cartonIn: 3.4,
  cartonOut: 6.6,
  /** L'écran se réveille. */
  screenOn: 3.75,
  screenFull: 4.3,
  /** La LED du clavier. */
  keyboardLedOn: 3.9,
  keyboardLedFull: 4.25,
  /** Le code se tape à l'écran, en caractères par seconde. */
  typingStart: 4.3,
  typingRate: 150,
  /** La ligne finale, tapée puis effacée en boucle. */
  extraLineStart: 9.6,
  extraLineLoop: 16,
  /** Les LED du pavé de boutons, une à une. */
  deckLedsStart: 4.7,
  deckLedsStep: 0.085,
  /** La caméra posée sur l'écran. */
  webcamLed: 5.7,
  /** Le panneau de lumière. */
  panelOn: 6.0,
  panelFull: 6.25,
  /** L'anneau du micro. */
  micRing: 6.4,
  /** La LED du casque. */
  headsetLed: 6.55,
  /** L'usine se met en marche. */
  chestLed: 6.75,
  /** La LED de la manette. */
  padLed: 6.9,
  /** La lumière de la fenêtre arrive. */
  windowStart: 6.3,
  windowEnd: 9.2,
  /** La lumière d'ambiance monte depuis la pénombre de la chute. */
  ambientStart: 0,
  ambientEnd: 9.2,
  /** L'identité (haut de page), puis les puces du CV (bas de page) reviennent. */
  brandIn: 8.0,
  chipsIn: 8.6,
  /** Les étiquettes des objets apparaissent. */
  tagsIn: 9.0,
  /** Le léger mouvement de caméra qui suit le pointeur. */
  parallaxStart: 9.6,
  parallaxEnd: 11,
} as const;

/**
 * La chute de l'arrivée (core/drop.ts) : le premier objet part à start, les
 * suivants toutes les step secondes ; chacun tombe de height en fall
 * secondes, penché de tilt radians, puis rebondit de rebound en bounce
 * secondes. La lampe, dernière de la liste, se pose juste avant lampOn.
 */
export const DROP = {
  start: 0.3,
  step: 0.11,
  fall: 0.45,
  height: 2.2,
  tilt: 0.35,
  bounce: 0.18,
  rebound: 0.07,
} as const;

/**
 * Fin de la frappe du code à l'écran tant que l'écran ne l'a pas donnée
 * (frame.typingEnd) : environ 480 caractères à ARRIVAL.typingRate.
 */
export const TYPING_END_DEFAULT = ARRIVAL.typingStart + 3.2;

/** Durée d'une transition entre deux ambiances (secondes). */
export const MOOD_TRANSITION = 1.4;

// ------------------------------------------------------------------
// Les ambiances
// ------------------------------------------------------------------

/**
 * Les quatre ambiances du prototype. Couleurs en hexadécimal sRGB,
 * intensités telles qu'écrites pour three r128 (sans gestion des couleurs ni
 * lumières physiques) : la mise en scène les recalibre (stage/lighting.ts).
 */
export interface MoodSettings {
  /** Couleur et intensité du soleil (lumière directionnelle). */
  sunColor: number;
  sun: number;
  /** Direction de la lumière, du soleil vers le bureau. */
  dir: Vec3;
  /** Tache de lumière de la fenêtre sur le plateau, et rais dans l'air. */
  patch: number;
  patchOpacity: number;
  shaft: number;
  /** Lumière d'hémisphère : ciel, sol, intensité. */
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  /** Multiplicateur de la lampe. */
  lamp: number;
  /** Teinte du mur du fond. */
  wall: number;
  /** Couleur de fond. */
  background: number;
  /** Densité de la poussière dans la lumière. */
  dust: number;
}

export const MOODS = {
  morning: {
    sunColor: 0xffd9a6,
    sun: 0.3,
    dir: [0.55, -1, 1.05],
    patch: 0xffd49a,
    patchOpacity: 0.55,
    shaft: 0.05,
    hemiSky: 0xb7c4d4,
    hemiGround: 0x3a2618,
    hemi: 0.34,
    lamp: 1.25,
    wall: 0xa48870,
    background: 0x18110c,
    dust: 0.7,
  },
  afternoon: {
    sunColor: 0xfff2dc,
    sun: 0.42,
    dir: [0.18, -1, 0.62],
    patch: 0xfff0d4,
    patchOpacity: 0.62,
    shaft: 0.045,
    hemiSky: 0xc8d2de,
    hemiGround: 0x3e2a1a,
    hemi: 0.42,
    lamp: 1.05,
    wall: 0xb09478,
    background: 0x1c140e,
    dust: 0.55,
  },
  evening: {
    sunColor: 0xff9a5c,
    sun: 0.3,
    dir: [0.85, -1, 1.0],
    patch: 0xff9a58,
    // 0.6 dans le prototype : le soleil du soir, passé en linéaire, éclaire
    // moins le plateau, et la tache orange sous la fenêtre se perdait.
    patchOpacity: 1.1,
    shaft: 0.06,
    hemiSky: 0x9a7f8f,
    hemiGround: 0x2e1c12,
    hemi: 0.28,
    lamp: 1.3,
    wall: 0x8e6c58,
    background: 0x150e0a,
    dust: 0.85,
  },
  night: {
    sunColor: 0x9ab8e8,
    sun: 0.14,
    dir: [0.3, -1, 0.75],
    patch: 0x7d9fd8,
    patchOpacity: 0.3,
    shaft: 0.035,
    hemiSky: 0x47587a,
    hemiGround: 0x1a120c,
    hemi: 0.18,
    lamp: 1.45,
    wall: 0x6a5444,
    background: 0x0c0907,
    dust: 1.0,
  },
} as const satisfies Record<MoodId, MoodSettings>;

/** Couleur de la lampe (cône et spot). */
export const LAMP_COLOR = 0xffb565;

/**
 * Point de départ pour recalibrer une intensité du prototype (three r128,
 * lumières « legacy », sans gestion des couleurs) dans three récent : les
 * lumières physiques demandent un facteur π pour le même éclairement. Les
 * lumières ponctuelles et le spot prennent aussi decay: 0 pour garder la
 * portée du prototype (sans atténuation au-delà de leur distance). Le reste
 * de l'écart (couleurs des lumières décodées en linéaire, sortie encodée en
 * sRGB) se règle à l'œil sur les captures de référence.
 */
export function legacyIntensity(intensity: number): number {
  return Math.PI * Math.max(0, intensity);
}

/**
 * Atténuation des lumières ponctuelles. Le prototype (r128) les déclarait
 * avec une distance D et decay 2, ce qui donnait (1 - d / D)² ; avec
 * decay 0, three récent ne les atténue presque plus avant D, et la lueur de
 * l'écran éclairait tout le bureau. decay 1 (1 / d, coupé en douceur à D)
 * suit la courbe du prototype à quelques pour cent près, à condition de
 * multiplier l'intensité par environ 0.13 D (legacyPointIntensity).
 */
export const POINT_DECAY = 1;

/** Intensité d'une lumière ponctuelle du prototype (distance D, decay 2), pour decay POINT_DECAY. */
export function legacyPointIntensity(intensity: number, distance: number): number {
  return legacyIntensity(intensity) * 0.13 * distance;
}
