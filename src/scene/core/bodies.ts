import { headsetPose, headsetStand, HEADSET_STAND, ITEM_POSES, MONITOR } from './constants';
import { DECOR_BODY_HOMES, decorPlacement } from './decorPlaces';
import { PORTRAIT_PLACES } from './views';
import { BODY_IDS, isDecorBodyId, type BodyId } from './ids';

// Les corps du bureau, vus de dessus et en 3D : où ils reposent (leur place
// d'origine, selon le format), ce qu'ils occupent au repos (un rectangle
// orienté, OBB, pour le cadrage et les tests de disposition), et leur pose
// mutable, écrite à chaque image par le moteur physique. Données
// pures, sans three. Repère du prototype : x vers la droite, z vers le
// visiteur, y vers le haut, ry autour de l'axe vertical (sens de three : un
// point local (lx, lz) va en x = lx cos ry + lz sin ry,
// z = -lx sin ry + lz cos ry).

/** Une place sur le plateau : centre de l'objet et rotation autour de y. */
export interface DeskPlace {
  x: number;
  z: number;
  ry: number;
}

/**
 * L'encombrement d'un corps dans son propre repère : centre (cx, cz) et
 * demi-côtés (hw en x, hd en z). Le rectangle suit la rotation de l'objet.
 */
export interface Footprint {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
}

/** Un rectangle orienté dans le repère du plateau. */
export interface Obb {
  x: number;
  z: number;
  ry: number;
  hw: number;
  hd: number;
}

/** Un obstacle fixe nommé (décor, pied de l'écran, support du casque). */
export interface DeskObstacle extends Obb {
  id: string;
}

/**
 * Les corps dont l'encombrement au repos compte pour le cadrage et pour les
 * tests de disposition. Le décor a ses propres
 * rectangles (DECOR_OBSTACLES, decor/obstacles.ts), le casque pend à son
 * support (FIXED_ITEM_OBSTACLES).
 */
export const FOOTPRINT_IDS = [
  'book',
  'badge',
  'laptop',
  'card',
  'chest',
  'netherbrain',
  'homelab',
  'mug',
  'pad',
] as const satisfies readonly BodyId[];

export type FootprintId = (typeof FOOTPRINT_IDS)[number];

/**
 * Encombrement de chaque corps posé à plat, d'après sa géométrie (les lanières
 * et les câbles plats ne comptent pas). Le coffret est décalé de -0.2 en z
 * dans son repère (Chest.tsx), comme sa boîte.
 */
export const BODY_FOOTPRINTS = {
  book: { cx: 0, cz: 0, hw: 0.95, hd: 1.25 },
  badge: { cx: 0, cz: 0, hw: 0.43, hd: 0.62 },
  laptop: { cx: 0, cz: 0, hw: 1.35, hd: 0.93 },
  // La carte et la pile de cartes qui la porte (items/cardPile.ts).
  card: { cx: 0, cz: 0, hw: 0.91, hd: 0.575 },
  chest: { cx: 0, cz: -0.2, hw: 0.83, hd: 0.54 },
  netherbrain: { cx: 0, cz: 0, hw: 0.42, hd: 0.42 },
  homelab: { cx: 0, cz: 0, hw: 0.5, hd: 0.4 },
  // La tasse et son anse (à droite), la manette et ses poignées (vers l'avant).
  mug: { cx: 0.08, cz: 0, hw: 0.4, hd: 0.31 },
  pad: { cx: 0, cz: 0.08, hw: 0.68, hd: 0.38 },
} as const satisfies Record<FootprintId, Footprint>;

/** Places de repos de la tasse et de la manette (le décor les pose là). */
/**
 * Les objets du CV qui ne glissent pas mais occupent le plateau : le pied de
 * l'écran et le support du casque. Le décor ajoute les siens
 * (DECOR_OBSTACLES dans src/scene/decor/obstacles.ts).
 */
const FIXED_ITEM_OBSTACLES: readonly DeskObstacle[] = [
  {
    id: 'monitor-stand',
    x: MONITOR.position[0],
    z: MONITOR.position[2] + 0.1,
    ry: 0,
    hw: 0.75,
    hd: 0.48,
  },
  { id: 'headset-stand', x: HEADSET_STAND[0], z: HEADSET_STAND[2], ry: 0, hw: 0.4, hd: 0.4 },
];

/** Les mêmes en portrait : le support du casque passe à droite de l'écran (HEADSET_PORTRAIT). */
const FIXED_ITEM_OBSTACLES_PORTRAIT: readonly DeskObstacle[] = FIXED_ITEM_OBSTACLES.map(
  (obstacle) => {
    if (obstacle.id !== 'headset-stand') return obstacle;
    const [x, , z] = headsetStand(true);
    return { ...obstacle, x, z };
  },
);

/** Les objets fixes du format. */
export const fixedItemObstacles = (portrait: boolean): readonly DeskObstacle[] =>
  portrait ? FIXED_ITEM_OBSTACLES_PORTRAIT : FIXED_ITEM_OBSTACLES;

/** Une pose de repos : la place, et la hauteur de l'origine du corps. */
export interface DeskPose extends DeskPlace {
  y: number;
}

/**
 * La place d'origine d'un corps, selon le format (le bureau resserré en
 * portrait : PORTRAIT_PLACES, PORTRAIT_DECOR). L'origine d'un objet du CV
 * est celle de son groupe (ITEM_POSES) ; celle d'un morceau du décor, son
 * ancre (DECOR_ANCHORS), au ras du plateau.
 */
export function homePose(id: BodyId, portrait: boolean): DeskPose {
  if (id === 'headset') {
    const { x, y, z, ry } = headsetPose(portrait);
    return { x, y, z, ry };
  }
  if (id === 'mug' || id === 'pad') {
    const base = DECOR_BODY_HOMES[id];
    const override = portrait ? PORTRAIT_PLACES[id] : undefined;
    return override
      ? { x: override.x, y: 0, z: override.z, ry: override.ry ?? base.ry }
      : { ...base, y: 0 };
  }
  if (isDecorBodyId(id)) {
    const { x, z, ry } = decorPlacement(id, portrait);
    return { x, y: 0, z, ry };
  }
  const pose = ITEM_POSES[id];
  const override = portrait ? PORTRAIT_PLACES[id] : undefined;
  return override
    ? { x: override.x, y: pose.y, z: override.z, ry: override.ry ?? pose.ry }
    : { x: pose.x, y: pose.y, z: pose.z, ry: pose.ry };
}

/** La place de repos d'un corps vue de dessus, selon le format. */
export function homePlace(id: BodyId, portrait: boolean): DeskPlace {
  const { x, z, ry } = homePose(id, portrait);
  return { x, z, ry };
}

/** Le corps est-il absent de ce format (décor caché en portrait, faute de place) ? */
export function bodyHidden(id: BodyId, portrait: boolean): boolean {
  if (!portrait || !isDecorBodyId(id) || id === 'mug' || id === 'pad') return false;
  return decorPlacement(id, true).hidden;
}

/** Le rectangle d'un corps posé à une place. */
export function bodyObb(id: FootprintId, place: DeskPlace): Obb {
  const { cx, cz, hw, hd } = BODY_FOOTPRINTS[id];
  const cos = Math.cos(place.ry);
  const sin = Math.sin(place.ry);
  return {
    x: place.x + cx * cos + cz * sin,
    z: place.z - cx * sin + cz * cos,
    ry: place.ry,
    hw,
    hd,
  };
}

/** Les quatre coins d'un rectangle, dans l'ordre (x, z). */
export function obbCorners(box: Obb): [number, number][] {
  const cos = Math.cos(box.ry);
  const sin = Math.sin(box.ry);
  return (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([sx, sz]): [number, number] => {
    const lx = sx * box.hw;
    const lz = sz * box.hd;
    return [box.x + lx * cos + lz * sin, box.z - lx * sin + lz * cos];
  });
}

/**
 * Profondeur de chevauchement de deux rectangles (théorème de l'axe
 * séparateur) : 0 s'ils ne se touchent pas, sinon la plus petite distance
 * qui les sépare. margin écarte les rectangles d'autant (marge de sécurité).
 */
export function obbPenetration(a: Obb, b: Obb, margin = 0): number {
  const axes: [number, number][] = [
    [Math.cos(a.ry), -Math.sin(a.ry)],
    [Math.sin(a.ry), Math.cos(a.ry)],
    [Math.cos(b.ry), -Math.sin(b.ry)],
    [Math.sin(b.ry), Math.cos(b.ry)],
  ];
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  let depth = Infinity;
  for (const [ax, az] of axes) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const [x, z] of ca) {
      const p = x * ax + z * az;
      minA = Math.min(minA, p);
      maxA = Math.max(maxA, p);
    }
    for (const [x, z] of cb) {
      const p = x * ax + z * az;
      minB = Math.min(minB, p);
      maxB = Math.max(maxB, p);
    }
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB) + margin;
    if (overlap <= 0) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}

/** Le rectangle sort-il des limites (BOUNDS) ? Renvoie le dépassement le plus grand. */
export function obbOutside(
  box: Obb,
  bounds: { x0: number; x1: number; z0: number; z1: number },
): number {
  let out = 0;
  for (const [x, z] of obbCorners(box)) {
    out = Math.max(out, bounds.x0 - x, x - bounds.x1, bounds.z0 - z, z - bounds.z1);
  }
  return out;
}

/**
 * La pose d'un corps, mutable, écrite à chaque image par le moteur physique
 * (jamais réactive : la lire dans useFrame avec getState()). Avant que le
 * moteur ne soit chargé, et pour tout corps jamais touché, c'est sa place
 * d'origine du format courant.
 */
export interface DeskBodyState extends DeskPose {
  /** L'orientation complète (quaternion) : un corps peut être renversé. */
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  /** Le corps n'est plus à sa place d'origine (déplacé, poussé, renversé, tombé). */
  moved: boolean;
  /** Le corps est tombé du plateau (sous le dessus du bureau). */
  fallen: boolean;
  /** Le corps n'existe pas dans ce format (décor caché en portrait). */
  hidden: boolean;
  /** Pendant l'arrivée, le corps n'est pas encore tombé sur le bureau (core/drop.ts) : il n'est pas dessiné. */
  waiting: boolean;
}

/** Les corps du bureau : un état par corps. */
export type DeskBodies = Record<BodyId, DeskBodyState>;

/** Sous cette hauteur (origine du corps), il est tombé du plateau. */
export const FALLEN_Y = -0.6;

/** Écarts au-delà desquels un corps a quitté sa place d'origine. */
export const MOVED = { distance: 0.03, angle: 0.04 } as const;

/** Pose un corps à une pose de repos (orientation : ry seul). */
export function setHomePose(body: DeskBodyState, pose: DeskPose): void {
  body.x = pose.x;
  body.y = pose.y;
  body.z = pose.z;
  body.ry = pose.ry;
  body.qx = 0;
  body.qy = Math.sin(pose.ry / 2);
  body.qz = 0;
  body.qw = Math.cos(pose.ry / 2);
  body.moved = false;
  body.fallen = false;
}

/** L'angle autour de y d'une orientation (le cap, même renversé). */
export function yawOf(qx: number, qy: number, qz: number, qw: number): number {
  return Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx));
}

/** L'angle (radians) entre l'orientation d'un corps et sa pose d'origine. */
function angleFromHome(body: DeskBodyState, home: DeskPose): number {
  const hy = Math.sin(home.ry / 2);
  const hw = Math.cos(home.ry / 2);
  const dot = Math.abs(body.qy * hy + body.qw * hw);
  return 2 * Math.acos(Math.min(1, dot));
}

/** Le corps a-t-il quitté sa pose d'origine ? */
export function isMoved(body: DeskBodyState, home: DeskPose): boolean {
  const distance = Math.hypot(body.x - home.x, body.y - home.y, body.z - home.z);
  return distance > MOVED.distance || angleFromHome(body, home) > MOVED.angle;
}

function newBody(pose: DeskPose, hidden: boolean): DeskBodyState {
  const body: DeskBodyState = {
    ...pose,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 1,
    moved: false,
    fallen: false,
    hidden,
    waiting: false,
  };
  setHomePose(body, pose);
  return body;
}

export function createDeskBodies(portrait = false): DeskBodies {
  return Object.fromEntries(
    BODY_IDS.map((id) => [id, newBody(homePose(id, portrait), bodyHidden(id, portrait))]),
  ) as DeskBodies;
}

/** Remet tous les corps à leur place d'origine (Rejouer, rangement), sans recréer l'objet. */
export function resetDeskBodies(desk: DeskBodies, portrait = false): DeskBodies {
  for (const id of BODY_IDS) {
    setHomePose(desk[id], homePose(id, portrait));
    desk[id].hidden = bodyHidden(id, portrait);
  }
  return desk;
}

/**
 * Cale les corps que personne n'a déplacés sur leur place d'origine du
 * format courant (le bureau se resserre en portrait). Appelé par ClockDriver
 * à chaque image, avant le moteur physique.
 */
export function syncDeskBodies(desk: DeskBodies, portrait: boolean): void {
  for (const id of BODY_IDS) {
    const body = desk[id];
    body.hidden = bodyHidden(id, portrait);
    if (body.moved) continue;
    const home = homePose(id, portrait);
    if (body.x !== home.x || body.z !== home.z || body.ry !== home.ry || body.y !== home.y) {
      setHomePose(body, home);
    }
  }
}

/** Les places des corps déplacés, copiées (état réactif du store, attribut data-places). */
export type DeskPlaces = Partial<Record<BodyId, DeskPlace>>;

export function movedPlaces(desk: DeskBodies): DeskPlaces {
  const places: DeskPlaces = {};
  for (const id of BODY_IDS) {
    const { moved, x, z, ry } = desk[id];
    if (moved) places[id] = { x, z, ry };
  }
  return places;
}

/** Les corps tombés du plateau, dans l'ordre de BODY_IDS. */
export function fallenIds(desk: DeskBodies): BodyId[] {
  return BODY_IDS.filter((id) => desk[id].fallen && !desk[id].hidden);
}

/** data-places du HUD : « id:x,z,ry » séparés par des espaces, au centième, dans l'ordre de BODY_IDS. */
export function formatPlaces(places: DeskPlaces): string {
  return BODY_IDS.flatMap((id) => {
    const place = places[id];
    return place
      ? [`${id}:${place.x.toFixed(2)},${place.z.toFixed(2)},${place.ry.toFixed(2)}`]
      : [];
  }).join(' ');
}
