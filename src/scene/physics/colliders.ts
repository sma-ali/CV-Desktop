import type { ColliderDesc } from '@dimforge/rapier3d-compat';
import type { ShapeSpec } from './shapes';

// Les formes de collision (shapes.ts, decorShapes.ts) traduites en
// descriptions Rapier, sans état : le monde (world.ts) les pose sur ses corps.

/** Le module Rapier (sa forme « compat », WebAssembly embarqué). */
export type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];

/** Pose une forme Rapier d'après sa description. */
export function colliderDesc(rapier: RapierModule, shape: ShapeSpec): ColliderDesc {
  const { ColliderDesc } = rapier;
  if (shape.kind === 'capsule') {
    const [ax, ay, az] = shape.from;
    const [bx, by, bz] = shape.to;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const length = Math.hypot(dx, dy, dz) || 1;
    // L'axe de la gélule (y local) tourné vers le segment.
    const q = fromUnitY(dx / length, dy / length, dz / length);
    return ColliderDesc.capsule(length / 2, shape.radius)
      .setTranslation((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
      .setRotation(q);
  }
  const [x, y, z] = shape.at ?? [0, 0, 0];
  let desc: ColliderDesc;
  if (shape.kind === 'ball') return ColliderDesc.ball(shape.radius).setTranslation(x, y, z);
  if (shape.kind === 'cylinder') desc = prism(rapier, shape.radius, shape.halfHeight);
  else desc = ColliderDesc.cuboid(shape.half[0], shape.half[1], shape.half[2]);
  desc.setTranslation(x, y, z);
  if (shape.rotation) desc.setRotation(fromEuler(...shape.rotation));
  return desc;
}

/** Côtés du prisme qui remplace un cylindre. */
const PRISM_SIDES = 10;

/**
 * Un cylindre en prisme à PRISM_SIDES côtés (axe y), comme les objets low
 * poly qu'il habille : couché, il se pose sur une face au lieu de rouler
 * et de trembler contre une arête (le cylindre exact de Rapier le fait).
 */
function prism(rapier: RapierModule, radius: number, halfHeight: number): ColliderDesc {
  const points = new Float32Array(PRISM_SIDES * 6);
  for (let i = 0; i < PRISM_SIDES; i++) {
    const a = (i / PRISM_SIDES) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    points.set([x, -halfHeight, z, x, halfHeight, z], i * 6);
  }
  return rapier.ColliderDesc.convexHull(points) ?? rapier.ColliderDesc.cylinder(halfHeight, radius);
}

/** Quaternion qui amène l'axe y sur la direction (x, y, z) unitaire. */
function fromUnitY(x: number, y: number, z: number) {
  // Rotation la plus courte de (0, 1, 0) vers (x, y, z).
  const dot = y;
  if (dot < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
  const cx = z;
  const cz = -x;
  const w = 1 + dot;
  const n = Math.hypot(cx, cz, w) || 1;
  return { x: cx / n, y: 0, z: cz / n, w: w / n };
}

/** Quaternion d'angles d'Euler XYZ (ordre de three). */
function fromEuler(ax: number, ay: number, az: number) {
  const c1 = Math.cos(ax / 2);
  const c2 = Math.cos(ay / 2);
  const c3 = Math.cos(az / 2);
  const s1 = Math.sin(ax / 2);
  const s2 = Math.sin(ay / 2);
  const s3 = Math.sin(az / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}
