import { clamp, lerp, seg, smooth } from '../core/arrival';
import { legacyIntensity, legacyPointIntensity } from '../core/constants';
import type { MoodId } from '../core/ids';

// Les niveaux de lumière de la mise en scène, en fonctions pures (testées) :
// update() du prototype, recalibré pour three récent.
//
// Le prototype (three r128) n'avait pas de gestion des couleurs : il
// multipliait des couleurs d'affichage, alors qu'on calcule maintenant en
// linéaire avant d'encoder en sRGB. Pour un même résultat à l'écran, une
// lumière seule devrait valoir i^2.2 ; mais les lumières s'additionnent, et
// la somme compte. D'où, à partir de legacyIntensity() (facteur π) :
// - un facteur de calage par lumière, réglé à l'œil sur les captures de
//   référence (hémisphère et soleil plus bas, lampe plus haute : sa tache
//   saturait dans le prototype) ;
// - les montées de l'arrivée (ambiance, fenêtre) passées à la puissance
//   2.2, pour que le noir du début reste noir comme dans le prototype.
// Les ajouts en mélange additif (cône, tache de la fenêtre, rais, poussière)
// se font aussi en linéaire : un petit ajout y pèse plus lourd, d'où leurs
// facteurs propres.

/** Portée de la lueur de l'écran et de la lumière de l'objet tenu (prototype). */
export const POINT_LIGHT_DISTANCE = 9;

/** Exposant qui fait passer une montée d'affichage (prototype) en linéaire. */
export const DISPLAY_GAMMA = 2.2;

/** Facteurs de calage par rapport au prototype (1 : la valeur du prototype, multipliée par π). */
export const CALIBRATION = {
  hemi: 0.62,
  sun: 0.7,
  spot: 2.0,
  /** La lumière de l'écran (lumière ponctuelle, atténuée comme dans le prototype). */
  monitor: 1,
  /** La lumière qui éclaire l'objet tenu devant la caméra. */
  hand: 1,
  /** Mélanges additifs, en espace linéaire. */
  cone: 0.3,
  patch: 0.45,
  shaft: 0.35,
  dust: 0.7,
} as const;

/**
 * Les intensités des ambiances, relatives à celle de l'après-midi (la
 * référence du calage). Dans le prototype, une lumière deux fois plus faible
 * donnait une image deux fois plus sombre ; en linéaire, il faut l'élever à
 * la puissance 2.2 pour garder cet écart : sans cela, le soir et la nuit
 * restaient presque aussi clairs que l'après-midi.
 */
export const MOOD_REFERENCE = { hemi: 0.42, sun: 0.42 } as const;

const relative = (value: number, reference: number) =>
  reference * Math.pow(value / reference, DISPLAY_GAMMA);

/** La lumière d'ambiance (hémisphère) : presque noire au départ, puis celle de l'ambiance. */
export function hemiIntensity(ambient: number, moodHemi: number): number {
  if (moodHemi <= 0) return 0;
  const ramp = lerp(0.06 / moodHemi, 1, ambient);
  const level = relative(moodHemi, MOOD_REFERENCE.hemi);
  return legacyIntensity(level * Math.pow(ramp, DISPLAY_GAMMA)) * CALIBRATION.hemi;
}

/** Le soleil par la fenêtre, qui arrive avec windowLevel. */
export function sunIntensity(window: number, moodSun: number): number {
  if (moodSun <= 0) return 0;
  const level = relative(moodSun, MOOD_REFERENCE.sun);
  return legacyIntensity(Math.pow(window, DISPLAY_GAMMA) * level) * CALIBRATION.sun;
}

/**
 * Surcroît de la lampe tant que la fenêtre n'éclaire pas (0.55 dans le
 * prototype) : en linéaire, la tache saturait, d'où une valeur plus basse.
 */
export const SPOT_BOOST = 0.3;

/**
 * Le projecteur de la lampe : plus fort tant que la fenêtre n'éclaire pas
 * encore (le « boum » de l'arrivée), plus l'éclat de l'allumage.
 */
export function spotIntensity(lamp: number, flash: number, window: number, moodLamp: number) {
  return (
    legacyIntensity(lamp * 0.98 * moodLamp * (1 + SPOT_BOOST * (1 - window)) + flash) *
    CALIBRATION.spot
  );
}

/** Opacité du cône visible de la lampe ; plus discret en plein après-midi. */
export function coneOpacity(lamp: number, flash: number, window: number, mood: MoodId): number {
  const level = lamp * (0.06 + 0.1 * (1 - window) + flash * 0.05);
  return level * (mood === 'afternoon' ? 0.7 : 1) * CALIBRATION.cone;
}

/** Force du bloom : un peu plus quand la lampe éclaire seule, et à l'allumage. */
export function bloomStrength(lamp: number, flash: number, window: number): number {
  return 0.55 + lamp * (1 - window) * 0.35 + flash * 0.35;
}

/**
 * Le fondu depuis le noir de l'arrivée (1 : image pleine). La lampe et la
 * fenêtre l'ouvrent ; en mouvement réduit, l'image est pleine tout de suite.
 */
export function fadeLevel(t: number, lamp: number, window: number, reduced: boolean): number {
  if (reduced) return 1;
  return clamp(lamp * 1.4 + window, 0, 1) * 0.9 + 0.1 * smooth(seg(t, 0.9, 2));
}

/** Opacité de la poussière : elle se voit dans le faisceau de la lampe et dans la lumière du jour. */
export function dustOpacity(lamp: number, window: number, moodDust: number): number {
  return (0.25 * lamp + 0.55 * window) * moodDust * CALIBRATION.dust;
}

/** La tache de la fenêtre sur le plateau, et les rais dans l'air. */
export function patchOpacity(window: number, moodPatch: number): number {
  return window * moodPatch * CALIBRATION.patch;
}

export function shaftOpacity(window: number, moodShaft: number): number {
  return window * moodShaft * CALIBRATION.shaft;
}

/**
 * Le ciel derrière la vitre, sombre avant que la fenêtre n'éclaire. Le
 * facteur multiplie des couleurs linéaires : la montée du prototype passe à
 * la puissance 2.2, sinon le ciel se voyait dès la première seconde.
 */
export function skyLevel(window: number): number {
  return Math.pow(lerp(0.05, 1, window), DISPLAY_GAMMA);
}

/** La lumière de l'écran, sur le clavier et les mains. */
export function monitorIntensity(screen: number): number {
  return legacyPointIntensity(screen * 0.55, POINT_LIGHT_DISTANCE) * CALIBRATION.monitor;
}

/** La lumière qui suit l'objet tenu. */
export function handIntensity(presentLevel: number): number {
  return legacyPointIntensity(presentLevel * 0.75, POINT_LIGHT_DISTANCE) * CALIBRATION.hand;
}

/** Assombrissement autour de l'objet présenté ou de l'écran regardé de près (0 à 0.62). */
export function dimLevel(presentLevel: number, screenFocus: number): number {
  return Math.max(presentLevel, screenFocus) * 0.62;
}
