'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PlaneGeometry, type Group } from 'three';
import { ITEM_POSES } from '../core/constants';
import { Box, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { TagAnchor } from './TagLayer';
import { MergedBoxes, type BoxPiece } from './merged';
import { BOOK_PAGE, paintBookBack, paintBookCover, paintBookLeft, paintBookRight } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le grand livre du PHP (DEFI-METIERS, 2020) : couverture, tranche, pages
// et marque-pages. Présenté, il s'ouvre devant la caméra sur le poste
// (page de gauche) et une page de code Drupal / PHP (à droite).

const W = 1.9;
const D = 2.5;

const cover = () => standardMaterial(0x3a4466, { roughness: 0.9 });

// Tranches des pages, marque-pages et fiche glissée : une seule géométrie.
const PIECES: BoxPiece[] = [
  ...Array.from({ length: 7 }, (_, i) => ({
    size: [0.008, 0.012, D - 0.1] as const,
    position: [W / 2 + 0.02, 0.09 + i * 0.05, 0] as const,
    color: 0xb9a77f,
  })),
  {
    size: [0.13, 0.012, 0.62],
    position: [-0.5, 0.45, -D / 2 - 0.2],
    rotationY: 0.06,
    color: 0xa1352a,
  },
  {
    size: [0.13, 0.012, 0.62],
    position: [0.1, 0.45, -D / 2 - 0.2],
    rotationY: -0.08,
    color: 0xe3b54a,
  },
  {
    size: [0.13, 0.012, 0.62],
    position: [0.55, 0.45, -D / 2 - 0.2],
    rotationY: 0.1,
    color: 0x86a07d,
  },
  {
    size: [0.32, 0.01, 0.5],
    position: [0.3, 0.44, -D / 2 - 0.1],
    rotationY: -0.06,
    color: 0xf3e9d4,
  },
];

export function Book({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const inner = useRef<Group>(null);
  const pivot = useRef<Group>(null);

  const page = { ...BOOK_PAGE, redrawKey: locale };
  const coverMaterial = usePaintedMaterial(
    useMemo(() => paintBookCover(content), [content]),
    page,
  );
  const backMaterial = usePaintedMaterial(
    useMemo(() => paintBookBack(content), [content]),
    { ...page, back: true },
  );
  const leftMaterial = usePaintedMaterial(
    useMemo(() => paintBookLeft(content), [content]),
    page,
  );
  const rightMaterial = usePaintedMaterial(
    useMemo(() => paintBookRight(content), [content]),
    page,
  );

  const geometries = useMemo(() => {
    const leftPage = new PlaneGeometry(W - 0.12, D - 0.14);
    leftPage.rotateX(Math.PI / 2);
    leftPage.rotateY(Math.PI);
    return {
      rightPage: flatPlaneGeometry(W - 0.12, D - 0.14),
      cover: flatPlaneGeometry(W + 0.06, D + 0.04),
      leftPage,
    };
  }, []);
  useEffect(
    () => () => Object.values(geometries).forEach((geometry) => geometry.dispose()),
    [geometries],
  );

  const rest = useMemo(() => deskRestPose(ITEM_POSES.book), []);
  const glow = useMemo(
    () => [coverMaterial, backMaterial, leftMaterial, rightMaterial],
    [coverMaterial, backMaterial, leftMaterial, rightMaterial],
  );
  const { ref, handlers } = usePresentation({
    id: 'book',
    rest,
    seed: 1.3,
    glow,
    animate: ({ f }) => {
      // Le livre s'ouvre : la couverture tourne sur la tranche, le bloc glisse pour rester centré.
      const k = f * f * (3 - 2 * f);
      if (pivot.current) pivot.current.rotation.z = Math.PI * 0.985 * k;
      if (inner.current) inner.current.position.x = W * 0.5 * k;
    },
  });

  return (
    <group ref={ref} {...handlers}>
      <group ref={inner}>
        <Box size={[W + 0.08, 0.06, D + 0.08]} position={[0, 0.03, 0]} material={cover()} />
        <mesh geometry={geometries.cover} material={backMaterial} position={[0, -0.001, 0]} />
        <Box
          size={[W - 0.02, 0.38, D - 0.04]}
          position={[0.03, 0.25, 0]}
          material={standardMaterial(0xe9dcbd, { roughness: 0.95 })}
        />
        <Box size={[0.1, 0.52, D + 0.08]} position={[-W / 2 - 0.01, 0.26, 0]} material={cover()} />
        <MergedBoxes pieces={PIECES} roughness={0.75} />
        <mesh
          geometry={geometries.rightPage}
          material={rightMaterial}
          position={[0.04, 0.442, 0]}
          receiveShadow
        />
        <group ref={pivot} position={[-W / 2 - 0.05, 0.47, 0]}>
          <Box
            size={[W + 0.1, 0.06, D + 0.08]}
            position={[W / 2 + 0.05, 0.03, 0]}
            material={cover()}
          />
          <mesh
            geometry={geometries.cover}
            material={coverMaterial}
            position={[W / 2 + 0.05, 0.061, 0]}
            receiveShadow
          />
          <mesh
            geometry={geometries.leftPage}
            material={leftMaterial}
            position={[W / 2 + 0.06, -0.002, 0]}
          />
        </group>
      </group>
      <TagAnchor id="book" />
    </group>
  );
}
