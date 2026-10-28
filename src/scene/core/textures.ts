'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import {
  loadSceneFonts,
  readSceneFonts,
  sceneFontsVersion,
  subscribeSceneFonts,
  type SceneFonts,
} from './fonts';

// Textures peintes en code sur un canvas 2D, comme dans le prototype.
// Différences avec r128 : la texture est déclarée sRGB (la gestion des
// couleurs est active), et elle se redessine quand les polices arrivent.

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fonts: SceneFonts,
) => void;

export interface CanvasTextureOptions {
  width: number;
  height: number;
  draw: DrawFn;
  /** Redessine quand cette valeur change (un texte, une langue...). */
  redrawKey?: string | number;
  /** Répétition (u, v), avec enroulement. */
  repeat?: readonly [number, number];
  /** Dessine en miroir horizontal (verso vu par en dessous). */
  mirror?: boolean;
  /** false pour une texture de données (masque, alpha) : pas de conversion sRGB. */
  srgb?: boolean;
  /** Anisotropie maximale (8 par défaut, bornée par la carte graphique). */
  anisotropy?: number;
}

/** Crée la texture d'un canvas, sans la dessiner. */
export function createCanvasTexture(
  gl: WebGLRenderer,
  { width, height, repeat, srgb = true, anisotropy = 8 }: CanvasTextureOptions,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(anisotropy, gl.capabilities.getMaxAnisotropy());
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

/**
 * (Re)dessine une texture de canvas. À appeler aussi dans useFrame pour une
 * texture animée (l'écran qui se tape), seulement quand son contenu change.
 */
export function paintCanvasTexture(
  texture: CanvasTexture,
  draw: DrawFn,
  fonts: SceneFonts = readSceneFonts(),
  mirror = false,
): void {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  draw(ctx, width, height, fonts);
  ctx.restore();
  texture.needsUpdate = true;
}

/** Les polices des textures, et un numéro qui change quand elles sont chargées. */
export function useSceneFonts(): { fonts: SceneFonts; version: number } {
  const version = useSyncExternalStore(subscribeSceneFonts, sceneFontsVersion, () => 0);
  useEffect(() => {
    void loadSceneFonts();
  }, []);
  // Les noms ne changent pas, mais on les relit une fois les polices chargées.
  const fonts = useMemo(() => {
    void version;
    return readSceneFonts();
  }, [version]);
  return { fonts, version };
}

/**
 * Une texture peinte en code, dessinée au montage, quand les polices sont
 * prêtes et quand redrawKey change. Libérée au démontage.
 */
export function useCanvasTexture(options: CanvasTextureOptions): CanvasTexture {
  const gl = useThree((state) => state.gl);
  const { width, height, draw, redrawKey, mirror = false } = options;
  const { fonts, version } = useSceneFonts();
  // La texture ne dépend que de sa taille ; le reste se règle au dessin.
  const texture = useMemo(
    () => createCanvasTexture(gl, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gl, width, height],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useLayoutEffect(() => {
    paintCanvasTexture(texture, draw, fonts, mirror);
    // draw n'entre pas dans les dépendances : passer redrawKey pour redessiner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, fonts, version, redrawKey, mirror]);
  return texture;
}
