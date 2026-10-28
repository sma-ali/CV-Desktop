'use client';

import { useEffect, useMemo } from 'react';
import { BackSide, FrontSide, type MeshStandardMaterial } from 'three';
import { texturedMaterial } from '../core/materials';
import { useCanvasTexture } from '../core/textures';
import type { Painter } from './paint';

export interface PaintedOptions {
  width: number;
  height: number;
  /** Redessine quand cette clé change (la langue). */
  redrawKey: string;
  /** Face arrière d'un plan : la texture est peinte en miroir. */
  back?: boolean;
  roughness?: number;
  metalness?: number;
  /** Teinte multipliée à la texture (blanc par défaut). */
  color?: number;
  /** false pour une face sans texte : pas de second dessin à l'arrivée des polices. */
  usesFonts?: boolean;
}

/**
 * Le matériau d'une face peinte (texPlane du prototype) : texture de canvas
 * qui sert aussi d'émissive, pour que l'objet luise au survol. Matériau et
 * texture sont libérés au démontage.
 */
export function usePaintedMaterial(
  draw: Painter,
  {
    width,
    height,
    redrawKey,
    back = false,
    roughness = 0.75,
    metalness = 0,
    color = 0xffffff,
    usesFonts = true,
  }: PaintedOptions,
): MeshStandardMaterial {
  const texture = useCanvasTexture({
    width,
    height,
    draw,
    redrawKey,
    mirror: back,
    usesFonts,
  });
  const material = useMemo(() => {
    const created = texturedMaterial(texture, {
      side: back ? BackSide : FrontSide,
      roughness,
      metalness,
    });
    created.color.setHex(color);
    return created;
  }, [texture, back, roughness, metalness, color]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
