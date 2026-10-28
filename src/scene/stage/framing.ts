import { PerspectiveCamera, Vector3 } from 'three';
import { PORTRAIT_MAX_ASPECT, REST, REST_FIT, type Vec3, type View } from '../core/constants';

// PROVISOIRE (partie « mise en scène ») : le cadrage de repos du prototype
// (layout()), porté tel quel. Cherche la plus petite distance qui fait tenir
// les points REST_FIT dans le cadre, en recentrant le point visé.

/** Position de la caméra pour une vue (camAt du prototype). */
export function cameraPosition(
  [tx, ty, tz]: Vec3,
  elev: number,
  az: number,
  dist: number,
  out = new Vector3(),
): Vector3 {
  return out.set(
    tx + Math.sin(az) * Math.cos(elev) * dist,
    ty + Math.sin(elev) * dist,
    tz + Math.cos(az) * Math.cos(elev) * dist,
  );
}

export function fitRestView(aspect: number): View {
  const portrait = aspect < PORTRAIT_MAX_ASPECT;
  const rest = portrait ? REST.portrait : REST.landscape;
  const { points, limits } = portrait ? REST_FIT.portrait : REST_FIT.landscape;
  const camera = new PerspectiveCamera(rest.fov, aspect, 0.1, 90);
  camera.updateProjectionMatrix();
  const probe = new Vector3();
  const target = new Vector3();

  const fitAt = (dist: number): boolean => {
    const [rx, ry, rz] = rest.target;
    target.set(rx, ry, rz);
    for (let iteration = 0; iteration < 6; iteration++) {
      const tuple: Vec3 = [target.x, target.y, target.z];
      cameraPosition(tuple, rest.elev, 0, dist, camera.position);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      let x0 = 9;
      let x1 = -9;
      let y0 = 9;
      let y1 = -9;
      for (const point of points) {
        probe.set(...point).project(camera);
        x0 = Math.min(x0, probe.x);
        x1 = Math.max(x1, probe.x);
        y0 = Math.min(y0, probe.y);
        y1 = Math.max(y1, probe.y);
      }
      if (iteration === 5) {
        return x0 >= -limits.x && x1 <= limits.x && y0 >= limits.yBottom && y1 <= limits.yTop;
      }
      const k = dist * Math.tan((camera.fov * Math.PI) / 360);
      target.z -=
        ((((y0 + y1) / 2 - (limits.yBottom + limits.yTop) / 2) * k) / Math.sin(rest.elev)) * 0.9;
      target.x += ((x0 + x1) / 2) * k * camera.aspect * 0.9;
    }
    return false;
  };

  let lo = 4;
  let hi = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fitAt(mid)) hi = mid;
    else lo = mid;
  }
  fitAt(hi);
  return {
    target: [target.x, target.y, target.z],
    elev: rest.elev,
    az: 0,
    dist: hi,
    fov: rest.fov,
  };
}
