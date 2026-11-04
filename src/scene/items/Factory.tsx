'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import { ARRIVAL, ITEM_POSES, legacyPointIntensity, POINT_DECAY } from '../core/constants';
import { Box, Cyl } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import { activityPulse, type LifeSigns } from '@/lib/life-signs/types';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { heartbeat, type Pulse } from './beats';
import { cassetteAt, CASSETTES, puffAt, PUFFS } from './factory';
import { TagAnchor } from './TagLayer';
import { MergedBoxes, type BoxPiece } from './merged';
import { paintPlaque, PLAQUE_TEXTURE } from './paint';
import { deskRestPose, ITEMS_PRIORITY, type PresentState } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// L'usine (projets perso) : une mini usine low poly, à la place du coffret
// scellé (décision du 04/11/2026), sur le même encombrement (BODY_FOOTPRINTS
// et la forme physique du coffret, id 'chest'). Une halle en brique à trois
// toits, un bureau clair aux fenêtres allumées, une cheminée, et un tapis
// roulant qui sort des cassettes. Elle se met en marche à ARRIVAL.chestLed ;
// son rythme suit les signes de vie (activityPulse) : tapis plus rapide,
// fumée plus dense, fenêtres qui battent. En mouvement réduit, rien ne
// bouge : fenêtres allumées, tapis arrêté, une bouffée immobile.

/** Portée de la lueur des fenêtres. */
const GLOW_DISTANCE = 2.4;
/** L'usine recule dans son repère, comme le coffret : elle ne mord pas sur le livre. */
const OFFSET_Z = -0.2;

// La halle : à gauche, trois toits à deux pans.
const HALL = { x: -0.25, w: 0.96, h: 0.42, d: 0.72, z: -0.04 } as const;
const BASE_H = 0.06;
const ROOF_R = HALL.w / 3 / Math.sqrt(3);
// Le bureau : à droite, plus bas, avec la cheminée derrière.
const OFFICE = { x: 0.5, w: 0.5, h: 0.3, d: 0.5, z: 0.06 } as const;
const CHIMNEY = { x: 0.56, z: -0.3, r: 0.065, h: 0.62 } as const;
// Le tapis : de la porte de la halle vers l'avant droit.
const BELT = { x0: -0.55, x1: 0.62, y: 0.13, z: 0.47, w: 0.13 } as const;

const STATIC_PIECES: BoxPiece[] = [
  // Le socle de béton.
  { size: [1.64, BASE_H, 1.06], position: [0, BASE_H / 2, -0.02], color: 0x7d8274 },
  // La halle et sa porte.
  {
    size: [HALL.w, HALL.h, HALL.d],
    position: [HALL.x, BASE_H + HALL.h / 2, HALL.z],
    color: 0xa5543a,
  },
  {
    size: [0.26, 0.2, 0.02],
    position: [HALL.x - 0.2, BASE_H + 0.1, HALL.z + HALL.d / 2 + 0.005],
    color: 0x3b2a22,
  },
  // Le bureau.
  {
    size: [OFFICE.w, OFFICE.h, OFFICE.d],
    position: [OFFICE.x, BASE_H + OFFICE.h / 2, OFFICE.z],
    color: 0xdccaa0,
  },
  {
    size: [OFFICE.w + 0.04, 0.035, OFFICE.d + 0.04],
    position: [OFFICE.x, BASE_H + OFFICE.h + 0.017, OFFICE.z],
    color: 0x5b6068,
  },
  // Le tapis roulant et ses pieds.
  {
    size: [BELT.x1 - BELT.x0, 0.025, BELT.w],
    position: [(BELT.x0 + BELT.x1) / 2, BELT.y, BELT.z],
    color: 0x2c2b2a,
  },
  ...[BELT.x0 + 0.08, (BELT.x0 + BELT.x1) / 2, BELT.x1 - 0.08].map((x): BoxPiece => ({
    size: [0.03, BELT.y - BASE_H, BELT.w * 0.8],
    position: [x, BASE_H + (BELT.y - BASE_H) / 2, BELT.z],
    color: 0x55524e,
  })),
];

/** Les fenêtres du bureau, en façade, qui s'allument. */
const WINDOWS: [number, number][] = [
  [OFFICE.x - 0.12, BASE_H + 0.19],
  [OFFICE.x + 0.12, BASE_H + 0.19],
];

/** Couleurs des cassettes, à tour de rôle. */
const CASSETTE_COLORS = [0xd9a74a, 0x8d2a20, 0xe9dcbd] as const;

/** Le battement retenu pour des signes de vie donnés (calculé une fois par objet reçu). */
function pulseFor(signs: LifeSigns | null, cache: { signs?: LifeSigns | null; pulse?: Pulse }) {
  if (cache.pulse && cache.signs === signs) return cache.pulse;
  cache.signs = signs;
  cache.pulse = activityPulse(signs);
  return cache.pulse;
}

export function Factory({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const store = useSceneStoreApi();
  const glowLight = useRef<PointLight>(null);
  const held = useRef<PresentState | null>(null);
  const pulse = useRef<{ signs?: LifeSigns | null; pulse?: Pulse }>({});
  const cassettes = useRef<(Mesh | null)[]>([]);
  const puffs = useRef<(Mesh | null)[]>([]);
  const smoke = useRef<Group>(null);

  const plaque = usePaintedMaterial(
    useMemo(() => paintPlaque(content), [content]),
    { ...PLAQUE_TEXTURE, redrawKey: locale, roughness: 0.35, metalness: 0.45 },
  );
  const plaqueGeometry = useMemo(() => new PlaneGeometry(0.5, 0.16), []);
  const windowGeometry = useMemo(() => new PlaneGeometry(0.14, 0.1), []);
  const puffGeometry = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const windowMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x1a1612 }), []);
  const puffMaterials = useMemo(
    () =>
      Array.from(
        { length: PUFFS },
        () =>
          new MeshStandardMaterial({
            color: 0xd8d4cc,
            roughness: 1,
            flatShading: true,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
      ),
    [],
  );
  useEffect(
    () => () => {
      plaqueGeometry.dispose();
      windowGeometry.dispose();
      puffGeometry.dispose();
      windowMaterial.dispose();
      for (const material of puffMaterials) material.dispose();
    },
    [plaqueGeometry, windowGeometry, puffGeometry, windowMaterial, puffMaterials],
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
    const scene = store.getState();
    const { frame, settings } = scene;
    const reduced = settings.reducedMotion;
    const on = frame.t >= ARRIVAL.chestLed ? 1 : 0;
    // Secondes depuis la mise en marche (0 en mouvement réduit : rien ne bouge).
    const run = reduced ? 0 : Math.max(0, frame.t - ARRIVAL.chestLed);
    const current = pulseFor(scene.lifeSigns, pulse.current);
    const beat = reduced ? 0.25 : heartbeat(frame.t, current);

    // Les fenêtres : éteintes avant la mise en marche, puis chaudes, au rythme de l'activité.
    windowMaterial.color.setRGB(
      0.1 + on * (0.75 + beat * 0.25),
      0.09 + on * (0.5 + beat * 0.2),
      0.07 + on * 0.18,
    );

    // Le tapis : les cassettes avancent de la porte vers le bout, puis repartent.
    cassettes.current.forEach((mesh, i) => {
      if (!mesh) return;
      const u = on ? cassetteAt(run, i, current) : i / CASSETTES;
      mesh.position.x = BELT.x0 + 0.1 + u * (BELT.x1 - BELT.x0 - 0.2);
      // Elles apparaissent à la porte et disparaissent au bout.
      const edge = Math.min(1, u * 8, (1 - u) * 8);
      mesh.scale.setScalar(Math.max(0.001, edge));
    });

    // La fumée : seulement en marche.
    if (smoke.current) smoke.current.visible = on > 0;
    puffs.current.forEach((mesh, i) => {
      const material = puffMaterials[i];
      if (!mesh || !material) return;
      const puff = reduced
        ? { rise: 0.12, scale: 0.08, opacity: i === 0 ? 0.5 : 0 }
        : puffAt(run, i, current);
      mesh.position.y = puff.rise;
      mesh.position.x = puff.rise * 0.25;
      mesh.scale.setScalar(puff.scale);
      material.opacity = puff.opacity;
    });

    const p = held.current?.p ?? 0;
    if (glowLight.current) {
      glowLight.current.intensity = legacyPointIntensity(
        on * (0.1 + beat * 0.5) * (1 - p * 0.6),
        GLOW_DISTANCE,
      );
    }
  }, ITEMS_PRIORITY);

  const roofY = BASE_H + HALL.h + ROOF_R / 2;
  return (
    <group ref={ref} {...handlers}>
      <group position={[0, 0, OFFSET_Z]}>
        <MergedBoxes pieces={STATIC_PIECES} />
        {/* Les trois toits à deux pans de la halle. */}
        {[-1, 0, 1].map((k) => (
          <Cyl
            key={k}
            radiusTop={ROOF_R}
            radiusBottom={ROOF_R}
            height={HALL.d + 0.04}
            segments={3}
            position={[HALL.x + (k * HALL.w) / 3, roofY, HALL.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={standardMaterial(0x4e535b, { roughness: 0.7 })}
          />
        ))}
        {/* La cheminée, cerclée de blanc en haut. */}
        <Cyl
          radiusTop={CHIMNEY.r * 0.85}
          radiusBottom={CHIMNEY.r}
          height={CHIMNEY.h}
          segments={7}
          position={[CHIMNEY.x, BASE_H + CHIMNEY.h / 2, CHIMNEY.z]}
          material={standardMaterial(0x9a4632, { roughness: 0.8 })}
        />
        <Cyl
          radiusTop={CHIMNEY.r * 0.9}
          radiusBottom={CHIMNEY.r * 0.9}
          height={0.06}
          segments={7}
          position={[CHIMNEY.x, BASE_H + CHIMNEY.h - 0.09, CHIMNEY.z]}
          material={standardMaterial(0xe9dcbd, { roughness: 0.7 })}
        />
        <group ref={smoke} position={[CHIMNEY.x, BASE_H + CHIMNEY.h + 0.04, CHIMNEY.z]}>
          {puffMaterials.map((material, i) => (
            <mesh
              key={i}
              ref={(node) => {
                puffs.current[i] = node;
              }}
              geometry={puffGeometry}
              material={material}
            />
          ))}
        </group>
        {/* Les cassettes sur le tapis. */}
        {CASSETTE_COLORS.slice(0, CASSETTES).map((color, i) => (
          <Box
            key={i}
            ref={(node: Mesh | null) => {
              cassettes.current[i] = node;
            }}
            size={[0.1, 0.05, 0.075]}
            position={[BELT.x0, BELT.y + 0.037, BELT.z]}
            material={standardMaterial(color, { roughness: 0.55 })}
          />
        ))}
        {WINDOWS.map(([x, y]) => (
          <mesh
            key={x}
            geometry={windowGeometry}
            material={windowMaterial}
            position={[x, y, OFFICE.z + OFFICE.d / 2 + 0.004]}
          />
        ))}
        <mesh
          geometry={plaqueGeometry}
          material={plaque}
          position={[HALL.x + 0.2, BASE_H + 0.26, HALL.z + HALL.d / 2 + 0.006]}
        />
        <pointLight
          ref={glowLight}
          color={0xffb860}
          intensity={0}
          distance={GLOW_DISTANCE}
          decay={POINT_DECAY}
          position={[OFFICE.x, 0.3, OFFICE.z + OFFICE.d / 2 + 0.3]}
        />
      </group>
      <TagAnchor id="chest" />
    </group>
  );
}
