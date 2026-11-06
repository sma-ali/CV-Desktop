'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
} from 'three';
import { DESK, DESK_PORTRAIT_Z1, DESK_THICKNESS, FLOOR_Y, WALL_Z, WIN } from '../core/constants';
import { applyRgb } from '../core/materials';
import { usePortrait } from '../core/portrait';
import { useSceneStoreApi } from '../core/store-context';
import { useCanvasTexture } from '../core/textures';
import { WINDOW_BACKSTOP } from './layout';
import type { Part } from './merge';
import { paintWall, paintWood } from './paint';
import { box, MergedParts } from './shared';

// La pièce : le plateau en noyer, le sol, le mur du fond percé de la fenêtre
// (embrasure, dormant, croisillons, appui). Le ciel derrière la vitre
// appartient à la mise en scène (WINDOW_SKY, core/constants.ts) : le décor
// met un fond sombre derrière.

const DESK_WIDTH = DESK.x1 - DESK.x0;
const DESK_DEPTH = DESK.z1 - DESK.z0;

/**
 * Le plateau : un seul pavé, une seule texture. Le dessus montre le bois
 * entier ; les chants lisent une fine bande d'une lame (fil du bois) et sont
 * assombris par la couleur des sommets.
 */
function deskGeometry(): BufferGeometry {
  const geometry = new BoxGeometry(DESK_WIDTH, DESK_THICKNESS, DESK_DEPTH).toNonIndexed();
  // Faces de BoxGeometry, 6 sommets chacune : +x, -x, +y, -y, +z, -z.
  const tints = [0.72, 0.72, 1, 0.42, 0.9, 0.6];
  const uv = geometry.getAttribute('uv');
  const count = uv.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const face = Math.floor(i / 6);
    colors.fill(tints[face] ?? 1, i * 3, i * 3 + 3);
    if (face !== 2) {
      // Une bande étroite de la deuxième lame : le fil court le long du chant.
      uv.setY(i, 0.3 + uv.getY(i) * 0.04);
    }
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Le mur du fond, percé de la fenêtre ; UV en mètres / 6 pour répéter l'enduit. */
function wallGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-16, -3.4);
  shape.lineTo(16, -3.4);
  shape.lineTo(16, 14);
  shape.lineTo(-16, 14);
  shape.closePath();
  const hole = new Path();
  hole.moveTo(WIN.x0, WIN.y0);
  hole.lineTo(WIN.x0, WIN.y1);
  hole.lineTo(WIN.x1, WIN.y1);
  hole.lineTo(WIN.x1, WIN.y0);
  hole.closePath();
  shape.holes.push(hole);
  const geometry = new ShapeGeometry(shape);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
  return geometry;
}

const WIN_CX = (WIN.x0 + WIN.x1) / 2;
const WIN_CY = (WIN.y0 + WIN.y1) / 2;
const WIN_W = WIN.x1 - WIN.x0;
const WIN_H = WIN.y1 - WIN.y0;

/** Embrasure, dormant, croisillons, appui et poignée, fusionnés. */
function windowParts(): Part[] {
  const reveal = 0xcbbba3;
  const frame = 0xe8dcc4;
  const revealZ = WALL_Z - 0.2;
  const frameZ = WALL_Z - 0.05;
  return [
    // L'embrasure (l'épaisseur du mur autour de l'ouverture).
    { geometry: box(0.08, WIN_H, 0.5), color: reveal, position: [WIN.x0 - 0.04, WIN_CY, revealZ] },
    { geometry: box(0.08, WIN_H, 0.5), color: reveal, position: [WIN.x1 + 0.04, WIN_CY, revealZ] },
    {
      geometry: box(WIN_W + 0.16, 0.08, 0.5),
      color: reveal,
      position: [WIN_CX, WIN.y1 + 0.04, revealZ],
    },
    // Le dormant et les croisillons.
    {
      geometry: box(0.14, WIN_H, 0.22),
      color: frame,
      finish: 'satin',
      position: [WIN.x0, WIN_CY, frameZ],
    },
    {
      geometry: box(0.14, WIN_H, 0.22),
      color: frame,
      finish: 'satin',
      position: [WIN.x1, WIN_CY, frameZ],
    },
    {
      geometry: box(WIN_W, 0.14, 0.22),
      color: frame,
      finish: 'satin',
      position: [WIN_CX, WIN.y1, frameZ],
    },
    {
      geometry: box(WIN_W, 0.1, 0.18),
      color: frame,
      finish: 'satin',
      position: [WIN_CX, WIN.y0 + 0.07, frameZ - 0.02],
    },
    {
      geometry: box(WIN_W, 0.09, 0.12),
      color: frame,
      finish: 'satin',
      position: [WIN_CX, WIN_CY + 0.2, WALL_Z - 0.1],
    },
    {
      geometry: box(0.08, WIN_H, 0.12),
      color: frame,
      finish: 'satin',
      position: [WIN_CX, WIN_CY, WALL_Z - 0.1],
    },
    // L'appui, qui avance un peu dans la pièce.
    {
      geometry: box(WIN_W + 0.5, 0.1, 0.42),
      color: 0xd8cab0,
      position: [WIN_CX, WIN.y0 - 0.02, WALL_Z + 0.12],
    },
    // La poignée en laiton, sur le montant du milieu.
    {
      geometry: box(0.05, 0.26, 0.05),
      color: 0xc9973f,
      finish: 'brass',
      position: [WIN_CX + 0.1, WIN_CY - 0.25, WALL_Z - 0.01],
    },
    {
      geometry: box(0.08, 0.08, 0.06),
      color: 0xc9973f,
      finish: 'brass',
      position: [WIN_CX + 0.1, WIN_CY - 0.12, WALL_Z - 0.03],
    },
  ];
}

export function Room() {
  const store = useSceneStoreApi();
  const deskZ1 = usePortrait() ? DESK_PORTRAIT_Z1 : DESK.z1;
  const wood = useCanvasTexture({
    width: 2048,
    height: 1024,
    draw: paintWood,
    anisotropy: 16,
    usesFonts: false,
  });
  const plaster = useCanvasTexture({
    width: 512,
    height: 512,
    draw: paintWall,
    repeat: [1, 1],
    usesFonts: false,
  });

  const desk = useMemo(() => deskGeometry(), []);
  const wall = useMemo(() => wallGeometry(), []);
  const floor = useMemo(() => new PlaneGeometry(40, 30), []);
  const backstop = useMemo(() => new PlaneGeometry(...WINDOW_BACKSTOP.size), []);
  useEffect(
    () => () => [desk, wall, floor, backstop].forEach((geometry) => geometry.dispose()),
    [desk, wall, floor, backstop],
  );

  const deskMaterial = useMemo(
    () =>
      new MeshStandardMaterial({ map: wood, vertexColors: true, roughness: 0.62, metalness: 0 }),
    [wood],
  );
  // Le mur prend la teinte de l'ambiance à chaque image : un matériau à lui.
  const wallMaterial = useMemo(
    () => new MeshStandardMaterial({ map: plaster, roughness: 0.95, metalness: 0 }),
    [plaster],
  );
  const floorMaterial = useMemo(
    () => new MeshStandardMaterial({ color: 0x1b130d, roughness: 0.9 }),
    [],
  );
  const backstopMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x0d1118 }), []);
  useEffect(
    () => () =>
      [deskMaterial, wallMaterial, floorMaterial, backstopMaterial].forEach((m) => m.dispose()),
    [deskMaterial, wallMaterial, floorMaterial, backstopMaterial],
  );

  useFrame(() => {
    applyRgb(wallMaterial.color, store.getState().frame.mood.wall);
  });

  return (
    <group name="decor-room">
      {/* En portrait, le plateau s'allonge vers le visiteur (bureau resserré). */}
      <mesh
        geometry={desk}
        material={deskMaterial}
        position={[0, -DESK_THICKNESS / 2, (DESK.z0 + deskZ1) / 2]}
        scale={[1, 1, (deskZ1 - DESK.z0) / DESK_DEPTH]}
        receiveShadow
        castShadow
      />
      {/* Le liseré clair du bord avant. */}
      <MergedParts build={frontLipParts} castShadow={false} position={[0, 0, deskZ1 - DESK.z1]} />
      <mesh
        geometry={floor}
        material={floorMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FLOOR_Y, 0]}
        receiveShadow
      />
      <mesh
        geometry={wall}
        material={wallMaterial}
        position={[0, 0, WALL_Z + 0.05]}
        receiveShadow
      />
      <MergedParts build={windowParts} />
      {/* Fond sombre de secours derrière le ciel de la mise en scène. */}
      <mesh geometry={backstop} material={backstopMaterial} position={WINDOW_BACKSTOP.position} />
    </group>
  );
}

function frontLipParts(): Part[] {
  return [
    {
      geometry: box(DESK_WIDTH + 0.1, 0.06, 0.08),
      color: 0x6e4a2e,
      finish: 'satin',
      position: [0, -0.03, DESK.z1 + 0.03],
    },
  ];
}
