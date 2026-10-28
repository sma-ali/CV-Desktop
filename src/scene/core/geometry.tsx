'use client';

import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  Quaternion,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Vec3 } from './constants';

// Les briques du low poly, comme box(), cyl(), sph(), rod() et cable() dans le
// prototype. Chaque brique porte et reçoit les ombres par défaut ; elle prend
// les props d'un <mesh> (position, rotation, material, onClick...).

type MeshProps = Omit<ThreeElements['mesh'], 'geometry' | 'args'>;

export const v3 = ([x, y, z]: Vec3) => new Vector3(x, y, z);

/** Libère une géométrie créée avec useMemo quand elle change ou au démontage. */
function useDisposable<T extends BufferGeometry>(geometry: T): T {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Plan posé à plat, face vers +y ; le haut de la texture vers -z (flatGeo du prototype). */
export function flatPlaneGeometry(width: number, depth: number, segments = 1): PlaneGeometry {
  const geometry = new PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function Box({ size, ...props }: MeshProps & { size: Vec3 }) {
  const [w, h, d] = size;
  const geometry = useDisposable(useMemo(() => new BoxGeometry(w, h, d), [w, h, d]));
  return <mesh geometry={geometry} castShadow receiveShadow {...props} />;
}

export function Cyl({
  radiusTop,
  radiusBottom,
  height,
  segments = 8,
  ...props
}: MeshProps & { radiusTop: number; radiusBottom: number; height: number; segments?: number }) {
  const geometry = useDisposable(
    useMemo(
      () => new CylinderGeometry(radiusTop, radiusBottom, height, segments),
      [radiusTop, radiusBottom, height, segments],
    ),
  );
  return <mesh geometry={geometry} castShadow receiveShadow {...props} />;
}

/** Sphère facettée (icosaèdre) : detail 0 ou 1, comme dans le prototype. */
export function Sph({
  radius,
  detail = 0,
  ...props
}: MeshProps & { radius: number; detail?: number }) {
  const geometry = useDisposable(
    useMemo(() => new IcosahedronGeometry(radius, detail), [radius, detail]),
  );
  return <mesh geometry={geometry} castShadow receiveShadow {...props} />;
}

/** Tige cylindrique d'un point à un autre (bras de lampe, de micro). */
export function Rod({
  from,
  to,
  radius,
  segments = 7,
  ...props
}: Omit<MeshProps, 'position' | 'quaternion' | 'rotation'> & {
  from: Vec3;
  to: Vec3;
  radius: number;
  segments?: number;
}) {
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  const { geometry, position, quaternion } = useMemo(() => {
    const a = new Vector3(ax, ay, az);
    const direction = new Vector3(bx, by, bz).sub(a);
    const length = direction.length();
    return {
      geometry: new CylinderGeometry(radius, radius, length, segments),
      position: a.addScaledVector(direction, 0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
    };
  }, [ax, ay, az, bx, by, bz, radius, segments]);
  useDisposable(geometry);
  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      castShadow
      receiveShadow
      {...props}
    />
  );
}

/** Câble souple passant par des points (courbe de Catmull-Rom). */
export function Cable({
  points,
  radius,
  closed = false,
  tubularSegments = 40,
  radialSegments = 5,
  ...props
}: MeshProps & {
  points: readonly Vec3[];
  radius: number;
  closed?: boolean;
  tubularSegments?: number;
  radialSegments?: number;
}) {
  const key = JSON.stringify(points);
  const geometry = useDisposable(
    useMemo(() => {
      const curve = new CatmullRomCurve3(
        (JSON.parse(key) as Vec3[]).map((point) => v3(point)),
        closed,
      );
      return new TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
    }, [key, radius, closed, tubularSegments, radialSegments]),
  );
  return <mesh geometry={geometry} castShadow receiveShadow {...props} />;
}
