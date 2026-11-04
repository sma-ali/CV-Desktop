import { PlaneGeometry } from 'three';

// Géométries propres aux objets du CV.

/** Le post-it du CV, couché (face vers +y), son bord bas relevé. */
export function lyingPostitGeometry(size: number): PlaneGeometry {
  const geometry = new PlaneGeometry(size, size, 5, 5);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i);
      position.setY(i, Math.pow(Math.max(0, z / size + 0.1), 2) * 0.12);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
