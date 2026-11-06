'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARRIVAL, ITEM_POSES } from '../core/constants';
import { standardMaterial } from '../core/materials';
import { clamp } from '../core/math';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { breath } from './beats';
import { MergedParts, type ColoredPart } from './merged';
import {
  NETHERBRAIN_LABEL,
  NETHERBRAIN_LID,
  paintNetherbrainLabel,
  paintNetherbrainLid,
} from './paint';
import { deskRestPose, ITEMS_PRIORITY } from './presentation';
import { TagAnchor } from './TagLayer';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Netherbrain (projet 2026) : un bocal de verre low poly, couvercle de
// laiton, où un cerveau aux circonvolutions simplifiées luit doucement, et
// sa lueur respire. Vu d'en haut, le couvercle porte le nom. Présenté, le
// bocal fait un demi-tour (mode spin) et montre son dos : l'étiquette, avec
// l'accroche, l'année, la pile et les tests (content.scene.netherbrain).
// Encombrement : BODY_FOOTPRINTS.netherbrain (0.42 de demi-côté).

/** Le bocal : rayon du verre en bas et en haut, hauteur, épaisseur du socle. */
const JAR = { bottom: 0.37, top: 0.355, height: 0.78, base: 0.07, segments: 10 } as const;
const LID = { radius: 0.3, height: 0.1 } as const;
/** Haut du verre (épaule comprise) et du couvercle. */
const GLASS_TOP = JAR.base + JAR.height + 0.08;
const LID_TOP = GLASS_TOP + LID.height;

/** Durée (s) de l'allumage du cerveau, qui s'allume avec la lampe. */
const BRAIN_FADE_IN = 1.2;

/** Le cerveau : centre et demi-tailles (x, y, z), pris dans le verre. */
const BRAIN = { y: 0.5, size: [0.25, 0.2, 0.3] as const } as const;

/** L'étiquette enroulée au dos du verre (face -z) : rayon, hauteur, angle couvert. */
const LABEL = { radius: JAR.bottom + 0.006, height: 0.46, y: 0.47, arc: 2.0 } as const;

/** Lueur du cerveau : au repos, au plus fort de la respiration. */
const GLOW = { rest: 0.35, breath: 0.45 } as const;

function solidParts(): ColoredPart[] {
  const base = new CylinderGeometry(JAR.bottom + 0.035, JAR.bottom + 0.045, JAR.base, JAR.segments);
  base.translate(0, JAR.base / 2, 0);
  const lid = new CylinderGeometry(LID.radius, LID.radius + 0.012, LID.height, JAR.segments);
  lid.translate(0, GLASS_TOP + LID.height / 2, 0);
  const lip = new CylinderGeometry(LID.radius + 0.02, LID.radius + 0.02, 0.025, JAR.segments);
  lip.translate(0, GLASS_TOP + 0.012, 0);
  // Le petit socle qui tient le cerveau au milieu du verre.
  const stem = new CylinderGeometry(0.05, 0.11, BRAIN.y - BRAIN.size[1] - JAR.base + 0.04, 7);
  stem.translate(0, JAR.base + (BRAIN.y - BRAIN.size[1] - JAR.base + 0.04) / 2, 0);
  return [
    { geometry: base, color: 0x3a2a1f },
    { geometry: lid, color: 0xb9893a },
    { geometry: lip, color: 0x8a6224 },
    { geometry: stem, color: 0x6f7378 },
  ];
}

/** Le verre : le corps et l'épaule, une seule géométrie. */
function glassGeometry(): BufferGeometry {
  const body = new CylinderGeometry(JAR.top, JAR.bottom, JAR.height, JAR.segments, 1, true);
  body.translate(0, JAR.base + JAR.height / 2, 0);
  const shoulder = new CylinderGeometry(LID.radius - 0.02, JAR.top, 0.08, JAR.segments, 1, true);
  shoulder.translate(0, JAR.base + JAR.height + 0.04, 0);
  const merged = mergeGeometries([body, shoulder]);
  body.dispose();
  shoulder.dispose();
  if (!merged) throw new Error('fusion du verre impossible');
  return merged;
}

/**
 * Le cerveau : un icosaèdre déformé, deux hémisphères séparés par un sillon
 * d'avant en arrière, et des bosses régulières pour les circonvolutions.
 * Chaque sommet se déplace d'après sa seule position : les faces restent
 * jointives (géométrie non indexée).
 */
function brainGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  if (position) {
    const [sx, sy, sz] = BRAIN.size;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const folds =
        1 +
        0.08 * Math.sin(9 * x + 4 * y) * Math.sin(8 * z + 3 * y) +
        0.04 * Math.sin(13 * z - 5 * x);
      // Le sillon entre les deux hémisphères, sur le dessus.
      const groove = 1 - 0.3 * Math.exp(-((x / 0.14) ** 2)) * Math.max(0, y + 0.2);
      // Le dessous s'aplatit un peu.
      const flat = y < -0.4 ? 0.85 : 1;
      position.setXYZ(i, x * folds * groove * sx, y * folds * groove * flat * sy, z * folds * sz);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** L'étiquette : un morceau de cylindre centré sur la face -z. */
function labelGeometry(): CylinderGeometry {
  const geometry = new CylinderGeometry(
    LABEL.radius,
    LABEL.radius,
    LABEL.height,
    16,
    1,
    true,
    Math.PI - LABEL.arc / 2,
    LABEL.arc,
  );
  geometry.translate(0, LABEL.y, 0);
  return geometry;
}

/** Règle la lueur du cerveau et de son halo (hors du composant : un matériau three se modifie en place). */
function setBrainGlow(
  brain: MeshStandardMaterial,
  halo: MeshBasicMaterial,
  level: number,
  on: number,
) {
  brain.emissiveIntensity = on * GLOW.rest + GLOW.breath * level;
  halo.opacity = on * 0.05 + 0.1 * level;
}

export function Netherbrain({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const store = useSceneStoreApi();

  const label = usePaintedMaterial(
    useMemo(() => paintNetherbrainLabel(content), [content]),
    { ...NETHERBRAIN_LABEL, redrawKey: locale },
  );
  const lidTop = usePaintedMaterial(
    useMemo(() => paintNetherbrainLid(content), [content]),
    { ...NETHERBRAIN_LID, redrawKey: locale, roughness: 0.35, metalness: 0.55 },
  );

  const parts = useMemo(() => {
    const disc = new CircleGeometry(LID.radius - 0.015, JAR.segments * 2);
    // À plat, le haut de la texture vers le mur : le nom se lit depuis le visiteur.
    disc.rotateX(-Math.PI / 2);
    return {
      glass: glassGeometry(),
      brain: brainGeometry(),
      halo: new IcosahedronGeometry(0.33, 1),
      label: labelGeometry(),
      disc,
    };
  }, []);
  const materials = useMemo(
    () => ({
      // Verre légèrement teinté : il laisse voir le cerveau, sans écrire la profondeur.
      glass: new MeshStandardMaterial({
        color: 0xa9cfc6,
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        flatShading: true,
      }),
      brain: new MeshStandardMaterial({
        color: 0xe0a0ac,
        emissive: 0xff6f91,
        emissiveIntensity: GLOW.rest,
        roughness: 0.55,
        flatShading: true,
      }),
      halo: new MeshBasicMaterial({
        color: 0xff8fb0,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(parts).forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((material) => material.dispose());
    },
    [parts, materials],
  );

  useFrame(() => {
    const { frame, settings } = store.getState();
    // Le cerveau s'allume avec la lampe, puis respire (pas en mouvement réduit).
    const on = clamp((frame.t - ARRIVAL.lampOn) / BRAIN_FADE_IN, 0, 1);
    const level = settings.reducedMotion ? 0.5 : breath(frame.t);
    setBrainGlow(materials.brain, materials.halo, on * level, on);
  }, ITEMS_PRIORITY);

  const rest = useMemo(() => deskRestPose(ITEM_POSES.netherbrain), []);
  const glow = useMemo(() => [label, lidTop], [label, lidTop]);
  const { ref, handlers } = usePresentation({ id: 'netherbrain', rest, seed: 0.33, glow });

  return (
    <group ref={ref} {...handlers} name={`netherbrain-${locale}`}>
      <MergedParts build={solidParts} roughness={0.45} metalness={0.4} />
      <mesh
        geometry={parts.brain}
        material={materials.brain}
        position={[0, BRAIN.y, 0]}
        castShadow
      />
      <mesh
        geometry={parts.halo}
        material={materials.halo}
        position={[0, BRAIN.y, 0]}
        scale={[1.05, 0.85, 1.2]}
        renderOrder={1}
      />
      <mesh geometry={parts.glass} material={materials.glass} renderOrder={2} />
      <mesh geometry={parts.label} material={label} />
      {/* Le dos du papier, vu à travers le verre. */}
      <mesh geometry={parts.label} material={standardMaterial(0xd9ccb0, { side: BackSide })} />
      <mesh geometry={parts.disc} material={lidTop} position={[0, LID_TOP + 0.002, 0]} />
      <TagAnchor id="netherbrain" />
    </group>
  );
}
