import { MOODS, type Vec3 } from './constants';
import type { MoodId } from './ids';

// Valeurs d'une ambiance, prêtes à interpoler. Couleurs en composantes sRGB
// (0 à 1) : les appliquer avec color.setRGB(r, g, b, SRGBColorSpace), ou
// applyRgb() de mood-color.ts. Sans three : ce module tourne aussi en test.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface MoodValues {
  sunColor: Rgb;
  sun: number;
  /** Direction normalisée de la lumière, du soleil vers le bureau. */
  dir: { x: number; y: number; z: number };
  patch: Rgb;
  patchOpacity: number;
  shaft: number;
  hemiSky: Rgb;
  hemiGround: Rgb;
  hemi: number;
  lamp: number;
  wall: Rgb;
  background: Rgb;
  dust: number;
}

export function hexToRgb(hex: number): Rgb {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}

function normalize([x, y, z]: Vec3) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

export function moodValues(mood: MoodId): MoodValues {
  const m = MOODS[mood];
  return {
    sunColor: hexToRgb(m.sunColor),
    sun: m.sun,
    dir: normalize(m.dir),
    patch: hexToRgb(m.patch),
    patchOpacity: m.patchOpacity,
    shaft: m.shaft,
    hemiSky: hexToRgb(m.hemiSky),
    hemiGround: hexToRgb(m.hemiGround),
    hemi: m.hemi,
    lamp: m.lamp,
    wall: hexToRgb(m.wall),
    background: hexToRgb(m.background),
    dust: m.dust,
  };
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixRgb = (a: Rgb, b: Rgb, k: number, out: Rgb) => {
  out.r = mix(a.r, b.r, k);
  out.g = mix(a.g, b.g, k);
  out.b = mix(a.b, b.b, k);
};

/** Recopie a dans out, sans créer d'objet. */
export function copyMoodValues(a: MoodValues, out: MoodValues): MoodValues {
  return blendMoodValues(a, a, 0, out);
}

/** Interpole deux ambiances (k de 0 à 1) dans out, sans créer d'objet. */
export function blendMoodValues(
  a: MoodValues,
  b: MoodValues,
  k: number,
  out: MoodValues,
): MoodValues {
  mixRgb(a.sunColor, b.sunColor, k, out.sunColor);
  out.sun = mix(a.sun, b.sun, k);
  const dir = normalize([
    mix(a.dir.x, b.dir.x, k),
    mix(a.dir.y, b.dir.y, k),
    mix(a.dir.z, b.dir.z, k),
  ]);
  out.dir.x = dir.x;
  out.dir.y = dir.y;
  out.dir.z = dir.z;
  mixRgb(a.patch, b.patch, k, out.patch);
  out.patchOpacity = mix(a.patchOpacity, b.patchOpacity, k);
  out.shaft = mix(a.shaft, b.shaft, k);
  mixRgb(a.hemiSky, b.hemiSky, k, out.hemiSky);
  mixRgb(a.hemiGround, b.hemiGround, k, out.hemiGround);
  out.hemi = mix(a.hemi, b.hemi, k);
  out.lamp = mix(a.lamp, b.lamp, k);
  mixRgb(a.wall, b.wall, k, out.wall);
  mixRgb(a.background, b.background, k, out.background);
  out.dust = mix(a.dust, b.dust, k);
  return out;
}
