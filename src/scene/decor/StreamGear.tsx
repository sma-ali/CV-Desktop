'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { STAND, legacyIntensity, type Vec3 } from '../core/constants';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import {
  DECK,
  GLOVES,
  MIC,
  MIC_AIM,
  MIC_CENTER,
  MIC_LOCAL,
  micPoint,
  PANEL,
  addScaled,
  cross,
  damped,
  deckButtonLevel,
  deckLayout,
  lerp3,
  micRingColor,
  normalize,
  panelLevel,
  springPoints,
  sway,
} from './layout';
import { withFinish, type Part } from './merge';
import {
  alignY,
  box,
  cyl,
  MergedParts,
  rodPart,
  sph,
  torus,
  tube,
  usePressable,
  usePressTime,
} from './shared';

// Le matériel de stream : le pavé de boutons et ses LED, le micro sur son
// bras articulé, le panneau de lumière et les gants pendus à son pied.

// ------------------------------------------------------------------
// Le pavé de boutons
// ------------------------------------------------------------------

const BUTTONS = deckLayout();
/** Couleur de chaque bouton, en composantes sRGB (multipliées par leur luminosité). */
const BUTTON_RGB = BUTTONS.map(({ color }) => ({
  r: ((color >> 16) & 255) / 255,
  g: ((color >> 8) & 255) / 255,
  b: (color & 255) / 255,
}));

function deckParts(): Part[] {
  return [
    {
      geometry: box(1.38, 0.16, 0.95),
      color: 0x1f1d1b,
      finish: 'metal',
      position: [0, 0.1, 0],
      rotation: [DECK.tilt, 0, 0],
    },
    // Le petit pied qui l'incline.
    { geometry: box(1.2, 0.08, 0.2), color: 0x161412, position: [0, 0.04, -0.36] },
  ];
}

function StreamDeck() {
  const store = useSceneStoreApi();
  const buttons = useRef<InstancedMesh>(null);
  const { at: rippleAt, handlers } = usePressTime();
  const geometry = useMemo(() => new BoxGeometry(0.2, 0.06, 0.2), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: 0xffffff }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const color = useMemo(() => new Color(), []);
  const last = useRef({ t: Number.NaN, ripple: null as number | null });

  useLayoutEffect(() => {
    const mesh = buttons.current;
    if (!mesh) return;
    const dummy = new Object3D();
    BUTTONS.forEach((button, i) => {
      dummy.position.set(button.x, button.y, button.z);
      dummy.rotation.set(DECK.tilt, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    last.current.t = Number.NaN;
  }, []);

  useFrame(() => {
    const mesh = buttons.current;
    const { frame, settings } = store.getState();
    if (!mesh) return;
    // Rien ne change quand l'horloge est figée : on n'envoie rien à la carte.
    if (frame.t === last.current.t && rippleAt.current === last.current.ripple) return;
    last.current.t = frame.t;
    last.current.ripple = rippleAt.current;
    for (let i = 0; i < BUTTONS.length; i++) {
      const level = deckButtonLevel(frame.t, i, rippleAt.current, settings.reducedMotion);
      const rgb = BUTTON_RGB[i];
      if (!rgb) continue;
      const { r, g, b } = rgb;
      // Éteint, un bouton garde un fond sombre (1b1916).
      const base = 0.1;
      mesh.setColorAt(
        i,
        color.setRGB(
          Math.max(base * 1.05, r * level),
          Math.max(base, g * level),
          Math.max(base * 0.85, b * level),
          SRGBColorSpace,
        ),
      );
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group name="decor-deck" position={DECK.position} rotation={[0, DECK.ry, 0]} {...handlers}>
      <MergedParts build={deckParts} />
      <instancedMesh ref={buttons} args={[geometry, material, BUTTONS.length]} />
    </group>
  );
}

// ------------------------------------------------------------------
// Le micro sur son bras
// ------------------------------------------------------------------

const ARM = 0xe2d6bf;
const BRASS = 0xc9973f;
const IRON = 0x1d1b19;
const [J1, J2, J3] = MIC.joints;
/** Le point d'attache de la suspension, sous la rotule. */
const MIC_YOKE: Vec3 = [J3[0] + 0.05, J3[1] - 0.16, J3[2] + 0.06];

/** Deux tiges parallèles (bras à pantographe) entre deux rotules. */
function doubleRod(from: Vec3, to: Vec3, gap: number): Part[] {
  const dir = normalize([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  // Écart perpendiculaire au bras, dans le plan vertical.
  const side = normalize([-dir[2], 0, dir[0]]);
  const up = normalize(cross(side, dir));
  return [-1, 1].map((s) =>
    rodPart(addScaled(from, up, s * gap), addScaled(to, up, s * gap), 0.03, ARM, 'satin', 6),
  );
}

function micArmParts(): Part[] {
  const [cx, , cz] = MIC.clamp;
  const cable: Vec3[] = [
    [cx + 0.12, 0.3, cz + 0.08],
    addScaled(J1, [0.1, -0.1, 0.08], 1),
    addScaled(lerp3(J1, J2, 0.5), [0.08, -0.12, 0], 1),
    addScaled(J2, [0.06, -0.1, 0.06], 1),
    addScaled(lerp3(J2, J3, 0.5), [0, -0.14, 0.04], 1),
    addScaled(J3, [0, -0.12, -0.12], 1),
    addScaled(micPoint(MIC_LOCAL.backY - 0.05), [0, -0.04, 0], 1),
  ];
  return [
    // La pince sur le bord du plateau : semelle, mâchoire qui descend, vis.
    { geometry: box(0.46, 0.14, 0.4), color: IRON, finish: 'metal', position: [cx, 0.07, cz] },
    {
      geometry: box(0.12, 0.62, 0.36),
      color: IRON,
      finish: 'metal',
      position: [cx - 0.24, -0.2, cz],
    },
    {
      geometry: cyl(0.08, 0.08, 0.22, 8),
      color: BRASS,
      finish: 'brass',
      position: [cx, 0.25, cz],
    },
    // La colonne, les bras, les rotules.
    rodPart([cx, 0.3, cz], J1, 0.055, ARM, 'satin'),
    ...doubleRod(J1, J2, 0.065),
    ...doubleRod(J2, J3, 0.055),
    { geometry: sph(0.1), color: BRASS, finish: 'brass', position: J1 },
    { geometry: sph(0.09), color: BRASS, finish: 'brass', position: J2 },
    { geometry: sph(0.08), color: BRASS, finish: 'brass', position: J3 },
    // Les ressorts sous les bras.
    {
      geometry: tube(
        springPoints(
          addScaled(J1, [0.06, -0.12, 0.08], 1),
          addScaled(lerp3(J1, J2, 0.62), [0, -0.12, 0], 1),
          0.035,
          14,
        ),
        0.009,
        180,
        4,
      ),
      color: 0x8f8a82,
      finish: 'metal',
    },
    {
      geometry: tube(
        springPoints(
          addScaled(J2, [0.02, -0.12, 0.04], 1),
          addScaled(lerp3(J2, J3, 0.6), [0, -0.12, 0], 1),
          0.03,
          11,
        ),
        0.008,
        150,
        4,
      ),
      color: 0x8f8a82,
      finish: 'metal',
    },
    // Le câble rouge qui suit le bras, et la tige de la suspension.
    { geometry: tube(cable, 0.018, 70, 5), color: 0x8f2a22, finish: 'satin' },
    rodPart(J3, MIC_YOKE, 0.03, IRON, 'metal'),
    rodPart(MIC_YOKE, micPoint(-0.16), 0.026, IRON, 'metal'),
  ];
}

/**
 * Le micro lui-même, dans son repère : axe +y vers la bouche. Corps sombre,
 * grille claire et cerclée, suspension en laiton : de haut, une gélule
 * nette et contrastée.
 */
function micParts(): Part[] {
  const { body, grille } = MIC;
  const { bodyY, grilleY } = MIC_LOCAL;
  const grilleColor = 0xc4beb3;
  return [
    {
      geometry: cyl(body.radius, body.radius * 0.88, body.length, 10),
      color: 0x2b2724,
      finish: 'metal',
      position: [0, bodyY, 0],
    },
    {
      geometry: cyl(body.radius * 0.8, body.radius * 0.8, 0.07, 10),
      color: 0x161412,
      finish: 'metal',
      position: [0, bodyY - body.length / 2 - 0.03, 0],
    },
    // La grille, son dôme et ses cerclages.
    {
      geometry: cyl(grille.radius, grille.radius, grille.length, 12),
      color: grilleColor,
      finish: 'metal',
      position: [0, grilleY, 0],
    },
    {
      geometry: sph(grille.radius, 1),
      color: grilleColor,
      finish: 'metal',
      position: [0, grilleY + grille.length / 2, 0],
      scale: [1, 0.55, 1],
    },
    ...[-0.5, 0, 0.5].map((k): Part => ({
      geometry: cyl(grille.radius + 0.012, grille.radius + 0.012, 0.035, 12),
      color: 0x3d3935,
      finish: 'metal',
      position: [0, grilleY + k * grille.length * 0.9, 0],
    })),
    // La suspension : un anneau de laiton autour du corps, tenu à la tige.
    {
      geometry: torus(body.radius + 0.1, 0.022, 5, 16),
      color: BRASS,
      finish: 'brass',
      position: [0, -0.02, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      geometry: torus(body.radius + 0.1, 0.022, 5, 16),
      color: BRASS,
      finish: 'brass',
      position: [0, -0.3, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
  ];
}

function Microphone() {
  const store = useSceneStoreApi();
  const head = useRef<Group>(null);
  const open = useRef(false);
  const replays = useSceneStore((state) => state.replays);
  useEffect(() => {
    open.current = false;
  }, [replays]);
  const handlers = usePressable(() => {
    open.current = !open.current;
  });
  const aim = useMemo(() => alignY(MIC_AIM), []);
  const ringGeometry = useMemo(() => new TorusGeometry(MIC.body.radius * 0.82, 0.028, 5, 14), []);
  const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x1b0a08 }), []);
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [ringGeometry, ringMaterial],
  );

  useFrame(() => {
    const { frame, settings } = store.getState();
    const [r, g, b] = micRingColor(frame.t, open.current);
    ringMaterial.color.setRGB(r, g, b, SRGBColorSpace);
    if (head.current)
      head.current.rotation.z = sway(frame.t, 0.6, 0, 0.015, settings.reducedMotion);
  });

  const ringY = MIC_LOCAL.backY + 0.03;
  return (
    <group name="decor-mic" {...handlers}>
      <MergedParts build={micArmParts} />
      <group ref={head} position={MIC_CENTER}>
        <group quaternion={aim}>
          <MergedParts build={micParts} />
          <mesh
            geometry={ringGeometry}
            material={ringMaterial}
            position={[0, ringY, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------
// Le panneau de lumière et les gants, sur leur pied (bord droit)
// ------------------------------------------------------------------

const PANEL_POSITION: Vec3 = [
  STAND[0] + PANEL.offset[0],
  PANEL.offset[1],
  STAND[2] + PANEL.offset[2],
];
const GLOVE_PIVOT: Vec3 = [STAND[0] - 0.16, 3.0, STAND[2]];

function standParts(): Part[] {
  return [
    {
      geometry: cyl(0.05, 0.05, 7.6, 7),
      color: IRON,
      finish: 'metal',
      position: [STAND[0], 0.6, STAND[2]],
    },
    {
      geometry: cyl(0.06, 0.06, 0.18, 6),
      color: BRASS,
      finish: 'brass',
      position: [STAND[0] - 0.08, 3.0, STAND[2]],
      rotation: [0, 0, Math.PI / 2],
    },
  ];
}

function panelBodyParts(): Part[] {
  return [
    { geometry: box(1.7, 1.05, 0.1), color: 0x1f1d1b, finish: 'satin' },
    // La rotule qui le tient au pied.
    { geometry: sph(0.07), color: BRASS, finish: 'brass', position: [0, 0, -0.08] },
  ];
}

function gloveParts(glove: (typeof GLOVES)[number]): () => Part[] {
  return () => {
    const tip: Vec3 = [glove.ox, -glove.lace, glove.oz];
    const at = (x: number, y: number, z: number): Vec3 => [tip[0] + x, tip[1] + y, tip[2] + z];
    return [
      rodPart([0, 0, 0], tip, 0.014, 0xe8dcc4, 'matte', 5),
      {
        geometry: cyl(0.24, 0.25, 0.42, 8),
        color: glove.color,
        finish: 'satin',
        position: at(0, -0.22, 0),
      },
      { geometry: cyl(0.255, 0.255, 0.08, 8), color: 0xf3e9d4, position: at(0, -0.34, 0) },
      {
        geometry: sph(0.36, 1),
        color: glove.color,
        finish: 'satin',
        position: at(0, -0.72, 0.04),
        scale: [1, 1.15, 0.92],
      },
      {
        geometry: sph(0.13),
        color: glove.color,
        finish: 'satin',
        position: at(-0.27, -0.6, 0.18),
        scale: [1, 1.6, 1],
      },
    ];
  };
}

// Un gant, son lacet compris, en un seul fini : un appel de dessin par gant.
const GLOVE_BUILDS = GLOVES.map((glove) => ({
  glove,
  build: () => withFinish(gloveParts(glove)(), 'satin'),
}));

function LightStand() {
  const store = useSceneStoreApi();
  const { at: hitAt, handlers } = usePressTime();
  const pivots = useRef<(Group | null)[]>([]);
  const light = useRef<PointLight>(null);

  const panelQuaternion = useMemo(() => {
    // Object3D.lookAt pour un objet : son +z vers la cible.
    const m = new Matrix4().lookAt(
      new Vector3(...PANEL.lookAt),
      new Vector3(...PANEL_POSITION),
      new Vector3(0, 1, 0),
    );
    return new Quaternion().setFromRotationMatrix(m);
  }, []);
  const faceGeometry = useMemo(() => new PlaneGeometry(1.55, 0.9), []);
  const faceMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x151310 }), []);
  useEffect(
    () => () => {
      faceGeometry.dispose();
      faceMaterial.dispose();
    },
    [faceGeometry, faceMaterial],
  );

  useFrame(() => {
    const { frame, settings } = store.getState();
    const { t } = frame;
    const reduced = settings.reducedMotion;
    const k = panelLevel(t);
    faceMaterial.color.setRGB(0.08 + k * 1.25, 0.07 + k * 1.15, 0.06 + k * 1.0, SRGBColorSpace);
    if (light.current) light.current.intensity = legacyIntensity(k * 0.32);
    GLOVES.forEach((glove, i) => {
      const pivot = pivots.current[i];
      if (!pivot) return;
      pivot.rotation.set(
        damped(t, hitAt.current, 0.5 * glove.kick, reduced) +
          sway(t, 0.7, glove.phase, 0.02, reduced),
        0,
        damped(t - 0.12, hitAt.current, 0.32, reduced) + sway(t, 0.5, glove.phase, 0.03, reduced),
      );
    });
  });

  return (
    <group name="decor-stand" {...handlers}>
      <MergedParts build={standParts} />
      <group position={PANEL_POSITION} quaternion={panelQuaternion}>
        <MergedParts build={panelBodyParts} />
        <mesh geometry={faceGeometry} material={faceMaterial} position={[0, 0, 0.055]} />
      </group>
      <pointLight
        ref={light}
        args={[0xfff1dc, 0, 12, 0]}
        position={[PANEL_POSITION[0] - 0.6, PANEL_POSITION[1] - 0.3, PANEL_POSITION[2] + 0.5]}
      />
      {GLOVE_BUILDS.map(({ glove, build }, i) => (
        <group
          key={glove.color}
          ref={(node) => {
            pivots.current[i] = node;
          }}
          position={GLOVE_PIVOT}
        >
          <MergedParts build={build} />
        </group>
      ))}
    </group>
  );
}

export function StreamGear() {
  return (
    <>
      <StreamDeck />
      <Microphone />
      <LightStand />
    </>
  );
}
