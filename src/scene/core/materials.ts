import {
  Color,
  MeshStandardMaterial,
  SRGBColorSpace,
  type ColorRepresentation,
  type Side,
  type Texture,
} from 'three';
import type { Rgb } from './mood-values';

// Cache de matériaux, comme M() dans le prototype : une couleur et des
// réglages donnent toujours le même matériau. Un matériau du cache est
// partagé : ne jamais le modifier (créer le sien pour l'animer).

export interface StandardOptions {
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  side?: Side;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

const cache = new Map<string, MeshStandardMaterial>();

/** Matériau mat et facetté par défaut (roughness 0.82, flatShading), tiré du cache. */
export function standardMaterial(
  color: ColorRepresentation,
  options: StandardOptions = {},
): MeshStandardMaterial {
  const key = `${String(color)}|${JSON.stringify(options)}`;
  let material = cache.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
      ...options,
    });
    cache.set(key, material);
  }
  return material;
}

/** Laiton (charnières, rotules, coins du coffret). */
export const brass = () => standardMaterial(0xc9973f, { roughness: 0.38, metalness: 0.75 });

/** Fer noirci (bras de la lampe, du micro, pieds). */
export const iron = () => standardMaterial(0x1d1b19, { roughness: 0.55, metalness: 0.45 });

/**
 * Matériau d'une texture peinte (texMat du prototype) : la même texture sert
 * d'émissive, d'intensité 0 au repos ; l'augmenter fait luire l'objet
 * (survol, présentation). Hors cache : un par objet.
 */
export function texturedMaterial(
  map: Texture,
  options: StandardOptions = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map,
    roughness: 0.75,
    metalness: 0,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0,
    ...options,
  });
}

/** Applique une couleur d'ambiance (composantes sRGB) à une couleur three. */
export function applyRgb(color: Color, rgb: Rgb): Color {
  return color.setRGB(rgb.r, rgb.g, rgb.b, SRGBColorSpace);
}
