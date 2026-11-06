import {
  DESK,
  DESK_PORTRAIT_Z1,
  DESK_THICKNESS,
  FLOOR_Y,
  headsetStand,
  MONITOR,
  WALL_Z,
  type Vec3,
} from '../core/constants';
import type { ItemBodyId } from '../core/ids';

// Les formes de collision du bureau, en données pures, sans
// three ni Rapier : des boîtes, des cylindres, des boules et des gélules,
// simples pour tenir sur téléphone. Chaque forme est dans le repère du
// corps (son origine : celle du groupe de l'objet, ou l'ancre du morceau du
// décor). Le décor a les siennes dans decorShapes.ts.

/**
 * Une forme de collision, dans le repère du corps. rotation : angles d'Euler
 * XYZ (radians). density remplace celle du corps pour cette forme (un pied
 * lourd sous un bras léger).
 */
export type ShapeSpec = (
  | { kind: 'box'; half: Vec3; at?: Vec3; rotation?: Vec3 }
  | { kind: 'cylinder'; radius: number; halfHeight: number; at?: Vec3; rotation?: Vec3 }
  | { kind: 'ball'; radius: number; at?: Vec3 }
  | { kind: 'capsule'; from: Vec3; to: Vec3; radius: number }
) & { density?: number };

/** Un corps : ses formes, sa densité (1 par défaut), son frottement et son rebond. */
export interface BodySpec {
  shapes: readonly ShapeSpec[];
  density?: number;
  friction?: number;
  restitution?: number;
}

/** Une boîte de demi-côtés half, posée par défaut sur l'origine (son dessous en y = 0). */
export const box = (half: Vec3, at: Vec3 = [0, half[1], 0], rotation?: Vec3): ShapeSpec =>
  rotation ? { kind: 'box', half, at, rotation } : { kind: 'box', half, at };

/**
 * Les objets du CV, d'après leur encombrement au repos (BODY_FOOTPRINTS,
 * BODY_HEIGHTS). La carte porte sa pile (items/cardPile.ts) ; le casque
 * pend à son support par l'arceau (une boîte posée juste au-dessus du haut
 * de la tige, sans la toucher : il reste pendu tant que rien ne le heurte).
 */
export const ITEM_BODY_SPECS: Readonly<Record<ItemBodyId, BodySpec>> = {
  book: { shapes: [box([0.95, 0.21, 1.25])], density: 0.8 },
  badge: { shapes: [box([0.43, 0.025, 0.62])], density: 1.2 },
  laptop: { shapes: [box([1.35, 0.085, 0.93])], density: 1.4 },
  card: { shapes: [box([0.91, 0.04, 0.575], [0, -0.005, 0])], density: 0.9 },
  chest: { shapes: [box([0.83, 0.48, 0.54], [0, 0.48, -0.2])], density: 0.9 },
  netherbrain: {
    shapes: [{ kind: 'cylinder', radius: 0.42, halfHeight: 0.54, at: [0, 0.54, 0] }],
    density: 0.7,
    restitution: 0.25,
  },
  homelab: { shapes: [box([0.5, 0.49, 0.4])], density: 1.3 },
  headset: {
    shapes: [
      box([0.5, 0.03, 0.1], [0, 0.47, 0]),
      box([0.12, 0.22, 0.22], [-0.55, -0.08, 0]),
      box([0.12, 0.22, 0.22], [0.55, -0.08, 0]),
    ],
    density: 0.6,
  },
};

/** Un collisionneur fixe (repère du monde). */
export interface FixedSpec {
  id: string;
  shape: ShapeSpec;
}

/** Le plateau, selon le format (il s'allonge vers le visiteur en portrait). */
export function deskSlab(portrait: boolean): FixedSpec {
  const z1 = portrait ? DESK_PORTRAIT_Z1 : DESK.z1;
  return {
    id: 'desk',
    shape: box(
      [(DESK.x1 - DESK.x0) / 2, DESK_THICKNESS / 2, (z1 - DESK.z0) / 2],
      [(DESK.x0 + DESK.x1) / 2, -DESK_THICKNESS / 2, (DESK.z0 + z1) / 2],
    ),
  };
}

/**
 * Le support du casque (pied, tige), fixe : à sa place du format. Le haut de
 * la tige est à 1.48, l'arceau du casque pendu à 1.52.
 */
export function headsetStandSpecs(portrait: boolean): FixedSpec[] {
  const [x, , z] = headsetStand(portrait);
  return [
    {
      id: 'stand-foot',
      shape: { kind: 'cylinder', radius: 0.4, halfHeight: 0.04, at: [x, 0.04, z] },
    },
    { id: 'stand-pole', shape: box([0.05, 0.74, 0.05], [x, 0.74, z]) },
  ];
}

const [mx, , mz] = MONITOR.position;

/**
 * Ce qui ne bouge jamais : le sol, le mur du fond, des parois invisibles
 * autour de la pièce et un plafond (un objet lancé ne part pas à l'infini),
 * l'écran (pied, tige, dalle inclinée). Le plateau et le support du casque
 * dépendent du format.
 */
export const FIXED_SPECS: readonly FixedSpec[] = [
  { id: 'floor', shape: box([30, 0.5, 30], [0, FLOOR_Y - 0.5, 0]) },
  { id: 'wall', shape: box([30, 15, 0.5], [0, 5, WALL_Z - 0.5]) },
  { id: 'fence-left', shape: box([0.5, 15, 30], [-13, 5, 0]) },
  { id: 'fence-right', shape: box([0.5, 15, 30], [13, 5, 0]) },
  { id: 'fence-front', shape: box([30, 15, 0.5], [0, 5, 10]) },
  { id: 'ceiling', shape: box([30, 0.5, 30], [0, 16, 0]) },
  { id: 'monitor-foot', shape: box([0.75, 0.06, 0.48], [mx, 0.06, mz + 0.1]) },
  { id: 'monitor-neck', shape: box([0.12, 1.0, 0.08], [mx, 1.0, mz - 0.05]) },
  {
    id: 'monitor-panel',
    shape: box(
      [MONITOR.frame.width / 2, MONITOR.frame.height / 2, 0.09],
      [mx, MONITOR.tiltY, mz],
      [MONITOR.tiltX, 0, 0],
    ),
  },
];

/** Le point le plus bas des formes d'un corps (repère du corps, sans rotation du corps). */
export function lowestPoint(spec: BodySpec): number {
  let low = Infinity;
  for (const shape of spec.shapes) {
    if (shape.kind === 'capsule') {
      low = Math.min(low, shape.from[1] - shape.radius, shape.to[1] - shape.radius);
      continue;
    }
    const [, y] = shape.at ?? [0, 0, 0];
    if (shape.kind === 'ball') low = Math.min(low, y - shape.radius);
    else if (shape.kind === 'cylinder') low = Math.min(low, y - shape.halfHeight);
    else {
      // Une boîte tournée : la plus basse de ses demi-diagonales verticales.
      const [rx = 0, , rz = 0] = shape.rotation ?? [0, 0, 0];
      const [hx, hy, hz] = shape.half;
      const reach =
        Math.abs(hy * Math.cos(rx) * Math.cos(rz)) +
        Math.abs(hz * Math.sin(rx)) +
        Math.abs(hx * Math.sin(rz));
      low = Math.min(low, y - reach);
    }
  }
  return low;
}
