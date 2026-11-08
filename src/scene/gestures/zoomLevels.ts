import type { DeskBounds } from '../core/constants';

// Le zoom du visiteur, à la molette ou au pincement : fonctions pures.
// Sur le bureau, la caméra se rapproche du point visé (comme une carte) et
// ne quitte jamais le plateau. Sur un objet tenu (ou l'écran en gros plan),
// l'objet se rapproche ou s'éloigne. Le réglage vit dans le moyeu des gestes
// (gestureHub(store).zoom) : la caméra et les objets le lisent à chaque image.

export const ZOOM = {
  /** Bureau : 1 = vue de repos, jusqu'à 2.6 fois plus près. */
  desk: { min: 1, max: 2.6 },
  /** Objet tenu : un peu plus loin ou jusqu'à 2.2 fois plus près. */
  held: { min: 0.7, max: 2.2 },
  /** Facteur par pixel de molette (deltaY), en exponentielle. */
  wheel: 0.0018,
} as const;

/** Le zoom du bureau : facteur et décalage de la cible sur le plateau. */
export interface DeskZoom {
  zoom: number;
  x: number;
  z: number;
}

/** Le facteur d'un coup de molette : vers le bas, on recule. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * ZOOM.wheel);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Le zoom d'un objet tenu, multiplié par factor, dans ses limites. */
export function zoomHeld(zoom: number, factor: number): number {
  return clamp(zoom * factor, ZOOM.held.min, ZOOM.held.max);
}

/**
 * Zoome le bureau de factor vers le point du plateau visé (null : vers le
 * centre de la vue). La cible se déplace vers ce point pour qu'il reste sous
 * le pointeur, puis reste dans le plateau : plus on est près, plus on peut
 * s'écarter du centre ; revenu à 1, la vue est celle du repos.
 */
export function zoomDesk(
  state: DeskZoom,
  factor: number,
  point: { x: number; z: number } | null,
  center: { x: number; z: number },
  bounds: DeskBounds,
): DeskZoom {
  const zoom = clamp(state.zoom * factor, ZOOM.desk.min, ZOOM.desk.max);
  let { x, z } = state;
  if (point) {
    const k = 1 - state.zoom / zoom;
    x += (point.x - (center.x + x)) * k;
    z += (point.z - (center.z + z)) * k;
  }
  // Jusqu'où la cible peut s'écarter du centre : rien au repos, presque
  // tout le demi-plateau au plus près.
  const reach = 1 - 1 / zoom;
  const halfX = ((bounds.x1 - bounds.x0) / 2) * reach;
  const halfZ = ((bounds.z1 - bounds.z0) / 2) * reach;
  const midX = (bounds.x0 + bounds.x1) / 2 - center.x;
  const midZ = (bounds.z0 + bounds.z1) / 2 - center.z;
  return {
    zoom,
    x: clamp(x, midX - halfX, midX + halfX),
    z: clamp(z, midZ - halfZ, midZ + halfZ),
  };
}

/**
 * L'écart entre deux doigts devenu ratio : le facteur d'un pincement depuis
 * l'image précédente (1 si l'un des écarts est nul).
 */
export function pinchFactor(previous: number, current: number): number {
  if (previous <= 0 || current <= 0) return 1;
  return current / previous;
}
