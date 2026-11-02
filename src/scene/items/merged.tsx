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

/** Une pièce quelconque (cylindre, tube...) déjà placée, et sa couleur. */
export interface ColoredPart {
  geometry: BufferGeometry;
  color: number;
}

/**
 * Fusionne des géométries placées en une seule, avec leur couleur par
 * sommet. Les pièces sont libérées. Si certaines sont indexées et d'autres
 * non (un tube et une boîte), toutes passent en triangles non indexés.
 */
export function mergeColored(parts: readonly ColoredPart[]): BufferGeometry {
  const color = new Color();
  const indexed = parts.every(({ geometry }) => geometry.index !== null);
  const prepared = parts.map(({ geometry, color: hex }) => {
    const flat = indexed || !geometry.index ? geometry : geometry.toNonIndexed();
    if (flat !== geometry) geometry.dispose();
    color.setHex(hex);
    const count = flat.attributes.position?.count ?? 0;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
    flat.setAttribute('color', new BufferAttribute(colors, 3));
    return flat;
  });
  const merged = mergeGeometries(prepared);
  prepared.forEach((part) => part.dispose());
  if (!merged) throw new Error('fusion des pièces impossible');
  return merged;
}

/** Fusionne des boîtes en une géométrie, avec leur couleur par sommet. */
export function mergeBoxes(pieces: readonly BoxPiece[]): BufferGeometry {
  return mergeColored(
    pieces.map(({ size, position, rotationY = 0, color }) => {
      const box = new BoxGeometry(...size);
      if (rotationY) box.rotateY(rotationY);
      box.translate(...position);
      return { geometry: box, color };
    }),
  );
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

/** Des pièces fusionnées, dessinées en une fois. build doit rester stable (fonction du module). */
export function MergedParts({
  build,
  roughness,
  metalness,
  ...props
}: MeshProps & { build: () => ColoredPart[]; roughness?: number; metalness?: number }) {
  const geometry = useMemo(() => mergeColored(build()), [build]);
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
