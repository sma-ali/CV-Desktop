import { HEADSET_STAND, ITEM_POSES, MONITOR } from './constants';
import { PORTRAIT_PLACES } from './framing';
import { BODY_IDS, type BodyId, type DecorBodyId } from './ids';

// Les corps posés sur le plateau, vus de dessus (étape 4) : où ils reposent,
// ce qu'ils occupent (un rectangle orienté, OBB), et leur état mutable
// pendant un glisser. Données pures, sans three : le solveur des collisions
// (partie « gestes ») et les tests les lisent. Repère du prototype : x vers
// la droite, z vers le visiteur, ry autour de l'axe vertical (sens de three :
// un point local (lx, lz) va en x = lx cos ry + lz sin ry,
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
 * Encombrement de chaque corps glissable, d'après sa géométrie (les lanières
 * et les câbles plats ne comptent pas). Le coffret est décalé de -0.2 en z
 * dans son repère (Chest.tsx), comme sa boîte.
 */
export const BODY_FOOTPRINTS = {
  book: { cx: 0, cz: 0, hw: 0.95, hd: 1.25 },
  badge: { cx: 0, cz: 0, hw: 0.43, hd: 0.62 },
  laptop: { cx: 0, cz: 0, hw: 1.35, hd: 0.93 },
  card: { cx: 0, cz: 0, hw: 0.85, hd: 0.5 },
  chest: { cx: 0, cz: -0.2, hw: 0.83, hd: 0.54 },
  netherbrain: { cx: 0, cz: 0, hw: 0.42, hd: 0.42 },
  homelab: { cx: 0, cz: 0, hw: 0.5, hd: 0.4 },
  // La tasse et son anse (à droite), la manette et ses poignées (vers l'avant).
  mug: { cx: 0.08, cz: 0, hw: 0.4, hd: 0.31 },
  pad: { cx: 0, cz: 0.08, hw: 0.68, hd: 0.38 },
} as const satisfies Record<BodyId, Footprint>;

/** Places de repos de la tasse et de la manette (le décor les pose là). */
export const DECOR_BODY_HOMES = {
  mug: { x: 4.55, z: -0.62, ry: 0 },
  pad: { x: 5.1, z: 1.95, ry: 0.45 },
} as const satisfies Record<DecorBodyId, DeskPlace>;

/**
 * Les objets du CV qui ne glissent pas mais occupent le plateau : le pied de
 * l'écran et le support du casque. Le décor ajoute les siens
 * (DECOR_OBSTACLES dans src/scene/decor/layout.ts).
 */
export const FIXED_ITEM_OBSTACLES: readonly DeskObstacle[] = [
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

/** La place de repos d'un corps, selon le format (voir PORTRAIT_PLACES). */
export function homePlace(id: BodyId, portrait: boolean): DeskPlace {
  const base: DeskPlace =
    id === 'mug' || id === 'pad'
      ? { ...DECOR_BODY_HOMES[id] }
      : { x: ITEM_POSES[id].x, z: ITEM_POSES[id].z, ry: ITEM_POSES[id].ry };
  const override = portrait ? PORTRAIT_PLACES[id] : undefined;
  if (!override) return base;
  return { x: override.x, z: override.z, ry: override.ry ?? base.ry };
}

/** Le rectangle d'un corps posé à une place. */
export function bodyObb(id: BodyId, place: DeskPlace): Obb {
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
 * L'état d'un corps sur le plateau, mutable, mis à jour à chaque image par
 * les gestes (jamais réactif : le lire dans useFrame avec getState()).
 */
export interface DeskBodyState extends DeskPlace {
  /** Le visiteur l'a déplacé (ou il a été poussé) : il ne suit plus sa place de repos. */
  moved: boolean;
  /** Hauteur au-dessus du plateau (soulevé pendant le glisser, rebond au lâcher). */
  lift: number;
  /** Inclinaison selon la vitesse (radians, autour de x et de z). */
  tiltX: number;
  tiltZ: number;
  /** Écrasement au rebond (0 : aucun, 1 : le plus fort). */
  squash: number;
}

/** Les corps du plateau : un état par corps glissable. */
export type DeskBodies = Record<BodyId, DeskBodyState>;

export function createDeskBodies(portrait = false): DeskBodies {
  return Object.fromEntries(
    BODY_IDS.map((id) => [
      id,
      { ...homePlace(id, portrait), moved: false, lift: 0, tiltX: 0, tiltZ: 0, squash: 0 },
    ]),
  ) as DeskBodies;
}

/** Remet tous les corps à leur place de repos (Rejouer), sans recréer l'objet. */
export function resetDeskBodies(desk: DeskBodies, portrait = false): DeskBodies {
  for (const id of BODY_IDS) {
    Object.assign(desk[id], homePlace(id, portrait), {
      moved: false,
      lift: 0,
      tiltX: 0,
      tiltZ: 0,
      squash: 0,
    });
  }
  return desk;
}

/**
 * Cale les corps que personne n'a déplacés sur leur place de repos du format
 * courant (le coffret change de place en portrait). Appelé par le socle à
 * chaque image, avant les gestes.
 */
export function syncDeskBodies(desk: DeskBodies, portrait: boolean): void {
  for (const id of BODY_IDS) {
    const body = desk[id];
    if (body.moved) continue;
    const home = homePlace(id, portrait);
    body.x = home.x;
    body.z = home.z;
    body.ry = home.ry;
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

/** data-places du HUD : « id:x,z,ry » séparés par des espaces, au centième, dans l'ordre de BODY_IDS. */
export function formatPlaces(places: DeskPlaces): string {
  return BODY_IDS.flatMap((id) => {
    const place = places[id];
    return place
      ? [`${id}:${place.x.toFixed(2)},${place.z.toFixed(2)},${place.ry.toFixed(2)}`]
      : [];
  }).join(' ');
}
