import { PlaneGeometry } from 'three';

// Géométries propres aux objets du CV.

/**
 * Le pli du post-it couché : une parabole qui part à CURL_START (en part du
 * côté) avant le milieu ; le bord bas monte de (0.5 + CURL_START)² × CURL_LIFT.
 */
const CURL_START = 0.1;
const CURL_LIFT = 0.12;

/** Le post-it du CV, couché (face vers +y), son bord bas relevé. */
export function lyingPostitGeometry(size: number): PlaneGeometry {
  const geometry = new PlaneGeometry(size, size, 5, 5);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i);
      position.setY(i, Math.pow(Math.max(0, z / size + CURL_START), 2) * CURL_LIFT);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
