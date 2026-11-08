// Le défilement de l'écran du portable, fonctions pures du temps. Tenu et
// ouvert, l'écran montre d'abord le haut, descend doucement jusqu'en bas,
// s'y arrête, puis remonte, en boucle. La molette prend la main un moment.
// Les distances sont en pixels logiques de l'écran (LAPTOP_SCREEN).

export const LAPTOP_SCROLL = {
  /** Pause en haut et en bas (secondes). */
  dwell: 2.5,
  /** Vitesse de descente (pixels logiques par seconde). */
  speed: 55,
  /** Secondes sans molette avant que le défilement automatique reprenne. */
  resume: 5,
} as const;

/** Lissage en entrée et en sortie. */
const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * Le décalage automatique (0 : en haut, range : en bas) après t secondes
 * d'écran ouvert.
 */
export function autoScroll(t: number, range: number): number {
  if (range <= 0 || t <= 0) return 0;
  const { dwell, speed } = LAPTOP_SCROLL;
  const travel = range / speed;
  const cycle = 2 * (dwell + travel);
  const u = t % cycle;
  if (u < dwell) return 0;
  if (u < dwell + travel) return ease((u - dwell) / travel) * range;
  if (u < 2 * dwell + travel) return range;
  return (1 - ease((u - 2 * dwell - travel) / travel)) * range;
}

/** Le temps de autoScroll où le décalage vaut offset en descendant : la reprise part de là. */
export function autoScrollTime(offset: number, range: number): number {
  if (range <= 0) return 0;
  const { dwell, speed } = LAPTOP_SCROLL;
  const travel = range / speed;
  const k = Math.min(1, Math.max(0, offset / range));
  // Inverse du lissage par dichotomie (monotone sur [0, 1]).
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < k) lo = mid;
    else hi = mid;
  }
  return dwell + lo * travel;
}

/** Un décalage gardé dans l'écran. */
export function clampScroll(offset: number, range: number): number {
  return Math.min(Math.max(0, range), Math.max(0, offset));
}
