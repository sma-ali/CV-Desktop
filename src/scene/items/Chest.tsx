'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, PlaneGeometry, type PointLight } from 'three';
import { ARRIVAL, ITEM_POSES, legacyPointIntensity, POINT_DECAY } from '../core/constants';
import { Box, Cyl } from '../core/geometry';
import { brass, standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { TagAnchor } from './TagLayer';
import { MergedBoxes, type BoxPiece } from './merged';
import { paintPlaque, PLAQUE_TEXTURE } from './paint';
import { deskRestPose, ITEMS_PRIORITY, type PresentState } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

/** Portée de la lueur verte du coffret. */
const GLOW_DISTANCE = 2.6;

// Le coffret scellé (projets perso) : il ne dit jamais ce qu'il contient.
// Plus grand et plus clair que dans le prototype (défaut connu : petit et
// sombre), bois blond, laiton et ruban rouge. Sa LED et le joint du
// couvercle battent comme un cœur ; présenté, il tremble un peu. Ses signes
// de vie (chiffres) viendront à l'étape 4.

const CW = 1.5;
const CH = 0.66;
const CD = 1.02;
/** Le coffret recule un peu dans son repère : il ne mord plus sur le livre. */
const OFFSET_Z = -0.2;

const CORNERS: BoxPiece[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([sx = 0, sz = 0]) => ({
  size: [0.12, CH + 0.27, 0.12],
  position: [sx * (CW / 2 + 0.02), (CH + 0.27) / 2, sz * (CD / 2)],
  color: 0xd9a74a,
}));

/** Le battement de la LED : un coup bref toutes les 2.4 s environ. */
const beatAt = (t: number) => Math.pow(Math.max(0, Math.sin(t * 2.6)), 10);

export function Chest({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const store = useSceneStoreApi();
  const glowLight = useRef<PointLight>(null);
  const held = useRef<PresentState | null>(null);

  const plaque = usePaintedMaterial(
    useMemo(() => paintPlaque(content), [content]),
    { ...PLAQUE_TEXTURE, redrawKey: locale, roughness: 0.35, metalness: 0.45 },
  );
  const plaqueGeometry = useMemo(() => new PlaneGeometry(0.82, 0.26), []);
  const led = useMemo(() => new MeshBasicMaterial({ color: 0x0b2a17 }), []);
  const seam = useMemo(() => new MeshBasicMaterial({ color: 0x000000 }), []);
  useEffect(
    () => () => {
      plaqueGeometry.dispose();
      led.dispose();
      seam.dispose();
    },
    [plaqueGeometry, led, seam],
  );

  const rest = useMemo(() => deskRestPose(ITEM_POSES.chest), []);
  const glow = useMemo(() => [plaque], [plaque]);
  const { ref, handlers } = usePresentation({
    id: 'chest',
    rest,
    seed: 0.78,
    glow,
    glowBase: 0.1,
    animate: (state) => {
      held.current = state;
    },
  });

  useFrame(() => {
    const { frame, settings } = store.getState();
    const on = frame.t >= ARRIVAL.chestLed ? 1 : 0;
    // Mouvement réduit : la LED reste allumée, sans battement.
    const beat = settings.reducedMotion ? 0.25 : beatAt(frame.t);
    led.color.setRGB(on * (0.1 + beat * 0.4), on * (0.45 + beat * 1.5), on * (0.2 + beat * 0.6));
    seam.color.setRGB(on * (0.25 + beat * 0.9), on * (0.14 + beat * 0.5), on * 0.04);
    if (glowLight.current) {
      const p = held.current?.p ?? 0;
      glowLight.current.intensity = legacyPointIntensity(
        on * (0.12 + beat * 0.9) * (1 - p * 0.6),
        GLOW_DISTANCE,
      );
    }
  }, ITEMS_PRIORITY);

  return (
    <group ref={ref} {...handlers}>
      <group position={[0, 0, OFFSET_Z]}>
        <Box
          size={[CW, CH, CD]}
          position={[0, CH / 2, 0]}
          material={standardMaterial(0x7a4b2b, { roughness: 0.6 })}
        />
        <group position={[0, CH + 0.01, -CD / 2]}>
          <Box
            size={[CW + 0.07, 0.26, CD + 0.05]}
            position={[0, 0.13, CD / 2]}
            material={standardMaterial(0x8c5935, { roughness: 0.6 })}
          />
          <Box
            size={[CW * 0.8, 0.03, CD * 0.73]}
            position={[0, 0.275, CD / 2]}
            material={standardMaterial(0xa06d42, { roughness: 0.5 })}
          />
        </group>
        <MergedBoxes pieces={CORNERS} material={brass()} />
        {/* Le ruban rouge qui scelle le coffret, et son cachet de cire. */}
        <Box
          size={[0.11, CH + 0.3, CD + 0.04]}
          position={[0.22, (CH + 0.3) / 2, 0]}
          material={standardMaterial(0xa83a2c, { roughness: 0.8 })}
        />
        <Cyl
          radiusTop={0.15}
          radiusBottom={0.16}
          height={0.06}
          segments={9}
          position={[0.22, CH * 0.8, CD / 2 + 0.04]}
          rotation={[Math.PI / 2, 0, 0]}
          material={standardMaterial(0xb8402f, { roughness: 0.35 })}
        />
        <mesh
          geometry={plaqueGeometry}
          material={plaque}
          position={[-0.28, CH * 0.44, CD / 2 + 0.006]}
        />
        <mesh position={[0.56, CH * 0.44, CD / 2 + 0.02]} material={led}>
          <sphereGeometry args={[0.05, 8, 6]} />
        </mesh>
        <mesh position={[0, CH + 0.005, 0]} material={seam}>
          <boxGeometry args={[CW + 0.03, 0.02, CD + 0.03]} />
        </mesh>
        <pointLight
          ref={glowLight}
          color={0x4fe08a}
          intensity={0}
          distance={GLOW_DISTANCE}
          decay={POINT_DECAY}
          position={[0.56, 0.36, CD / 2 + 0.35]}
        />
      </group>
      <TagAnchor id="chest" />
    </group>
  );
}
