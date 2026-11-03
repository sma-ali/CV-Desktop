import type { DeskBodies } from '../core/bodies';
import { BODY_IDS, isDecorBodyId, type BodyId } from '../core/ids';
import { DECOR_BODY_SPECS } from '../decor/colliders';
import { ITEM_BODY_SPECS, lowestPoint, type BodySpec } from '../physics/shapes';

// L'encombrement grossier de chaque corps, d'après ses formes de collision
// (sphère autour de son origine) : de quoi savoir, sans interroger le
// moteur, si quelque chose occupe la place où un corps va se poser, et à
// quelle hauteur. Volontairement large : mieux vaut lâcher un corps d'un
// peu plus haut que l'enfoncer dans un autre. Données pures.

/** La plus grande distance entre l'origine d'un corps et un point de ses formes. */
export function bodyReach(spec: BodySpec): number {
  let reach = 0;
  for (const shape of spec.shapes) {
    if (shape.kind === 'capsule') {
      reach = Math.max(reach, Math.hypot(...shape.from) + shape.radius);
      reach = Math.max(reach, Math.hypot(...shape.to) + shape.radius);
      continue;
    }
    const center = Math.hypot(...(shape.at ?? [0, 0, 0]));
    const extent =
      shape.kind === 'ball'
        ? shape.radius
        : shape.kind === 'cylinder'
          ? Math.hypot(shape.radius, shape.halfHeight)
          : Math.hypot(...shape.half);
    reach = Math.max(reach, center + extent);
  }
  return reach;
}

const specOf = (id: BodyId): BodySpec =>
  isDecorBodyId(id) ? DECOR_BODY_SPECS[id] : ITEM_BODY_SPECS[id];

const REACH = Object.fromEntries(BODY_IDS.map((id) => [id, bodyReach(specOf(id))])) as Record<
  BodyId,
  number
>;

const BOTTOM = Object.fromEntries(
  BODY_IDS.map((id) => [id, Math.max(0, -lowestPoint(specOf(id)))]),
) as Record<BodyId, number>;

/** L'encombrement d'un corps (rayon de sa sphère autour de son origine). */
export const reachOf = (id: BodyId): number => REACH[id];

/** De combien le point le plus bas d'un corps debout descend sous son origine. */
export const bottomOf = (id: BodyId): number => BOTTOM[id];

/**
 * La hauteur sous laquelle un corps ne doit pas descendre au-dessus de sa
 * place (x, z) : le haut de ce qui l'occupe (autres corps du monde, pas
 * cachés), ou -Infinity si elle est libre.
 */
export function occupiedHeight(
  desk: DeskBodies,
  id: BodyId,
  x: number,
  z: number,
  ignore: (other: BodyId) => boolean,
): number {
  let top = -Infinity;
  const reach = REACH[id];
  for (const other of BODY_IDS) {
    if (other === id || ignore(other)) continue;
    const body = desk[other];
    if (body.hidden) continue;
    if (Math.hypot(body.x - x, body.z - z) < reach + REACH[other]) {
      top = Math.max(top, body.y + REACH[other]);
    }
  }
  return top;
}
