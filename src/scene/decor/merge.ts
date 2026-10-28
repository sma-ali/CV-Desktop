import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  FrontSide,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type ColorRepresentation,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../core/constants';

// Le décor compte des dizaines de petites pièces fixes (pieds, rotules,
// boutons, poignées...). Au lieu d'un maillage par pièce, on les fusionne :
// chaque pièce garde sa couleur (couleurs de sommets) et toutes celles d'un
// même fini (mat, satiné, métal...) partent en un seul appel de dessin, et
// en un seul passage dans chaque carte d'ombres.

/** Les finis du décor : un matériau partagé par fini. */
export type Finish = 'matte' | 'satin' | 'gloss' | 'metal' | 'brass' | 'leaf' | 'unlit';

export interface Part {
  geometry: BufferGeometry;
  color: ColorRepresentation;
  finish?: Finish;
  position?: Vec3;
  /** Rotation d'Euler (ordre XYZ), ignorée si quaternion est donné. */
  rotation?: Vec3;
  quaternion?: Quaternion;
  scale?: Vec3 | number;
}

const KEPT_ATTRIBUTES = new Set(['position', 'normal', 'uv']);

/** Applique la pose d'une pièce, la peint de sa couleur et ne garde que les attributs communs. */
export function preparePart(part: Part): BufferGeometry {
  const source = part.geometry;
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  for (const name of Object.keys(geometry.attributes)) {
    if (!KEPT_ATTRIBUTES.has(name)) geometry.deleteAttribute(name);
  }
  const count = geometry.getAttribute('position').count;
  if (!geometry.hasAttribute('uv')) {
    geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  geometry.clearGroups();

  const quaternion =
    part.quaternion ?? new Quaternion().setFromEuler(new Euler(...(part.rotation ?? [0, 0, 0])));
  const scale =
    typeof part.scale === 'number'
      ? new Vector3(part.scale, part.scale, part.scale)
      : new Vector3(...(part.scale ?? [1, 1, 1]));
  const matrix = new Matrix4().compose(
    new Vector3(...(part.position ?? [0, 0, 0])),
    quaternion,
    scale,
  );
  geometry.applyMatrix4(matrix);

  // Couleur hexadécimale (sRGB) convertie dans l'espace de travail linéaire par three.
  const color = new Color(part.color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Fusionne des pièces déjà préparées (ou non) en une géométrie. */
export function mergeParts(parts: readonly Part[]): BufferGeometry {
  const prepared = parts.map(preparePart);
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('Fusion du décor impossible : attributs incompatibles');
  return merged;
}

/** Une géométrie fusionnée par fini, dans l'ordre où les finis apparaissent. */
export function mergeByFinish(
  parts: readonly Part[],
): { finish: Finish; geometry: BufferGeometry }[] {
  const groups = new Map<Finish, Part[]>();
  for (const part of parts) {
    const finish = part.finish ?? 'matte';
    const list = groups.get(finish);
    if (list) list.push(part);
    else groups.set(finish, [part]);
  }
  return [...groups].map(([finish, list]) => ({ finish, geometry: mergeParts(list) }));
}

const FINISHES: Record<Exclude<Finish, 'unlit'>, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.82, metalness: 0 },
  satin: { roughness: 0.55, metalness: 0 },
  gloss: { roughness: 0.35, metalness: 0 },
  metal: { roughness: 0.45, metalness: 0.5 },
  brass: { roughness: 0.38, metalness: 0.75 },
  leaf: { roughness: 0.7, metalness: 0 },
};

const materials = new Map<Finish, Material>();

/**
 * Le matériau partagé d'un fini, qui lit la couleur des sommets. Partagé
 * entre toutes les pièces du décor : ne jamais le modifier.
 */
export function finishMaterial(finish: Finish): Material {
  let material = materials.get(finish);
  if (!material) {
    material =
      finish === 'unlit'
        ? new MeshBasicMaterial({ vertexColors: true })
        : new MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            side: finish === 'leaf' ? DoubleSide : FrontSide,
            ...FINISHES[finish],
          });
    materials.set(finish, material);
  }
  return material;
}
