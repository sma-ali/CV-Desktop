'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Sprite,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARRIVAL } from '../core/constants';
import { DeskBody } from '../gestures/DeskBody';
import { useSceneStoreApi } from '../core/store-context';
import { useCanvasTexture } from '../core/textures';
import {
  FIGURES,
  MANGA,
  MANGA_SIZE,
  PLANT,
  ROPE,
  STEAM_COUNT,
  hop,
  leafLayout,
  mangaStack,
  ropeCoil,
  rumble,
  shake,
  steamPuff,
  sway,
  type FigureKind,
  type FigureSpec,
  type SteamPuff,
} from './layout';
import { withFinish, type Part } from './merge';
import {
  paintSoftDot,
  paintSpineAtlas,
  SPINE_ATLAS,
  SPINE_ROW_PAGES,
  SPINE_ROW_PLAIN,
  spineRowV,
} from './paint';
import { box, cyl, MergedParts, rodPart, sph, torus, tube, usePressTime } from './shared';

// Les petites choses de la vie : corde à sauter, bandes de boxe, plante,
// pile de mangas et figurines (inventés : ni titre, ni marque, ni
// personnage réel), tasse fumante, manette. Tasse et manette glissent sur
// le plateau (étape 4, DeskBody de la partie « gestes ») ; un clic les fait
// réagir.

// ------------------------------------------------------------------
// Corde à sauter et bandes de boxe
// ------------------------------------------------------------------

const WOOD = 0x6e4a2e;

function sportParts(): Part[] {
  const [rx, , rz] = ROPE.center;
  return [
    { geometry: tube(ropeCoil(), 0.03, 170, 5), color: 0xd9a441, finish: 'satin' },
    {
      geometry: cyl(0.06, 0.07, 0.5, 7),
      color: WOOD,
      finish: 'satin',
      position: [rx + 0.55, 0.07, rz + 0.5],
      rotation: [Math.PI / 2, 0, 0.8],
    },
    {
      geometry: cyl(0.06, 0.07, 0.5, 7),
      color: WOOD,
      finish: 'satin',
      position: [rx - 0.5, 0.07, rz - 0.6],
      rotation: [Math.PI / 2, 0, -0.5],
    },
    // Les bandes roulées, et le bout d'une qui dépasse.
    {
      geometry: cyl(0.17, 0.17, 0.24, 10),
      color: 0x2b2b2e,
      position: [5.55, 0.17, 0.55],
      rotation: [0, 0.4, Math.PI / 2],
    },
    {
      geometry: cyl(0.16, 0.16, 0.24, 10),
      color: 0x8f2a22,
      position: [5.9, 0.16, 0.95],
      rotation: [0, -0.3, Math.PI / 2],
    },
    {
      geometry: box(0.5, 0.02, 0.12),
      color: 0x2b2b2e,
      position: [5.1, 0.02, 0.75],
      rotation: [0, 0.5, 0],
    },
  ];
}

// ------------------------------------------------------------------
// La plante
// ------------------------------------------------------------------

const LEAVES = leafLayout();
const LEAF_COLORS = [0x5f8650, 0x46703f] as const;

function potParts(): Part[] {
  return [
    { geometry: cyl(0.34, 0.26, 0.5, 9), color: 0xb5623e, position: [0, 0.25, 0] },
    { geometry: cyl(0.36, 0.36, 0.08, 9), color: 0xa6583a, position: [0, 0.5, 0] },
    { geometry: cyl(0.31, 0.31, 0.02, 9), color: 0x3a2618, position: [0, 0.52, 0] },
  ];
}

function leafGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.16, 0.25, 0, 0.7);
  shape.quadraticCurveTo(-0.16, 0.25, 0, 0);
  return new ShapeGeometry(shape, 3);
}

function Plant() {
  const store = useSceneStoreApi();
  const leaves = useRef<InstancedMesh>(null);
  const { at: shakeAt, handlers } = usePressTime();
  const geometry = useMemo(() => leafGeometry(), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        flatShading: true,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const dummy = useMemo(() => new Object3D(), []);
  const last = useRef(Number.NaN);

  useLayoutEffect(() => {
    const mesh = leaves.current;
    if (!mesh) return;
    const color = new Color();
    LEAVES.forEach((leaf, i) => mesh.setColorAt(i, color.setHex(LEAF_COLORS[leaf.shade])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    last.current = Number.NaN;
  }, []);

  useFrame(() => {
    const mesh = leaves.current;
    if (!mesh) return;
    const { frame, settings } = store.getState();
    const { t } = frame;
    const reduced = settings.reducedMotion;
    const shook = shake(t, shakeAt.current, reduced);
    // Rien ne bouge (horloge figée, mouvement réduit au repos) : rien à envoyer.
    const key = reduced && shook === 0 ? 0 : t + shook;
    if (key === last.current) return;
    last.current = key;
    LEAVES.forEach((leaf, i) => {
      dummy.position.set(0, 0.52, 0);
      dummy.rotation.set(0, leaf.ry, 0);
      dummy.rotateX(leaf.rx + sway(t, 0.8, leaf.phase, 0.03, reduced) + shook);
      dummy.scale.setScalar(leaf.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="decor-plant" position={PLANT.position} {...handlers}>
      <MergedParts build={potParts} />
      <instancedMesh ref={leaves} args={[geometry, material, LEAVES.length]} castShadow />
    </group>
  );
}

// ------------------------------------------------------------------
// La pile de mangas (un seul maillage, dos peints dans un atlas)
// ------------------------------------------------------------------

function mangaGeometry(): BufferGeometry {
  const { w, h, d } = MANGA_SIZE;
  const [plainLow, plainHigh] = spineRowV(SPINE_ROW_PLAIN);
  const plainV = (plainLow + plainHigh) / 2;
  const [pagesLow, pagesHigh] = spineRowV(SPINE_ROW_PAGES);
  const white = new Color(0xffffff);
  const books = mangaStack().map((book, i) => {
    const geometry = new BoxGeometry(w, h, d).toNonIndexed();
    const uv = geometry.getAttribute('uv');
    const colors = new Float32Array(uv.count * 3);
    const cover = new Color(book.cover);
    const [spineLow, spineHigh] = spineRowV(i);
    for (let j = 0; j < uv.count; j++) {
      // Faces : +x, -x, +y, -y, +z (le dos, vers le visiteur), -z.
      const face = Math.floor(j / 6);
      let color = white;
      if (face === 4) uv.setY(j, spineLow + uv.getY(j) * (spineHigh - spineLow));
      else if (face === 2 || face === 3) {
        uv.setXY(j, 0.5, plainV);
        color = cover;
      } else uv.setY(j, pagesLow + uv.getY(j) * (pagesHigh - pagesLow));
      colors[j * 3] = color.r;
      colors[j * 3 + 1] = color.g;
      colors[j * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.rotateY(book.ry);
    geometry.translate(book.x, book.y, 0);
    return geometry;
  });
  const merged = mergeGeometries(books);
  books.forEach((geometry) => geometry.dispose());
  return merged;
}

function MangaStack() {
  const atlas = useCanvasTexture({
    width: SPINE_ATLAS.width,
    height: SPINE_ATLAS.rowHeight * SPINE_ATLAS.rows,
    draw: paintSpineAtlas,
  });
  const geometry = useMemo(() => mangaGeometry(), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.7 }),
    [atlas],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return (
    <mesh
      name="decor-manga"
      geometry={geometry}
      material={material}
      position={MANGA.position}
      rotation={[0, MANGA.ry, 0]}
      castShadow
      receiveShadow
    />
  );
}

// ------------------------------------------------------------------
// Les figurines
// ------------------------------------------------------------------

/** Le socle noir commun aux figurines. */
const figureBase = (): Part => ({
  geometry: cyl(0.2, 0.22, 0.06, 10),
  color: 0x1f1d1b,
  finish: 'satin',
  position: [0, 0.03, 0],
});

const FIGURE_PARTS: Record<FigureKind, () => Part[]> = {
  // Un petit robot : tête carrée, yeux turquoise, antenne.
  robot: () => [
    figureBase(),
    {
      geometry: cyl(0.13, 0.16, 0.32, 8),
      color: 0xe3b54a,
      finish: 'satin',
      position: [0, 0.22, 0],
    },
    { geometry: box(0.3, 0.24, 0.26), color: 0xf3e9d4, finish: 'satin', position: [0, 0.5, 0] },
    { geometry: sph(0.03, 1), color: 0x7fe0d2, finish: 'unlit', position: [-0.07, 0.52, 0.135] },
    { geometry: sph(0.03, 1), color: 0x7fe0d2, finish: 'unlit', position: [0.07, 0.52, 0.135] },
    rodPart([0, 0.62, 0], [0.05, 0.8, 0], 0.012, 0x1d1b19),
    { geometry: sph(0.035), color: 0xe3735a, position: [0.05, 0.82, 0] },
  ],
  // Un renard stylisé : corps en cône, oreilles pointues, queue.
  fox: () => [
    figureBase(),
    { geometry: cyl(0.02, 0.17, 0.36, 7), color: 0xf3e9d4, position: [0, 0.24, 0] },
    { geometry: sph(0.15), color: 0xe0703a, position: [0, 0.5, 0] },
    {
      geometry: cyl(0, 0.06, 0.16, 4),
      color: 0xe0703a,
      position: [-0.08, 0.66, 0],
      rotation: [0, 0, 0.3],
    },
    {
      geometry: cyl(0, 0.06, 0.16, 4),
      color: 0xe0703a,
      position: [0.08, 0.66, 0],
      rotation: [0, 0, -0.3],
    },
    {
      geometry: cyl(0, 0.09, 0.3, 5),
      color: 0xe0703a,
      position: [0, 0.2, -0.18],
      rotation: [-1.1, 0, 0],
    },
  ],
  // Un voyageur en cape, au grand chapeau.
  wanderer: () => [
    figureBase(),
    { geometry: cyl(0.04, 0.2, 0.44, 7), color: 0x2d5a5c, position: [0, 0.28, 0] },
    { geometry: sph(0.11), color: 0xd7d0c0, position: [0, 0.56, 0] },
    { geometry: cyl(0.02, 0.3, 0.18, 8), color: WOOD, position: [0, 0.7, 0] },
    { geometry: cyl(0.3, 0.3, 0.02, 8), color: WOOD, position: [0, 0.62, 0] },
  ],
};

/** Chaque figurine en un seul fini satiné (ses yeux mis à part) : un ou deux appels de dessin. */
const FIGURE_BUILDS: Record<FigureKind, () => Part[]> = {
  robot: () => withFinish(FIGURE_PARTS.robot(), 'satin'),
  fox: () => withFinish(FIGURE_PARTS.fox(), 'satin'),
  wanderer: () => withFinish(FIGURE_PARTS.wanderer(), 'satin'),
};

function Figure({ spec }: { spec: FigureSpec }) {
  const store = useSceneStoreApi();
  const group = useRef<Group>(null);
  const { at: hopAt, handlers } = usePressTime();
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const { frame, settings } = store.getState();
    const { y, spin } = hop(frame.t, hopAt.current, settings.reducedMotion);
    node.position.y = spec.position[1] + y;
    node.rotation.y = spec.ry + spin;
  });
  return (
    <group
      ref={group}
      name={`decor-figure-${spec.kind}`}
      position={spec.position}
      rotation={[0, spec.ry, 0]}
      {...handlers}
    >
      <MergedParts build={FIGURE_BUILDS[spec.kind]} />
    </group>
  );
}

// ------------------------------------------------------------------
// La tasse et sa vapeur
// ------------------------------------------------------------------

function mugParts(): Part[] {
  return [
    {
      geometry: cyl(0.3, 0.28, 0.52, 12),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0, 0.26, 0],
    },
    {
      geometry: cyl(0.305, 0.305, 0.08, 12),
      color: 0x8f2a22,
      finish: 'gloss',
      position: [0, 0.36, 0],
    },
    // Le café affleure, cerné par la lèvre de la tasse.
    {
      geometry: cyl(0.265, 0.265, 0.02, 12),
      color: 0x2a170c,
      finish: 'gloss',
      position: [0, 0.525, 0],
    },
    {
      geometry: torus(0.285, 0.022, 4, 16),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0, 0.53, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      geometry: torus(0.13, 0.04, 6, 10, Math.PI * 1.2),
      color: 0xf0e6d2,
      finish: 'gloss',
      position: [0.3, 0.27, 0],
      rotation: [0, 0, -Math.PI * 0.6],
    },
  ];
}

const STEAM_INDICES = Array.from({ length: STEAM_COUNT }, (_, i) => i);

function Mug() {
  const store = useSceneStoreApi();
  const { at: puffAt, handlers } = usePressTime();
  const dot = useCanvasTexture({ width: 64, height: 64, draw: paintSoftDot, usesFonts: false });
  const sprites = useRef<(Sprite | null)[]>([]);
  const puffRef = useRef<SteamPuff>({ x: 0, y: 0, z: 0, scale: 0, opacity: 0 });

  useFrame(() => {
    const { frame, settings } = store.getState();
    const light = frame.lamp + frame.window;
    const puff = puffRef.current;
    for (let i = 0; i < STEAM_COUNT; i++) {
      const sprite = sprites.current[i];
      if (!sprite) continue;
      steamPuff(frame.t, i, light, puffAt.current, settings.reducedMotion, puff);
      sprite.position.set(puff.x, puff.y, puff.z);
      sprite.scale.setScalar(puff.scale);
      sprite.material.opacity = puff.opacity;
      sprite.visible = puff.opacity > 0.002;
    }
  });

  return (
    <group name="decor-mug" {...handlers}>
      <MergedParts build={mugParts} />
      {STEAM_INDICES.map((i) => (
        <sprite
          key={i}
          ref={(node) => {
            sprites.current[i] = node;
          }}
          renderOrder={2}
          visible={false}
        >
          <spriteMaterial map={dot} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------
// La manette (générique, inventée)
// ------------------------------------------------------------------

function padParts(): Part[] {
  const shell = 0xd9cfbd;
  const dark = 0x2b2927;
  return [
    { geometry: box(1.05, 0.16, 0.5), color: shell, finish: 'satin', position: [0, 0.12, -0.02] },
    ...[-1, 1].map((s): Part => ({
      geometry: cyl(0.2, 0.17, 0.55, 8),
      color: shell,
      finish: 'satin',
      position: [s * 0.46, 0.12, 0.16],
      rotation: [Math.PI / 2 - 0.2, 0, s * 0.35],
      scale: [1, 1, 0.8],
    })),
    { geometry: cyl(0.08, 0.09, 0.08, 8), color: dark, position: [-0.2, 0.24, 0.1] },
    { geometry: cyl(0.08, 0.09, 0.08, 8), color: dark, position: [0.2, 0.24, 0.1] },
    { geometry: box(0.2, 0.04, 0.06), color: dark, position: [-0.42, 0.21, -0.06] },
    { geometry: box(0.06, 0.04, 0.2), color: dark, position: [-0.42, 0.21, -0.06] },
    // Quatre boutons en deux teintes du bureau : aucun code de couleurs connu.
    ...(
      [
        [0, -0.08],
        [0.08, 0],
        [-0.08, 0],
        [0, 0.08],
      ] as const
    ).map(([x, z], i): Part => ({
      geometry: cyl(0.035, 0.035, 0.05, 6),
      color: i % 2 ? 0x86a07d : 0xc0574a,
      finish: 'gloss',
      position: [0.42 + x, 0.22, -0.06 + z],
    })),
  ];
}

const padBuild = () => withFinish(padParts(), 'satin');

function Gamepad() {
  const store = useSceneStoreApi();
  const group = useRef<Group>(null);
  const { at: rumbleAt, handlers } = usePressTime();
  const led = useMemo(() => new MeshBasicMaterial({ color: 0x1b1916 }), []);
  useEffect(() => () => led.dispose(), [led]);

  useFrame(() => {
    const { frame, settings } = store.getState();
    const { t } = frame;
    const on = t >= ARRIVAL.padLed;
    led.color.setRGB(on ? 0.3 : 0.05, on ? 0.6 : 0.03, on ? 1.2 : 0.03, SRGBColorSpace);
    const node = group.current;
    if (!node) return;
    const v = rumble(t, rumbleAt.current, settings.reducedMotion);
    node.position.set(Math.sin(t * 90) * v, 0, Math.cos(t * 77) * v);
    node.rotation.y = Math.sin(t * 60) * v * 1.5;
  });

  return (
    <group name="decor-pad" {...handlers}>
      <group ref={group}>
        <MergedParts build={padBuild} />
        <mesh material={led} position={[0, 0.205, -0.17]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 8]} />
        </mesh>
      </group>
    </group>
  );
}

export function Props() {
  return (
    <>
      <MergedParts build={sportParts} />
      <Plant />
      <MangaStack />
      {FIGURES.map((spec) => (
        <Figure key={spec.kind} spec={spec} />
      ))}
      <DeskBody id="mug">
        <Mug />
      </DeskBody>
      <DeskBody id="pad">
        <Gamepad />
      </DeskBody>
    </>
  );
}
