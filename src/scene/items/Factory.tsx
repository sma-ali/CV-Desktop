'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, PlaneGeometry, type Group, type Mesh, type PointLight } from 'three';
import { ARRIVAL, ITEM_POSES, legacyPointIntensity, POINT_DECAY } from '../core/constants';
import { Box, Cyl } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import { activityPulse, type LifeSigns } from '@/lib/life-signs/types';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { heartbeat, type Pulse } from './beats';
import { armAngles, cardAt, CARDS, isStamped, stationLevel, STATIONS } from './factory';
import { TagAnchor } from './TagLayer';
import { MergedBoxes, type BoxPiece } from './merged';
import { paintPlaque, PLAQUE_TEXTURE } from './paint';
import { deskRestPose, ITEMS_PRIORITY, type PresentState } from './presentation';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// L'usine (projets perso) : un tapis roulant automatique, sur l'encombrement
// de l'ancien coffret (BODY_FOOTPRINTS et forme physique, id 'chest'). Il
// suit le circuit de la fiche : des cartes vidéo sortent de la machine de
// création, passent sous le scanner (la relecture par les agents), reçoivent
// le tampon du bras robot (la validation humaine) et partent dans le tube
// d'envoi (la publication) ; un petit écran montre les statistiques. Il se
// met en marche à ARRIVAL.chestLed et son rythme suit les signes de vie
// (activityPulse). En mouvement réduit, rien ne bouge : cartes posées, bras
// levé, écran allumé.

/** Portée de la lueur de l'écran. */
const GLOW_DISTANCE = 2.4;
/** L'usine recule dans son repère, comme le coffret : elle ne mord pas sur le livre. */
const OFFSET_Z = -0.2;

const BASE_H = 0.06;
// Le tapis : de la machine de création (à gauche) au tube d'envoi (à droite).
const BELT = { x0: -0.66, x1: 0.66, z: 0.17, w: 0.24, top: 0.25 } as const;
/** Où une carte apparaît (u = 0) et où elle entre dans le tube (u = 1). */
const RUN = { x0: -0.48, x1: 0.56 } as const;
const runX = (u: number) => RUN.x0 + u * (RUN.x1 - RUN.x0);
const CARD = { w: 0.13, h: 0.018, d: 0.17 } as const;
const CARD_Y = BELT.top + CARD.h / 2;
// Le scanner, une arche au-dessus du tapis.
const SCAN_X = runX(STATIONS.scan);
const ARCH = { y: 0.5, half: 0.17 } as const;
// Le bras robot, derrière le tapis, au droit du tampon.
const STAMP_X = runX(STATIONS.stamp);
const ARM = { z: -0.21, shoulder: 0.31, upper: 0.32, lower: 0.3 } as const;
/** Hauteur du tampon : levé, puis posé sur la carte. */
// Le patin vert pend à 0.036 sous la main : posé, il effleure le dessus de la carte.
const STAMP = { up: 0.45, down: CARD_Y + CARD.h / 2 + 0.038, size: 0.1 } as const;
// Le tube d'envoi, debout au bout du tapis.
const TUBE = { x: 0.69, r: 0.11, h: 0.74 } as const;
// L'écran des statistiques, au fond à droite.
const SCREEN = { x: 0.36, z: -0.38, y: 0.3, w: 0.36, h: 0.22 } as const;
/** Les barres du graphique, de gauche à droite (part de la hauteur de l'écran). */
const BARS = [0.35, 0.55, 0.45, 0.7, 0.62, 0.85] as const;
/** Hauteur d'une barre pleine. */
const BAR_FULL = SCREEN.h - 0.06;

const STATIC_PIECES: BoxPiece[] = [
  // Le socle de béton.
  { size: [1.64, BASE_H, 1.06], position: [0, BASE_H / 2, 0], color: 0x7d8274 },
  // Le châssis du tapis, sa bande et ses pieds.
  {
    size: [BELT.x1 - BELT.x0, 0.05, BELT.w + 0.04],
    position: [(BELT.x0 + BELT.x1) / 2, BELT.top - 0.032, BELT.z],
    color: 0x55524e,
  },
  {
    size: [BELT.x1 - BELT.x0, 0.012, BELT.w],
    position: [(BELT.x0 + BELT.x1) / 2, BELT.top - 0.006, BELT.z],
    color: 0x2c2b2a,
  },
  ...[-0.35, 0, 0.35].flatMap((x) =>
    [-1, 1].map((side): BoxPiece => ({
      size: [0.03, BELT.top - BASE_H - 0.05, 0.03],
      position: [x, BASE_H + (BELT.top - BASE_H - 0.05) / 2, BELT.z + side * (BELT.w / 2)],
      color: 0x3d3b39,
    })),
  ),
  // La machine de création, d'où sortent les cartes.
  { size: [0.3, 0.36, 0.38], position: [-0.66, BASE_H + 0.18, BELT.z], color: 0xd9a74a },
  { size: [0.32, 0.04, 0.4], position: [-0.66, BASE_H + 0.38, BELT.z], color: 0x8a6420 },
  { size: [0.02, 0.06, 0.2], position: [-0.505, BELT.top + 0.03, BELT.z], color: 0x1d1b19 },
  // L'arche du scanner.
  ...[-1, 1].map((side): BoxPiece => ({
    size: [0.05, ARCH.y - BELT.top + 0.03, 0.05],
    position: [SCAN_X, BELT.top + (ARCH.y - BELT.top) / 2, BELT.z + side * ARCH.half],
    color: 0x5b6068,
  })),
  {
    size: [0.08, 0.05, ARCH.half * 2 + 0.07],
    position: [SCAN_X, ARCH.y + 0.02, BELT.z],
    color: 0x5b6068,
  },
  // Le panneau de la plaque, au fond à gauche.
  { size: [0.58, 0.26, 0.04], position: [-0.36, BASE_H + 0.13, -0.42], color: 0x4e535b },
  // L'écran des statistiques et son pied.
  {
    size: [0.04, SCREEN.y - BASE_H, 0.04],
    position: [SCREEN.x, BASE_H + (SCREEN.y - BASE_H) / 2, SCREEN.z],
    color: 0x3d3b39,
  },
  {
    size: [SCREEN.w + 0.04, SCREEN.h + 0.04, 0.04],
    position: [SCREEN.x, SCREEN.y + SCREEN.h / 2 - 0.02, SCREEN.z],
    color: 0x2b2927,
  },
];

/** Couleurs des cartes vidéo, à tour de rôle. */
const CARD_COLORS = [0x8d2a20, 0x4f7a8a, 0xe9dcbd, 0xd9a74a] as const;

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
  const cards = useRef<(Group | null)[]>([]);
  const marks = useRef<(Mesh | null)[]>([]);
  const bars = useRef<(Mesh | null)[]>([]);
  const shoulder = useRef<Group>(null);
  const elbow = useRef<Group>(null);
  const hand = useRef<Group>(null);
  const positions = useRef<number[]>(Array.from({ length: CARDS }, (_, i) => i / CARDS));

  const plaque = usePaintedMaterial(
    useMemo(() => paintPlaque(content), [content]),
    { ...PLAQUE_TEXTURE, redrawKey: locale, roughness: 0.35, metalness: 0.45 },
  );
  const plaqueGeometry = useMemo(() => new PlaneGeometry(0.5, 0.16), []);
  const screenGeometry = useMemo(() => new PlaneGeometry(SCREEN.w, SCREEN.h), []);
  const screenMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x14201a }), []);
  const scanMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x1c2a22 }), []);
  const barMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x5fd18a }), []);
  useEffect(
    () => () => {
      plaqueGeometry.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      scanMaterial.dispose();
      barMaterial.dispose();
    },
    [plaqueGeometry, screenGeometry, screenMaterial, scanMaterial, barMaterial],
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

    // Les cartes avancent de la création vers le tube, puis repartent.
    const u = positions.current;
    for (let i = 0; i < CARDS; i++) {
      u[i] = on && !reduced ? cardAt(run, i, current) : i / CARDS + 0.06;
      const card = cards.current[i];
      if (card) {
        card.position.x = runX(u[i] ?? 0);
        // Elles sortent de la machine et rentrent dans le tube en rapetissant.
        const edge = Math.min(1, (u[i] ?? 0) * 10, (1 - (u[i] ?? 0)) * 10);
        card.scale.setScalar(Math.max(0.001, edge));
      }
      const mark = marks.current[i];
      if (mark) mark.visible = isStamped(u[i] ?? 0);
    }

    // Le scanner s'allume en vert quand une carte passe dessous.
    const scan = on * (reduced ? 0.4 : stationLevel(u, STATIONS.scan));
    scanMaterial.color.setRGB(0.11 + scan * 0.26, 0.16 + scan * 0.66, 0.13 + scan * 0.41);

    // Le bras descend le tampon sur la carte qui arrive sous lui.
    const press = on && !reduced ? stationLevel(u, STATIONS.stamp) : 0;
    const stampY = STAMP.up - (STAMP.up - STAMP.down) * press;
    const angles = armAngles(BELT.z - ARM.z, stampY - ARM.shoulder, ARM.upper, ARM.lower);
    if (shoulder.current) shoulder.current.rotation.x = -angles.shoulder;
    if (elbow.current) elbow.current.rotation.x = angles.shoulder - angles.elbow;
    if (hand.current) hand.current.rotation.x = angles.elbow;

    // L'écran : éteint avant la mise en marche, puis les barres battent avec l'activité.
    screenMaterial.color.setRGB(0.05 + on * 0.04, 0.08 + on * 0.1, 0.07 + on * 0.06);
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      const height = on * (BARS[i] ?? 0.5) * (0.85 + beat * 0.15);
      // Les barres poussent depuis le bas de l'écran.
      bar.scale.y = Math.max(0.001, height);
      bar.position.y = (BAR_FULL * height) / 2;
    });

    const p = held.current?.p ?? 0;
    if (glowLight.current) {
      glowLight.current.intensity = legacyPointIntensity(
        on * (0.1 + beat * 0.4) * (1 - p * 0.6),
        GLOW_DISTANCE,
      );
    }
  }, ITEMS_PRIORITY);

  const barWidth = (SCREEN.w - 0.08) / BARS.length;
  return (
    <group ref={ref} {...handlers}>
      <group position={[0, 0, OFFSET_Z]}>
        <MergedBoxes pieces={STATIC_PIECES} />
        {/* Les rouleaux aux deux bouts du tapis. */}
        {[BELT.x0, BELT.x1].map((x) => (
          <Cyl
            key={x}
            radiusTop={0.035}
            radiusBottom={0.035}
            height={BELT.w + 0.06}
            segments={8}
            position={[x, BELT.top - 0.03, BELT.z]}
            rotation={[Math.PI / 2, 0, 0]}
            material={standardMaterial(0x8a8f96, { roughness: 0.4, metalness: 0.6 })}
          />
        ))}
        {/* La bande lumineuse du scanner, sous l'arche. */}
        <Box
          size={[0.05, 0.014, ARCH.half * 2 - 0.05]}
          position={[SCAN_X, ARCH.y - 0.012, BELT.z]}
          material={scanMaterial}
        />
        {/* Les cartes vidéo, chacune avec son triangle de lecture et son tampon. */}
        {CARD_COLORS.slice(0, CARDS).map((color, i) => (
          <group
            key={i}
            ref={(node) => {
              cards.current[i] = node;
            }}
            position={[RUN.x0, CARD_Y, BELT.z]}
          >
            <Box
              size={[CARD.w, CARD.h, CARD.d]}
              material={standardMaterial(color, { roughness: 0.55 })}
            />
            <Cyl
              radiusTop={0.035}
              radiusBottom={0.035}
              height={0.004}
              segments={3}
              position={[0, CARD.h / 2 + 0.002, 0.01]}
              rotation={[0, Math.PI / 2, 0]}
              material={standardMaterial(0xf4efe4, { roughness: 0.6 })}
            />
            <Box
              ref={(node: Mesh | null) => {
                marks.current[i] = node;
              }}
              size={[0.045, 0.006, 0.045]}
              position={[0.035, CARD.h / 2 + 0.003, -0.05]}
              material={barMaterial}
            />
          </group>
        ))}
        {/* Le bras robot : socle, tourelle, deux segments et le tampon. */}
        <group position={[STAMP_X, 0, ARM.z]}>
          <Cyl
            radiusTop={0.1}
            radiusBottom={0.12}
            height={0.06}
            segments={10}
            position={[0, BASE_H + 0.03, 0]}
            material={standardMaterial(0x2b2927, { roughness: 0.5, metalness: 0.3 })}
          />
          <Cyl
            radiusTop={0.055}
            radiusBottom={0.07}
            height={ARM.shoulder - BASE_H - 0.06}
            segments={8}
            position={[0, (ARM.shoulder + BASE_H + 0.06) / 2, 0]}
            material={standardMaterial(0xe08a2e, { roughness: 0.5 })}
          />
          <group ref={shoulder} position={[0, ARM.shoulder, 0]}>
            <Box
              size={[0.07, 0.07, ARM.upper]}
              position={[0, 0, ARM.upper / 2]}
              material={standardMaterial(0xe08a2e, { roughness: 0.5 })}
            />
            <group ref={elbow} position={[0, 0, ARM.upper]}>
              <Cyl
                radiusTop={0.045}
                radiusBottom={0.045}
                height={0.09}
                segments={8}
                rotation={[0, 0, Math.PI / 2]}
                material={standardMaterial(0x2b2927, { roughness: 0.5, metalness: 0.3 })}
              />
              <Box
                size={[0.055, 0.055, ARM.lower]}
                position={[0, 0, ARM.lower / 2]}
                material={standardMaterial(0xe08a2e, { roughness: 0.5 })}
              />
              <group ref={hand} position={[0, 0, ARM.lower]}>
                <Box
                  size={[STAMP.size, 0.05, STAMP.size]}
                  material={standardMaterial(0x2b2927, { roughness: 0.6 })}
                />
                <Box
                  size={[STAMP.size - 0.02, 0.012, STAMP.size - 0.02]}
                  position={[0, -0.03, 0]}
                  material={barMaterial}
                />
              </group>
            </group>
          </group>
        </group>
        {/* Le tube d'envoi, cerclé en haut. */}
        <Cyl
          radiusTop={TUBE.r}
          radiusBottom={TUBE.r}
          height={TUBE.h}
          segments={10}
          position={[TUBE.x, BASE_H + TUBE.h / 2, BELT.z]}
          material={standardMaterial(0xb9c2c9, { roughness: 0.35, metalness: 0.5 })}
        />
        <Cyl
          radiusTop={TUBE.r + 0.02}
          radiusBottom={TUBE.r + 0.02}
          height={0.05}
          segments={10}
          position={[TUBE.x, BASE_H + TUBE.h - 0.02, BELT.z]}
          material={standardMaterial(0xe9dcbd, { roughness: 0.6 })}
        />
        <Box
          size={[0.04, 0.09, CARD.d + 0.05]}
          position={[TUBE.x - TUBE.r + 0.01, CARD_Y + 0.03, BELT.z]}
          material={standardMaterial(0x1d1b19, { roughness: 0.9 })}
        />
        {/* L'écran des statistiques et ses barres. */}
        <mesh
          geometry={screenGeometry}
          material={screenMaterial}
          position={[SCREEN.x, SCREEN.y + SCREEN.h / 2 - 0.02, SCREEN.z + 0.021]}
        />
        {BARS.map((_, i) => (
          <group
            key={i}
            position={[
              SCREEN.x - SCREEN.w / 2 + 0.04 + barWidth * (i + 0.5),
              SCREEN.y + 0.01,
              SCREEN.z + 0.024,
            ]}
          >
            <mesh
              ref={(node) => {
                bars.current[i] = node;
              }}
              material={barMaterial}
            >
              <planeGeometry args={[barWidth * 0.7, BAR_FULL]} />
            </mesh>
          </group>
        ))}
        <mesh
          geometry={plaqueGeometry}
          material={plaque}
          position={[-0.36, BASE_H + 0.13, -0.42 + 0.021]}
        />
        <pointLight
          ref={glowLight}
          color={0x9fe8b8}
          intensity={0}
          distance={GLOW_DISTANCE}
          decay={POINT_DECAY}
          position={[SCREEN.x, 0.5, SCREEN.z + 0.4]}
        />
      </group>
      <TagAnchor id="chest" />
    </group>
  );
}
