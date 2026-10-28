'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, PlaneGeometry, type Group } from 'three';
import { seg } from '../core/arrival';
import { ITEM_POSES } from '../core/constants';
import { Box, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { useCanvasTexture } from '../core/textures';
import { TagAnchor } from './TagLayer';
import { LAPTOP_TEXTURE, paintLaptopKeys, paintLaptopScreen, paintLaptopStickers } from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le portable fermé couvert d'autocollants (projets 2026 : Netherbrain et
// Homelab). Présenté, il s'ouvre devant la caméra et son écran s'allume.

const W = 2.7;
const D = 1.85;
const aluminium = () => standardMaterial(0x8f8a82, { roughness: 0.45, metalness: 0.5 });

export function Laptop({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const lid = useRef<Group>(null);

  const stickers = usePaintedMaterial(
    useMemo(() => paintLaptopStickers(content), [content]),
    { ...LAPTOP_TEXTURE, redrawKey: locale },
  );
  const keys = usePaintedMaterial(paintLaptopKeys, {
    width: 512,
    height: 352,
    redrawKey: 'keys',
    usesFonts: false,
  });
  const screenTexture = useCanvasTexture({
    ...LAPTOP_TEXTURE,
    draw: useMemo(() => paintLaptopScreen(content), [content]),
    redrawKey: locale,
  });
  const screen = useMemo(
    () => new MeshBasicMaterial({ map: screenTexture, color: 0x000000, toneMapped: false }),
    [screenTexture],
  );

  const geometries = useMemo(() => {
    const display = new PlaneGeometry(W - 0.24, D - 0.24);
    display.rotateX(Math.PI / 2);
    return {
      keys: flatPlaneGeometry(W - 0.1, D - 0.1),
      stickers: flatPlaneGeometry(W - 0.04, D - 0.04),
      display,
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      screen.dispose();
    },
    [geometries, screen],
  );

  const rest = useMemo(() => deskRestPose(ITEM_POSES.laptop), []);
  const glow = useMemo(() => [stickers, keys], [stickers, keys]);
  const { ref, handlers } = usePresentation({
    id: 'laptop',
    rest,
    seed: 1.45,
    glow,
    animate: ({ f }) => {
      const k = f * f * (3 - 2 * f);
      if (lid.current) lid.current.rotation.x = -1.86 * k;
      screen.color.setScalar(seg(f, 0.3, 0.9));
    },
  });

  return (
    <group ref={ref} {...handlers}>
      <Box size={[W, 0.09, D]} position={[0, 0.045, 0]} material={aluminium()} />
      <mesh geometry={geometries.keys} material={keys} position={[0, 0.091, 0]} receiveShadow />
      <group ref={lid} position={[0, 0.092, -D / 2]}>
        <Box size={[W, 0.07, D]} position={[0, 0.035, D / 2]} material={aluminium()} />
        <mesh
          geometry={geometries.stickers}
          material={stickers}
          position={[0, 0.071, D / 2]}
          receiveShadow
        />
        <mesh geometry={geometries.display} material={screen} position={[0, -0.001, D / 2]} />
      </group>
      <TagAnchor id="laptop" />
    </group>
  );
}
