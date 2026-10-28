'use client';

import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../core/constants';

// Les petites pièces répétées d'un objet (tranches des pages, marque-pages,
// coins de laiton, cartes de la pile) fusionnées en une seule géométrie à
// couleurs par sommet : un seul appel de dessin au lieu d'un par pièce.

export interface BoxPiece {
  size: Vec3;
  position: Vec3;
  rotationY?: number;
  color: number;
}

/** Fusionne des boîtes en une géométrie, avec leur couleur par sommet. */
export function mergeBoxes(pieces: readonly BoxPiece[]): BufferGeometry {
  const color = new Color();
  const parts = pieces.map(({ size, position, rotationY = 0, color: hex }) => {
    const box = new BoxGeometry(...size);
    if (rotationY) box.rotateY(rotationY);
    box.translate(...position);
    color.setHex(hex);
    const count = box.attributes.position?.count ?? 0;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
    box.setAttribute('color', new BufferAttribute(colors, 3));
    return box;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error('fusion des boîtes impossible');
  return merged;
}

const materials = new Map<string, MeshStandardMaterial>();

/** Matériau à couleurs par sommet, partagé (ne jamais le modifier). */
export function vertexColorMaterial(roughness = 0.8, metalness = 0): MeshStandardMaterial {
  const key = `${roughness}|${metalness}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      vertexColors: true,
      roughness,
      metalness,
      flatShading: true,
    });
    materials.set(key, material);
  }
  return material;
}

type MeshProps = Omit<ThreeElements['mesh'], 'geometry' | 'args'>;

/** Des boîtes fusionnées, dessinées en une fois. pieces doit rester stable (constante ou useMemo). */
export function MergedBoxes({
  pieces,
  roughness,
  metalness,
  ...props
}: MeshProps & { pieces: readonly BoxPiece[]; roughness?: number; metalness?: number }) {
  const geometry = useMemo(() => mergeBoxes(pieces), [pieces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={vertexColorMaterial(roughness, metalness)}
      castShadow
      receiveShadow
      {...props}
    />
  );
}
