import { ARRIVAL, SETTLE } from './constants';

// Les niveaux de l'arrivée, fonctions pures du temps T (secondes depuis
// l'ouverture de la page). Toutes les parties de la scène les lisent ici (ou
// dans frame, voir store.ts), pour que la lampe, l'écran et la fenêtre restent
// synchrones.

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Avancement de t entre a et b, borné à [0, 1]. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Les grandes étapes de l'arrivée, exposées au HUD et aux tests. */
export type ArrivalPhase = 'dark' | 'lamp' | 'screen' | 'window' | 'settled';

export function arrivalPhase(t: number): ArrivalPhase {
  if (t >= SETTLE) return 'settled';
  if (t >= ARRIVAL.windowStart) return 'window';
  if (t >= ARRIVAL.screenOn) return 'screen';
  if (t >= ARRIVAL.lampOn) return 'lamp';
  return 'dark';
}

/**
 * Ce que le HUD montre selon l'avancement de l'arrivée. Le HUD est visible
 * dès le HTML du serveur ; une fois la scène prête, l'identité et les puces
 * s'effacent pendant l'arrivée et reviennent à leur heure, comme dans le
 * prototype.
 */
export interface HudFlags {
  /** Le carton « Bienvenue chez Ali ». */
  carton: boolean;
  /** L'identité, en haut à gauche. */
  brand: boolean;
  /** Les puces du CV, l'heure et les ambiances, en bas. */
  chips: boolean;
  /** Les étiquettes des objets. */
  tags: boolean;
  /** L'indication en haut de l'écran. */
  hint: boolean;
}

export function hudFlags(t: number): HudFlags {
  return {
    carton: t >= ARRIVAL.cartonIn && t < ARRIVAL.cartonOut,
    brand: t >= ARRIVAL.brandIn,
    chips: t >= ARRIVAL.chipsIn,
    tags: t >= ARRIVAL.tagsIn,
    hint: t >= SETTLE,
  };
}

/**
 * Niveau de la lampe (0 à 1, un peu plus au deuxième scintillement) :
 * noir, clic, deux scintillements, puis pleine lumière. switchedAt est
 * l'instant où on l'a allumée (ARRIVAL.lampOn à l'arrivée).
 */
export function lampLevel(t: number, switchedAt: number = ARRIVAL.lampOn, on = true): number {
  if (!on || t < switchedAt) return 0;
  const s = t - switchedAt;
  if (s < 0.06) return 1;
  if (s < 0.13) return 0.15;
  if (s < 0.2) return 1.1;
  if (s < 0.27) return 0.45;
  return Math.min(1, 0.8 + s * 0.6);
}

/** L'éclat de l'allumage, qui s'éteint en une seconde environ. */
export function lampFlash(t: number, switchedAt: number = ARRIVAL.lampOn, on = true): number {
  const s = t - switchedAt;
  return on && s > 0.2 ? Math.exp(-(s - 0.2) * 2.8) * 1.15 : 0;
}

/** L'écran qui se réveille (0 à 1), avec un battement au démarrage. */
export function screenLevel(t: number): number {
  const flicker = t > ARRIVAL.screenOn && t < 2.4 ? 0.6 : 1;
  return seg(t, ARRIVAL.screenOn, ARRIVAL.screenFull) * flicker;
}

/** La LED du clavier (0 à 1). */
export function keyboardLedLevel(t: number): number {
  return smooth(seg(t, ARRIVAL.keyboardLedOn, ARRIVAL.keyboardLedFull));
}

/** Nombre de caractères tapés à l'écran à l'instant t, sans borne : à chaque objet de le borner. */
export function typedChars(t: number): number {
  return Math.floor(Math.max(0, (t - ARRIVAL.typingStart) * ARRIVAL.typingRate));
}

/**
 * Caractères visibles de la ligne finale (tapée, laissée, effacée, puis
 * absente), une fois tout le code tapé. length : longueur de la ligne.
 */
export function extraLineChars(t: number, length: number): number {
  const lt = (t - ARRIVAL.extraLineStart) % ARRIVAL.extraLineLoop;
  if (t < ARRIVAL.extraLineStart || lt < 0) return 0;
  if (lt < 3) return Math.floor((lt / 3) * length);
  if (lt < 7) return length;
  if (lt < 8.2) return Math.floor((1 - (lt - 7) / 1.2) * length);
  return 0;
}

/** La lumière de la fenêtre (0 à 1). */
export function windowLevel(t: number): number {
  return smooth(seg(t, ARRIVAL.windowStart, ARRIVAL.windowEnd));
}

/** La lumière d'ambiance (hémisphère), de 0 à 1. */
export function ambientLevel(t: number): number {
  return smooth(seg(t, ARRIVAL.ambientStart, ARRIVAL.ambientEnd));
}

/** Avancement de la montée de caméra (0 à 1). */
export function cameraProgress(t: number): number {
  return ease(seg(t, ARRIVAL.cameraStart, ARRIVAL.cameraEnd));
}

/** La i-ème LED du pavé de boutons est-elle allumée ? */
export function deckLedOn(t: number, index: number): boolean {
  return t >= ARRIVAL.deckLedsStart + index * ARRIVAL.deckLedsStep;
}
