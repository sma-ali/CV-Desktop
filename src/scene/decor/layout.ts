import {
  ARRIVAL,
  KEYBOARD,
  LAMP,
  TYPING_END_DEFAULT,
  WALL_Z,
  WIN,
  WINDOW_SKY,
  type Vec3,
} from '../core/constants';
import { clamp } from '../core/arrival';
import type { DeskObstacle } from '../core/bodies';
import { rng } from '../core/rng';
import { BELT, KIMONO_SIZE, KIMONO_TOP } from './kimono';

// Le décor en données pures, sans three : positions, couleurs et petites
// animations, fonctions du temps T de l'horloge du store. Tout ce qui est
// ici se teste hors du navigateur (layout.test.ts). Les composants ne font
// que poser ces valeurs sur des maillages.

// ------------------------------------------------------------------
// La fenêtre : emplacement du ciel (fourni par la mise en scène)
// ------------------------------------------------------------------

/** Le ciel de la mise en scène (core/constants.ts), repris ici pour les tests du décor. */
export { WINDOW_SKY };

/** Le fond de secours, derrière l'emplacement du ciel. */
export const WINDOW_BACKSTOP = {
  position: [(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z - 1.4] as Vec3,
  size: [WIN.x1 - WIN.x0 + 3, WIN.y1 - WIN.y0 + 3] as const,
} as const;

// ------------------------------------------------------------------
// Le clavier
// ------------------------------------------------------------------

const KEY_ROWS = 5;
const KEY_COLS = 15;
export const KEY_COUNT = KEY_ROWS * KEY_COLS;
/** Hauteur d'une touche au repos (son centre), dans le repère du clavier. */
export const KEY_Y = 0.18;
/** Profondeur d'enfoncement d'une touche. */
export const KEY_TRAVEL = 0.05;

/** Couleurs des touches : crème, beige foncé sur les bords, quelques accents. */
export const KEY_COLORS = {
  base: 0xd6c6a6,
  side: 0x9c8b6c,
  red: 0xc0574a,
  green: 0x86a07d,
} as const;

export interface KeySpec {
  x: number;
  z: number;
  color: number;
}

/** Position (repère du clavier) et couleur d'une touche, rangée par rangée. */
export function keyLayout(): KeySpec[] {
  const keys: KeySpec[] = [];
  for (let row = 0; row < KEY_ROWS; row++) {
    for (let col = 0; col < KEY_COLS; col++) {
      keys.push({ x: -1.92 + col * 0.275, z: -0.55 + row * 0.275, color: keyColor(row, col) });
    }
  }
  return keys;
}

export function keyColor(row: number, col: number): number {
  if (row === 4 && col > 4 && col < 10) return KEY_COLORS.base; // barre d'espace
  if ((col === 0 && row === 2) || (col === 14 && row === 1) || (row === 0 && col === 0)) {
    return KEY_COLORS.red;
  }
  if (row === 4 && col === 13) return KEY_COLORS.green;
  if (col > 12 || col < 1) return KEY_COLORS.side;
  return KEY_COLORS.base;
}

/** Durée de l'enfoncement d'une touche (secondes). */
export const KEY_DIP_TIME = 0.11;

/**
 * Fin de la frappe du code à l'écran, par défaut. La longueur du code
 * appartient aux objets : l'écran écrit la fin exacte dans frame.typingEnd,
 * que le clavier passe à keyDips.
 */
export const TYPING_END_ESTIMATE = TYPING_END_DEFAULT;

/** Caractères par seconde de la ligne finale (tapée en 3 s, effacée en 1.2 s). */
const EXTRA_RATE = 12;

/** Touche (indice) frappée pour le caractère n : pseudo-aléatoire mais stable. */
export function keyForChar(n: number): number {
  const h = Math.imul(n + 17, 0x9e3779b1) >>> 0;
  return (h >>> 7) % KEY_COUNT;
}

/**
 * Ce qui se tape à l'instant t : le compteur de caractères « virtuel » et sa
 * vitesse, ou null quand personne ne tape. Pendant le code, 150 caractères
 * par seconde ; pendant la ligne finale (tapée puis effacée en boucle), 12.
 */
function typingAt(t: number, typingEnd: number): { start: number; rate: number } | null {
  if (t >= ARRIVAL.typingStart && t < typingEnd) {
    return { start: ARRIVAL.typingStart, rate: ARRIVAL.typingRate };
  }
  if (t >= ARRIVAL.extraLineStart) {
    const lt = (t - ARRIVAL.extraLineStart) % ARRIVAL.extraLineLoop;
    if (lt < 3 || (lt >= 7 && lt < 8.2)) return { start: t - lt, rate: EXTRA_RATE };
  }
  return null;
}

/**
 * Enfoncement de chaque touche (0 à 1) à l'instant t, écrit dans out (une
 * case par touche, aucune allocation). Fonction pure de t : figée par ?fige.
 * Renvoie true si une touche au moins est enfoncée.
 */
export function keyDips(
  t: number,
  out: Float32Array,
  typingEnd: number = TYPING_END_ESTIMATE,
): boolean {
  out.fill(0);
  // Ce qui se tape maintenant, ou se tapait il y a un instant (la touche remonte).
  const typing = typingAt(t, typingEnd) ?? typingAt(t - KEY_DIP_TIME, typingEnd);
  if (!typing) return false;
  const { start, rate } = typing;
  let any = false;
  const first = Math.max(0, Math.ceil((t - KEY_DIP_TIME - start) * rate));
  const last = Math.floor((t - start) * rate);
  for (let n = first; n <= last; n++) {
    const at = start + n / rate;
    const age = t - at;
    // Seulement les caractères frappés pendant une période de frappe.
    if (age < 0 || age > KEY_DIP_TIME || !typingAt(at, typingEnd)) continue;
    const k = keyForChar(n + Math.round(start * 1000));
    const dip = 1 - age / KEY_DIP_TIME;
    if (dip > (out[k] ?? 0)) out[k] = dip;
    any = true;
  }
  return any;
}

/** Position du clavier sur le plateau. */
export const KEYBOARD_POSITION = KEYBOARD;

// ------------------------------------------------------------------
// Outils de géométrie (lampe)
// ------------------------------------------------------------------

export function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function addScaled([ax, ay, az]: Vec3, [bx, by, bz]: Vec3, s: number): Vec3 {
  return [ax + bx * s, ay + by * s, az + bz * s];
}

/**
 * Hélice d'un ressort le long du segment [from, to] : spires de rayon radius,
 * pointsPerTurn points par tour. Points prêts pour un câble (Cable).
 */
export function springPoints(
  from: Vec3,
  to: Vec3,
  radius: number,
  turns: number,
  pointsPerTurn = 8,
): Vec3[] {
  const axis: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const dir = normalize(axis);
  // Deux vecteurs perpendiculaires à l'axe.
  const ref: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(dir, ref));
  const w = cross(dir, u);
  const n = Math.max(2, Math.round(turns * pointsPerTurn));
  const points: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = k * turns * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    points.push([
      from[0] + axis[0] * k + u[0] * c + w[0] * s,
      from[1] + axis[1] * k + u[1] * c + w[1] * s,
      from[2] + axis[2] * k + u[2] * c + w[2] * s,
    ]);
  }
  return points;
}

function cross([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

// ------------------------------------------------------------------
// La corde à sauter enroulée (coin avant gauche)
// ------------------------------------------------------------------

export const ROPE = { center: [-5.6, 0, 2.35] as Vec3, turns: 2.6, radius: 0.42 } as const;

/**
 * Les points extrêmes de la corde et de ses poignées (le bord gauche du
 * cadrage en paysage, FIXED_EXTENT.edge) : le coin gauche de la spirale,
 * le bout de la poignée du fond, l'avant de la spirale.
 */
export const ROPE_EXTENT: readonly Vec3[] = [
  [ROPE.center[0] - 0.62, 0, ROPE.center[2] - 0.75],
  [ROPE.center[0] - 0.55, 0.15, ROPE.center[2] + 0.48],
  [ROPE.center[0] + 0.55, 0.15, ROPE.center[2] + 0.48],
];

/** La corde en spirale, posée à plat, qui monte un peu à chaque tour. */
export function ropeCoil(points = 80): Vec3[] {
  const [cx, , cz] = ROPE.center;
  const coil: Vec3[] = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2 * ROPE.turns;
    const r = ROPE.radius + 0.06 * Math.sin(i * 0.7);
    coil.push([cx + Math.cos(a) * r, 0.04 + i * 0.0011, cz + Math.sin(a) * r * 0.82]);
  }
  return coil;
}

// ------------------------------------------------------------------
// La plante
// ------------------------------------------------------------------

export const PLANT = { position: [3.45, 0, -3.0] as Vec3, leaves: 11 } as const;

export interface LeafSpec {
  /** Rotation autour de la tige (y), inclinaison de base (x), échelle, phase du balancement. */
  ry: number;
  rx: number;
  scale: number;
  phase: number;
  /** Teinte : 0 clair, 1 foncé. */
  shade: 0 | 1;
}

export function leafLayout(count: number = PLANT.leaves): LeafSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    ry: i * 2.4,
    rx: -0.25 - (i % 3) * 0.32,
    scale: 0.8 + (i % 4) * 0.18,
    phase: i,
    shade: (i % 2) as 0 | 1,
  }));
}

// ------------------------------------------------------------------
// Mangas et figurines (inventés : ni titre, ni marque, ni personnage réel)
// ------------------------------------------------------------------

export const MANGA = { position: [4.55, 0, -2.2] as Vec3, ry: -0.12, count: 7 } as const;
export const MANGA_SIZE = { w: 1.2, h: 0.13, d: 0.82, step: 0.132 } as const;
const MANGA_COVERS = [
  0xc2492f, 0x2f6f8f, 0xe7b84a, 0x3f7b5a, 0x20262f, 0xd7d0c0, 0x7a3e6e,
] as const;
export const SPINE_PALETTE = [
  '#c2492f',
  '#2f6f8f',
  '#e7b84a',
  '#3f7b5a',
  '#d7d0c0',
  '#7a3e6e',
  '#20262f',
  '#e0703a',
] as const;

export interface MangaSpec {
  x: number;
  y: number;
  ry: number;
  cover: number;
}

export function mangaStack(count: number = MANGA.count): MangaSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (i % 2 ? 0.04 : -0.03) + (i === 3 ? 0.08 : 0),
    y: MANGA_SIZE.h / 2 + i * MANGA_SIZE.step,
    ry: ((i % 3) - 1) * 0.05,
    cover: MANGA_COVERS[i % MANGA_COVERS.length] ?? MANGA_COVERS[0],
  }));
}

/** Hauteur du dessus de la pile de mangas. */
export const MANGA_TOP = MANGA.count * MANGA_SIZE.step - (MANGA_SIZE.step - MANGA_SIZE.h);

/** Le dos d'un tome : deux couleurs, trois pavés clairs (titre abstrait), un numéro. */
export interface SpineSpec {
  band: string;
  back: string;
  blocks: { x: number; w: number }[];
  volume: number;
}

export function spineSpec(seed: number): SpineSpec {
  const random = rng(seed);
  const pick = () => SPINE_PALETTE[Math.floor(random() * SPINE_PALETTE.length)] ?? SPINE_PALETTE[0];
  const back = pick();
  const band = pick();
  const blocks = [0, 1, 2].map((i) => ({ x: 70 + i * 44 + random() * 10, w: 24 + random() * 16 }));
  return { back, band, blocks, volume: 1 + Math.floor(random() * 12) };
}

export type FigureKind = 'robot' | 'fox' | 'wanderer';

export interface FigureSpec {
  kind: FigureKind;
  position: Vec3;
  ry: number;
}

/** Trois figurines inventées : un petit robot sur la pile, un renard, un voyageur au chapeau. */
export const FIGURES: readonly FigureSpec[] = [
  { kind: 'robot', position: [4.6, MANGA_TOP, -2.2], ry: -0.3 },
  { kind: 'fox', position: [5.55, 0, -1.55], ry: -0.5 },
  { kind: 'wanderer', position: [5.68, 0, -2.55], ry: -0.4 },
];

// ------------------------------------------------------------------
// Les petites choses posées : tasse, manette, bandes, kimono
// ------------------------------------------------------------------

export const STEAM_COUNT = 6;

/**
 * Le kimono de grappling plié, bleu marine, sa ceinture blanche nouée posée
 * dessus (aucune marque, aucun écusson ; pièces dans kimono.ts) : à gauche
 * du clavier, sous la lampe. Assez
 * loin derrière le livre pour que sa tranche ne le cache pas.
 */
export const KIMONO = { position: [-2.72, 0, -0.78] as Vec3, ry: 0.1 } as const;

/** Son encombrement vu de dessus (demi-largeur, demi-profondeur) et sa hauteur, nœud compris. */
export const KIMONO_FOOTPRINT = {
  hw: KIMONO_SIZE.w / 2 + 0.01,
  hd: KIMONO_SIZE.d / 2 + BELT.thickness + 0.01,
  height: KIMONO_TOP,
} as const;

// ------------------------------------------------------------------
// Petites animations, fonctions pures du temps
// ------------------------------------------------------------------

/**
 * Balancement amorti après un choc : angle en radians,
 * 0 avant le choc, sans choc ou en mouvement réduit.
 */
export function damped(t: number, at: number | null, amplitude: number, reduced: boolean): number {
  if (at === null || reduced) return 0;
  const s = t - at;
  if (s < 0 || s > 8) return 0;
  return amplitude * Math.exp(-s * 0.55) * Math.sin(s * 3);
}

/** Léger balancement continu (feuilles), coupé en mouvement réduit. */
export function sway(
  t: number,
  frequency: number,
  phase: number,
  amplitude: number,
  reduced: boolean,
): number {
  return reduced ? 0 : Math.sin(t * frequency + phase) * amplitude;
}

/** Saut d'une figurine : hauteur et tour sur elle-même, pendant 0.6 s. */
export function hop(t: number, at: number | null, reduced: boolean): { y: number; spin: number } {
  if (at === null || reduced) return { y: 0, spin: 0 };
  const s = t - at;
  if (s < 0 || s >= 0.6) return { y: 0, spin: 0 };
  return { y: Math.sin((s / 0.6) * Math.PI) * 0.35, spin: (s / 0.6) * Math.PI * 2 };
}

/** Secousse de la plante après un clic (radians), pendant 1.4 s. */
export function shake(t: number, at: number | null, reduced: boolean): number {
  if (at === null || reduced) return 0;
  const s = t - at;
  if (s < 0 || s >= 1.4) return 0;
  return Math.sin(s * 22) * 0.25 * (1 - s / 1.4);
}

/** Amplitude de la vibration de la manette après un clic, pendant 0.6 s. */
export function rumble(t: number, at: number | null, reduced: boolean): number {
  if (at === null || reduced) return 0;
  const s = t - at;
  if (s < 0 || s >= 0.6) return 0;
  return (1 - s / 0.6) * 0.035;
}

export interface SteamPuff {
  x: number;
  y: number;
  z: number;
  scale: number;
  opacity: number;
}

/**
 * Une bouffée de vapeur au-dessus de la tasse (repère de la tasse). light :
 * lumière de la scène (lampe + fenêtre) ; puffAt : clic sur la tasse. En
 * mouvement réduit, les bouffées restent immobiles.
 */
export function steamPuff(
  t: number,
  index: number,
  light: number,
  puffAt: number | null,
  reduced: boolean,
  out: SteamPuff,
): SteamPuff {
  const tt = reduced ? 0 : t;
  const phase = (((tt * 0.32 + index / STEAM_COUNT) % 1) + 1) % 1;
  const puff = !reduced && puffAt !== null && t - puffAt >= 0 && t - puffAt < 2 ? 1.8 : 1;
  out.x = Math.sin(tt * 1.2 + index * 2) * 0.12 * phase;
  out.y = 0.6 + phase * 1.5;
  out.z = Math.cos(tt * 0.9 + index) * 0.08 * phase;
  out.scale = 0.22 + phase * 0.55;
  out.opacity = Math.sin(phase * Math.PI) * 0.16 * puff * clamp(light, 0, 1);
  return out;
}

// ------------------------------------------------------------------
// Encombrement au sol
// ------------------------------------------------------------------

/**
 * Ce que le décor occupe sur le plateau au repos, en rectangles orientés :
 * le cadrage portrait et les tests de disposition s'en servent. La tasse et
 * la manette ont leur encombrement avec les objets (BODY_FOOTPRINTS dans
 * core/bodies.ts). Les objets plats (tapis, câbles) ne comptent pas.
 */
const square = (id: string, [x, , z]: Vec3, half: number): DeskObstacle => ({
  id,
  x,
  z,
  ry: 0,
  hw: half,
  hd: half,
});

export const DECOR_OBSTACLES: readonly DeskObstacle[] = [
  // Le clavier (boîtier de la rangée de touches).
  { id: 'keyboard', x: KEYBOARD[0], z: KEYBOARD[2], ry: 0, hw: 2.15, hd: 0.72 },
  // Le kimono plié et sa ceinture.
  {
    id: 'kimono',
    x: KIMONO.position[0],
    z: KIMONO.position[2],
    ry: KIMONO.ry,
    hw: KIMONO_FOOTPRINT.hw,
    hd: KIMONO_FOOTPRINT.hd,
  },
  { id: 'mouse', x: 3.35, z: -0.48, ry: 0, hw: 0.24, hd: 0.34 },
  square('lamp', LAMP.base, 0.48),
  { id: 'rope', x: ROPE.center[0], z: ROPE.center[2], ry: 0, hw: 0.55, hd: 0.48 },
  { id: 'wraps', x: 5.7, z: 0.75, ry: 0, hw: 0.4, hd: 0.4 },
  square('plant', PLANT.position, 0.36),
  {
    id: 'manga',
    x: MANGA.position[0],
    z: MANGA.position[2],
    ry: MANGA.ry,
    hw: MANGA_SIZE.w / 2,
    hd: MANGA_SIZE.d / 2,
  },
  ...FIGURES.filter((figure) => figure.position[1] === 0).map((figure) =>
    square(`figure-${figure.kind}`, figure.position, 0.22),
  ),
];

// ------------------------------------------------------------------
// Le bureau resserré du téléphone en portrait
// ------------------------------------------------------------------

/**
 * Les morceaux du décor qui changent de place en portrait (voir
 * BOUNDS_PORTRAIT). Chacun bouge d'un bloc : il tourne de ry
 * autour de son ancre (DECOR_ANCHORS, sa place en paysage), puis l'ancre va
 * en (x, z). Le tapis et la pièce ne bougent pas.
 */
export type DecorPieceId =
  | 'lamp'
  | 'keyboard'
  | 'kimono'
  | 'mouse'
  | 'rope'
  | 'wraps'
  | 'plant'
  | 'manga'
  | 'fox'
  | 'wanderer';

export const DECOR_PIECE_IDS = [
  'lamp',
  'keyboard',
  'kimono',
  'mouse',
  'rope',
  'wraps',
  'plant',
  'manga',
  'fox',
  'wanderer',
] as const satisfies readonly DecorPieceId[];

const figureAt = (kind: FigureKind): readonly [number, number] => {
  const figure = FIGURES.find((spec) => spec.kind === kind);
  return figure ? [figure.position[0], figure.position[2]] : [0, 0];
};

/** L'ancre de chaque morceau : sa place en paysage, vue de dessus (x, z). */
export const DECOR_ANCHORS: Readonly<Record<DecorPieceId, readonly [number, number]>> = {
  lamp: [LAMP.base[0], LAMP.base[2]],
  keyboard: [KEYBOARD[0], KEYBOARD[2]],
  kimono: [KIMONO.position[0], KIMONO.position[2]],
  mouse: [3.35, -0.48],
  rope: [ROPE.center[0], ROPE.center[2]],
  wraps: [5.7, 0.75],
  plant: [PLANT.position[0], PLANT.position[2]],
  manga: [MANGA.position[0], MANGA.position[2]],
  fox: figureAt('fox'),
  wanderer: figureAt('wanderer'),
};

/** Où va un morceau : son ancre en (x, z), tournée de ry ; caché s'il ne trouve pas sa place. */
export interface DecorPlacement {
  x: number;
  z: number;
  ry: number;
  hidden: boolean;
}

/**
 * Les places du décor en portrait. La lampe passe derrière le bord gauche
 * de l'écran, sa tête vers l'avant gauche (elle éclaire le livre), au-dessus
 * de la plante ; le kimono plié se pose derrière le clavier, entre la
 * lampe, le coffret et le pied de l'écran ; la souris se rapproche du
 * clavier ; la plante se serre dans le coin du fond à gauche, sous la
 * fenêtre, et les mangas et leur robot passent devant le clavier (le casque
 * va à droite de l'écran, HEADSET_PORTRAIT). La corde, les bandes et deux
 * figurines ne trouvent pas de place sans entasser le plateau ou cacher un
 * objet du CV : cachés en portrait.
 */
export const PORTRAIT_DECOR: Readonly<
  Record<DecorPieceId, { x: number; z: number; ry?: number; hidden?: boolean }>
> = {
  lamp: { x: -2.4, z: -3.0, ry: -0.75 },
  keyboard: { x: KEYBOARD[0], z: KEYBOARD[2] },
  kimono: { x: -1.3, z: -1.92, ry: -0.1 },
  mouse: { x: 2.85, z: -0.5 },
  rope: { x: ROPE.center[0], z: ROPE.center[2], hidden: true },
  wraps: { x: 5.7, z: 0.75, hidden: true },
  plant: { x: -3.5, z: -3.15 },
  manga: { x: 1.6, z: 0.9, ry: 0.12 },
  fox: { ...pointXZ(figureAt('fox')), hidden: true },
  wanderer: { ...pointXZ(figureAt('wanderer')), hidden: true },
};

function pointXZ([x, z]: readonly [number, number]) {
  return { x, z };
}

/** La place d'un morceau du décor pour un format (en paysage, son ancre, sans rotation). */
export function decorPlacement(id: DecorPieceId, portrait: boolean): DecorPlacement {
  if (!portrait) {
    const [x, z] = DECOR_ANCHORS[id];
    return { x, z, ry: 0, hidden: false };
  }
  const place = PORTRAIT_DECOR[id];
  return { x: place.x, z: place.z, ry: place.ry ?? 0, hidden: place.hidden ?? false };
}

/**
 * Ce que DecorPiece pose dans la scène : un groupe placé sur la nouvelle
 * ancre et tourné de ry, qui porte un groupe décalé de moins l'ancre (les
 * enfants sont dessinés à leur place en paysage). En paysage, l'identité.
 */
export function decorPieceTransform(id: DecorPieceId, portrait: boolean) {
  const place = decorPlacement(id, portrait);
  const [ax, az] = DECOR_ANCHORS[id];
  return {
    position: [place.x, 0, place.z] as Vec3,
    ry: place.ry,
    offset: [-ax, 0, -az] as Vec3,
    hidden: place.hidden,
  };
}

/**
 * Un point du morceau (repère du monde, à sa place en paysage) vu à sa place
 * du format : tourné de ry autour de l'ancre (sens de three, comme
 * rotation.y), puis posé sur la nouvelle ancre.
 */
export function placeDecorPoint(id: DecorPieceId, portrait: boolean, [x, y, z]: Vec3): Vec3 {
  if (!portrait) return [x, y, z];
  const [ax, az] = DECOR_ANCHORS[id];
  const place = decorPlacement(id, true);
  const lx = x - ax;
  const lz = z - az;
  const cos = Math.cos(place.ry);
  const sin = Math.sin(place.ry);
  return [place.x + lx * cos + lz * sin, y, place.z - lx * sin + lz * cos];
}

/** Le morceau qui porte chaque obstacle du décor (le clavier ne bouge pas). */
const OBSTACLE_PIECES: Readonly<Record<string, DecorPieceId | null>> = {
  keyboard: 'keyboard',
  kimono: 'kimono',
  mouse: 'mouse',
  lamp: 'lamp',
  rope: 'rope',
  wraps: 'wraps',
  plant: 'plant',
  manga: 'manga',
  'figure-fox': 'fox',
  'figure-wanderer': 'wanderer',
};

/** Le morceau du décor d'un obstacle, ou null s'il ne bouge jamais. */
export const obstaclePiece = (id: string): DecorPieceId | null => OBSTACLE_PIECES[id] ?? null;

/**
 * Les obstacles ronds (pied de la lampe, pot de la plante, socle des
 * figurines) : leur carré ne tourne pas avec le morceau, il reste le même
 * autour du centre (tourné, il dépasserait du plateau sans raison).
 */
const ROUND_OBSTACLES: ReadonlySet<string> = new Set([
  'lamp',
  'plant',
  'figure-fox',
  'figure-wanderer',
]);

/** La rotation qu'un obstacle prend avec son morceau (0 pour un obstacle rond). */
export const obstacleTurn = (id: string, pieceRy: number): number =>
  ROUND_OBSTACLES.has(id) ? 0 : pieceRy;

/** Les obstacles du décor en portrait : à la place de leur morceau, sans les morceaux cachés. */
export const DECOR_OBSTACLES_PORTRAIT: readonly DeskObstacle[] = DECOR_OBSTACLES.flatMap(
  (obstacle) => {
    const piece = obstaclePiece(obstacle.id);
    if (!piece) return [obstacle];
    const place = decorPlacement(piece, true);
    if (place.hidden) return [];
    const [x, , z] = placeDecorPoint(piece, true, [obstacle.x, 0, obstacle.z]);
    return [{ ...obstacle, x, z, ry: obstacle.ry + obstacleTurn(obstacle.id, place.ry) }];
  },
);

/** Les obstacles du décor du format. */
export const decorObstacles = (portrait: boolean): readonly DeskObstacle[] =>
  portrait ? DECOR_OBSTACLES_PORTRAIT : DECOR_OBSTACLES;

/**
 * Hauteur de chaque obstacle du décor (le robot debout sur les mangas, les
 * feuilles de la plante) : le cadrage portrait fait tenir le décor entier,
 * pas seulement son pied. La lampe a ses propres points (FIXED_EXTENT,
 * stage/framing.ts).
 */
const DECOR_HEIGHTS: Readonly<Record<string, number>> = {
  keyboard: 0.25,
  kimono: KIMONO_FOOTPRINT.height,
  mouse: 0.25,
  lamp: 0.3,
  rope: 0.15,
  wraps: 0.35,
  plant: 1.45,
  manga: MANGA_TOP + 0.55,
  'figure-fox': 0.5,
  'figure-wanderer': 0.6,
};

/**
 * Les coins du décor posé en portrait (au ras du plateau et à sa hauteur) :
 * le cadrage portrait les fait tenir à l'écran, en plus du bureau utile.
 */
export function decorExtentPortrait(): Vec3[] {
  const points: Vec3[] = [];
  for (const obstacle of DECOR_OBSTACLES_PORTRAIT) {
    const height = DECOR_HEIGHTS[obstacle.id] ?? 0.3;
    const cos = Math.cos(obstacle.ry);
    const sin = Math.sin(obstacle.ry);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const lx = sx * obstacle.hw;
      const lz = sz * obstacle.hd;
      const x = obstacle.x + lx * cos + lz * sin;
      const z = obstacle.z - lx * sin + lz * cos;
      points.push([x, 0, z], [x, height, z]);
    }
  }
  return points;
}
