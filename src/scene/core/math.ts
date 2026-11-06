// Les petites fonctions de maths de la scène, sans three : bornes,
// interpolations, courbes d'adoucissement et lissage par image.

/** value bornée à [min, max]. */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** De a (t = 0) à b (t = 1), sans borne. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Avancement de t entre a et b, borné à [0, 1]. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);

/** Adoucie au début et à la fin (cubique), pour t dans [0, 1]. */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Adoucie à la fin seulement (cubique), pour t dans [0, 1]. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** smoothstep entre 0 et 1, pour t dans [0, 1]. */
export const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Lissage exponentiel indépendant du nombre d'images par seconde : la part
 * de l'écart à rattraper pendant dt (s), quand il reste keep de l'écart au
 * bout d'une seconde (0.02 : il reste 2 % après une seconde). S'emploie
 * comme lerp(current, target, damp(keep, dt)).
 */
export const damp = (keep: number, dt: number) => 1 - Math.pow(keep, dt);
