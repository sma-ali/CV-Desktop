import {
  ARRIVAL,
  KEYBOARD,
  TYPING_END_DEFAULT,
  WALL_Z,
  WIN,
  WINDOW_SKY,
  type Vec3,
} from '../core/constants';
import { clamp } from '../core/math';
import { anchorPoint } from '../core/decorPlaces';
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
// Le pendule de Newton (coin avant gauche)
// ------------------------------------------------------------------

/**
 * Le pendule de Newton : un socle, un cadre de quatre montants et cinq
 * billes d'acier pendues chacune par deux fils, alignées de gauche à droite
 * (vues de face, elles se balancent dans le plan de l'image).
 */
export const CRADLE = {
  center: anchorPoint('cradle'),
  /** Demi-largeur et demi-profondeur du socle. */
  hw: 0.5,
  hd: 0.32,
  /** Épaisseur du socle. */
  base: 0.06,
  /** Hauteur des barres d'où pendent les billes. */
  top: 0.92,
  balls: 5,
  radius: 0.085,
  /** Du point d'attache au centre d'une bille. */
  length: 0.56,
} as const;

/** Le centre de la i-ème bille, au repos (x seulement : elles sont alignées). */
export function cradleBallX(i: number): number {
  return CRADLE.center[0] + (i - (CRADLE.balls - 1) / 2) * CRADLE.radius * 2;
}

/**
 * Les points extrêmes du pendule (le bord gauche du cadrage en paysage,
 * FIXED_EXTENT.edge) : les coins du socle et le haut du cadre.
 */
export const CRADLE_EXTENT: readonly Vec3[] = [
  [CRADLE.center[0] - CRADLE.hw, 0, CRADLE.center[2] - CRADLE.hd],
  [CRADLE.center[0] - CRADLE.hw, 0, CRADLE.center[2] + CRADLE.hd],
  [CRADLE.center[0] + CRADLE.hw, 0, CRADLE.center[2] + CRADLE.hd],
  [CRADLE.center[0] - CRADLE.hw, CRADLE.top, CRADLE.center[2] - CRADLE.hd],
  [CRADLE.center[0] - CRADLE.hw, CRADLE.top, CRADLE.center[2] + CRADLE.hd],
];

/**
 * Le mouvement du pendule après un clic : la bille de gauche se lève
 * (lift), puis on la lâche ; elle frappe les autres, celle de droite part,
 * revient, et ainsi de suite, de moins en moins haut.
 */
export const CRADLE_SWING = {
  /** Angle de départ de la bille levée (radians). */
  amplitude: 0.75,
  /** Durée de la levée avant le lâcher (s). */
  lift: 0.4,
  /** Un aller-retour complet, gauche puis droite (s). */
  period: 1.2,
  /** Amortissement (par seconde). */
  decay: 0.32,
  /** Sous cet angle, tout s'arrête. */
  rest: 0.03,
} as const;

/** L'amplitude du balancement, s secondes après le lâcher. */
const cradleAmplitude = (s: number) => CRADLE_SWING.amplitude * Math.exp(-CRADLE_SWING.decay * s);

/**
 * L'angle du balancement (radians) : négatif, la bille de gauche est levée
 * vers la gauche ; positif, celle de droite vers la droite ; 0 au repos.
 */
export function cradleSwing(t: number, at: number | null, reduced: boolean): number {
  if (at === null || reduced) return 0;
  const { amplitude, lift, period, rest } = CRADLE_SWING;
  const s = t - at;
  if (s <= 0) return 0;
  if (s < lift) {
    const k = s / lift;
    return -amplitude * k * k * (3 - 2 * k);
  }
  const a = cradleAmplitude(s - lift);
  if (a < rest) return 0;
  return -a * Math.cos((2 * Math.PI * (s - lift)) / period);
}

/**
 * Les chocs depuis le lâcher (un par passage au point bas), et la force du
 * dernier (0 à 1) : chaque nouveau choc fait « clac ».
 */
export function cradleHits(
  t: number,
  at: number | null,
  reduced: boolean,
): { count: number; strength: number } {
  if (at === null || reduced) return { count: 0, strength: 0 };
  const { amplitude, decay, lift, period, rest } = CRADLE_SWING;
  const half = period / 2;
  const s = t - at - lift - period / 4;
  if (s < 0) return { count: 0, strength: 0 };
  // Le dernier choc avant l'arrêt (amplitude encore au-dessus de rest).
  const lastHit = Math.floor((Math.log(amplitude / rest) / decay - period / 4) / half);
  const last = Math.min(Math.floor(s / half), lastHit);
  return { count: last + 1, strength: cradleAmplitude(period / 4 + last * half) / amplitude };
}

// ------------------------------------------------------------------
// La plante
// ------------------------------------------------------------------

export const PLANT = { position: anchorPoint('plant'), leaves: 11 } as const;

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

export const MANGA = { position: anchorPoint('manga'), ry: -0.12, count: 7 } as const;
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
  { kind: 'fox', position: anchorPoint('fox'), ry: -0.5 },
  { kind: 'wanderer', position: anchorPoint('wanderer'), ry: -0.4 },
];

// ------------------------------------------------------------------
// Les petites choses posées : tasse, manette, bandes, kimono
// ------------------------------------------------------------------

export const STEAM_COUNT = 6;

/**
 * Le kimono plié, bleu marine, sa ceinture blanche nouée posée
 * dessus (aucune marque, aucun écusson ; pièces dans kimono.ts) : à gauche
 * du clavier, sous la lampe. Assez
 * loin derrière le livre pour que sa tranche ne le cache pas.
 */
export const KIMONO = { position: anchorPoint('kimono'), ry: 0.1 } as const;

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
