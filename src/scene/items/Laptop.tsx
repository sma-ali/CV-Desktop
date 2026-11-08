'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, PlaneGeometry, type Group } from 'three';
import { seg } from '../core/math';
import { ITEM_POSES } from '../core/constants';
import { Box, flatPlaneGeometry } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import type { SceneTexts } from '../core/texts';
import { useSceneStoreApi } from '../core/store-context';
import { useCanvasTexture } from '../core/textures';
import { autoScroll, autoScrollTime, clampScroll, LAPTOP_SCROLL } from './laptopScroll';
import { TagAnchor } from './TagLayer';
import {
  LAPTOP_SCREEN,
  LAPTOP_TEXTURE,
  laptopScreenHeight,
  paintLaptopKeys,
  paintLaptopScreen,
  paintLaptopStickers,
} from './paint';
import { deskRestPose } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le portable fermé couvert d'autocollants (projets 2026 : Netherbrain et
// Homelab). Présenté, il s'ouvre devant la caméra et son écran s'allume :
// toutes les compétences du CV, qui défilent seules (laptopScroll.ts) ou à
// la molette. En mouvement réduit, seule la molette les fait défiler.

const W = 2.7;
const D = 1.85;
const aluminium = () => standardMaterial(0x8f8a82, { roughness: 0.45, metalness: 0.5 });
/** Pixels logiques de défilement par pixel de molette. */
const WHEEL_SCALE = 0.6;

/** Où en est le défilement de l'écran. */
interface ScrollState {
  /** Instant où l'écran a fini de s'ouvrir (null : fermé). */
  openedAt: number | null;
  /** Décalage choisi à la molette (null : défilement automatique). */
  manual: number | null;
  /** Instant du dernier coup de molette. */
  wheelAt: number;
  /** Décalage affiché. */
  offset: number;
}

export function Laptop({ texts }: { texts: SceneTexts }) {
  const { content, locale, skills } = texts;
  const store = useSceneStoreApi();
  const domElement = useThree((state) => state.gl.domElement);
  const lid = useRef<Group>(null);
  const scroll = useRef<ScrollState>({ openedAt: null, manual: null, wheelAt: 0, offset: 0 });

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
  // La toile de l'écran est plus haute que l'écran : on n'en montre qu'une fenêtre.
  const screenHeight = useMemo(() => laptopScreenHeight(skills), [skills]);
  const range = screenHeight - LAPTOP_SCREEN.visible;
  const screenTexture = useCanvasTexture({
    width: LAPTOP_TEXTURE.width,
    height: Math.round((screenHeight * LAPTOP_TEXTURE.width) / LAPTOP_SCREEN.width),
    draw: useMemo(() => paintLaptopScreen(content, skills), [content, skills]),
    redrawKey: locale,
  });
  const visibleShare = LAPTOP_SCREEN.visible / screenHeight;
  useEffect(() => {
    screenTexture.repeat.set(1, visibleShare);
    screenTexture.offset.set(0, 1 - visibleShare);
  }, [screenTexture, visibleShare]);

  // La molette fait défiler l'écran du portable tenu.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const scene = store.getState();
      if (scene.presented !== 'laptop') return;
      const state = scroll.current;
      state.manual = clampScroll(
        (state.manual ?? state.offset) + event.deltaY * WHEEL_SCALE,
        range,
      );
      state.wheelAt = scene.frame.t;
    };
    domElement.addEventListener('wheel', onWheel, { passive: true });
    return () => domElement.removeEventListener('wheel', onWheel);
  }, [domElement, store, range]);
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
    animate: ({ f }, frame) => {
      const k = f * f * (3 - 2 * f);
      if (lid.current) lid.current.rotation.x = -1.86 * k;
      screen.color.setScalar(seg(f, 0.3, 0.9));

      const state = scroll.current;
      const now = frame.t;
      if (f < 0.999) {
        // Fermé ou en train de bouger : l'écran repart du haut.
        state.openedAt = null;
        state.manual = null;
        state.offset = 0;
      } else {
        state.openedAt ??= now;
        const reduced = store.getState().settings.reducedMotion;
        if (state.manual !== null && (reduced || now - state.wheelAt < LAPTOP_SCROLL.resume)) {
          state.offset = state.manual;
        } else {
          if (state.manual !== null) {
            // Le défilement automatique reprend là où la molette l'a laissé.
            state.openedAt = now - autoScrollTime(state.manual, range);
            state.manual = null;
          }
          state.offset = reduced ? 0 : autoScroll(now - state.openedAt, range);
        }
      }
      const share = range > 0 ? state.offset / range : 0;
      screenTexture.offset.setY((1 - visibleShare) * (1 - share));
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
