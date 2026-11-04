'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { ARRIVAL, ITEM_POSES } from '../core/constants';
import { flatPlaneGeometry } from '../core/geometry';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import {
  CABLES,
  FACE,
  HOMELAB_SEED,
  homelabLeds,
  JACK,
  LED_RGB,
  ledLevel,
  portPoint,
  RACK,
  UNIT_DEPTH,
  UNITS,
  type PortRef,
} from './homelab';
import { MergedBoxes, MergedParts, type BoxPiece, type ColoredPart } from './merged';
import {
  HOMELAB_BACK,
  HOMELAB_FACE,
  HOMELAB_TOP,
  paintHomelabBack,
  paintHomelabFront,
  paintHomelabTop,
} from './paint';
import { deskRestPose, ITEMS_PRIORITY } from './presentation';
import { TagAnchor } from './TagLayer';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Homelab (projet 2026) : une mini baie de 10 pouces, montants et plaques
// d'acier, un serveur, un pare-feu, un switch et un panneau de brassage,
// quelques câbles courts, et des LED qui clignotent d'après une graine
// (homelab.ts : déterministes, figées sous ?fige, fixes en mouvement
// réduit). Vu d'en haut, le dessus porte le nom. Présentée, la baie fait un
// demi-tour (mode spin) et montre son dos : le nom et trois étiquettes
// (serveur, pare-feu, accès ; content.scene.homelab). Encombrement :
// BODY_FOOTPRINTS.homelab (0.5 x 0.4 en demi-côtés).

const POST_X = RACK.w / 2 - RACK.post / 2;
const POST_Z = RACK.d / 2 - RACK.post / 2;
const FACE_W = FACE.x1 - FACE.x0;
const FACE_H = FACE.y1 - FACE.y0;
const FACE_Y = (FACE.y0 + FACE.y1) / 2;

/** La baie et ses équipements : des boîtes fusionnées, un seul appel de dessin. */
const FRAME: BoxPiece[] = [
  { size: [RACK.w, RACK.plate, RACK.d], position: [0, RACK.plate / 2, 0], color: 0x2a2c30 },
  {
    size: [RACK.w, RACK.top, RACK.d],
    position: [0, RACK.h - RACK.top / 2, 0],
    color: 0x3d4046,
  },
  ...[
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx = 0, sz = 0]): BoxPiece => ({
    size: [RACK.post, RACK.h - RACK.plate - RACK.top, RACK.post],
    position: [sx * POST_X, (RACK.h + RACK.plate - RACK.top) / 2, sz * POST_Z],
    color: 0x1f2124,
  })),
  // Les équipements, la façade à FACE.z (le plan peint la couvre).
  ...UNITS.map((unit): BoxPiece => ({
    size: [FACE_W, unit.y1 - unit.y0, UNIT_DEPTH],
    position: [0, (unit.y0 + unit.y1) / 2, FACE.z - 0.004 - UNIT_DEPTH / 2],
    color: unit.color,
  })),
];

/** Longueur de la fiche RJ45 qui sort de la prise. */
const PLUG_DEPTH = 0.034;

/** Un câble de brassage, d'une fiche à l'autre, qui bombe vers l'avant. */
function patchCable(from: Vector3, to: Vector3, bulge: number): TubeGeometry {
  const mid = from.clone().lerp(to, 0.5);
  mid.z += bulge;
  const curve = new CatmullRomCurve3([
    from,
    new Vector3(from.x, from.y, from.z + bulge * 0.7),
    mid,
    new Vector3(to.x, to.y, to.z + bulge * 0.7),
    to,
  ]);
  return new TubeGeometry(curve, 14, 0.011, 5, false);
}

/** La fiche enfoncée dans une prise : un petit bloc à la taille de la prise. */
function plug(port: PortRef): BoxGeometry {
  const [x, y] = portPoint(port);
  const [width, height] = JACK[port.unit];
  const geometry = new BoxGeometry(width * 0.82, height * 0.78, PLUG_DEPTH);
  geometry.translate(x, y, FACE.z + PLUG_DEPTH / 2);
  return geometry;
}

/** Les câbles de CABLES : chaque bout est une fiche dans sa prise, le câble part de l'arrière de la fiche. */
function cableParts(): ColoredPart[] {
  const z = FACE.z + PLUG_DEPTH;
  const end = (port: PortRef) => {
    const [x, y] = portPoint(port);
    return new Vector3(x, y, z);
  };
  return CABLES.flatMap(({ from, to, color }, i) => {
    const boot = new Color(color).lerp(new Color(0xd8d4cc), 0.25).getHex();
    return [
      { geometry: patchCable(end(from), end(to), 0.05 + i * 0.012), color },
      { geometry: plug(from), color: boot },
      { geometry: plug(to), color: boot },
    ];
  });
}

const LEDS = homelabLeds(HOMELAB_SEED);
const LED_SIZE = 0.024;

const ledColor = new Color();

/** Donne à chaque LED son éclat de l'instant (hors du composant : le maillage se modifie en place). */
function lightLeds(mesh: InstancedMesh, t: number, reduced: boolean, on: number) {
  LEDS.forEach((led, i) => {
    const level = on * ledLevel(led, t, reduced);
    const [r, g, b] = LED_RGB[led.color];
    mesh.setColorAt(i, ledColor.setRGB(r * level, g * level, b * level));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function Homelab({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const store = useSceneStoreApi();

  const front = usePaintedMaterial(
    useMemo(() => paintHomelabFront(content), [content]),
    { ...HOMELAB_FACE, redrawKey: locale, roughness: 0.55, metalness: 0.25 },
  );
  const back = usePaintedMaterial(
    useMemo(() => paintHomelabBack(content), [content]),
    { ...HOMELAB_BACK, redrawKey: locale, roughness: 0.6, metalness: 0.2 },
  );
  const top = usePaintedMaterial(
    useMemo(() => paintHomelabTop(content), [content]),
    { ...HOMELAB_TOP, redrawKey: locale, roughness: 0.5, metalness: 0.3 },
  );

  const geometries = useMemo(
    () => ({
      face: new PlaneGeometry(FACE_W, FACE_H),
      top: flatPlaneGeometry(RACK.w - 0.02, RACK.d - 0.02),
    }),
    [],
  );

  // Les LED : un seul maillage instancié, une couleur par LED, à chaque image.
  const leds = useMemo(() => {
    const mesh = new InstancedMesh(
      new BoxGeometry(LED_SIZE, LED_SIZE, 0.012),
      new MeshBasicMaterial({ toneMapped: false }),
      LEDS.length,
    );
    const placer = new Object3D();
    const black = new Color(0x000000);
    LEDS.forEach((led, i) => {
      placer.position.set(led.x, led.y, FACE.z + 0.006);
      placer.updateMatrix();
      mesh.setMatrixAt(i, placer.matrix);
      mesh.setColorAt(i, black);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, []);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      leds.geometry.dispose();
      (leds.material as MeshBasicMaterial).dispose();
      leds.dispose();
    },
    [geometries, leds],
  );

  useFrame(() => {
    const { frame, settings } = store.getState();
    // Les LED s'allument avec les boutons du pavé, puis clignotent.
    const on = frame.t >= ARRIVAL.deckLedsStart ? 1 : 0;
    lightLeds(leds, frame.t, settings.reducedMotion, on);
  }, ITEMS_PRIORITY);

  const rest = useMemo(() => deskRestPose(ITEM_POSES.homelab), []);
  const glow = useMemo(() => [front, back, top], [front, back, top]);
  const { ref, handlers } = usePresentation({ id: 'homelab', rest, seed: 1.12, glow });

  return (
    <group ref={ref} {...handlers} name={`homelab-${locale}`}>
      <MergedBoxes pieces={FRAME} roughness={0.5} metalness={0.4} />
      <MergedParts build={cableParts} roughness={0.7} />
      <mesh geometry={geometries.face} material={front} position={[0, FACE_Y, FACE.z]} />
      <mesh
        geometry={geometries.face}
        material={back}
        position={[0, FACE_Y, -FACE.z]}
        rotation={[0, Math.PI, 0]}
      />
      <mesh geometry={geometries.top} material={top} position={[0, RACK.h + 0.002, 0]} />
      <primitive object={leds} />
      <TagAnchor id="homelab" />
    </group>
  );
}
