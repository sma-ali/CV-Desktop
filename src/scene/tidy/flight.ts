import type { DeskPose } from '../core/bodies';

// Le trajet d'un corps qui rentre à sa place (partie B de l'étape 6) : il
// monte presque à la verticale, passe au-dessus du bureau, puis descend à
// la verticale sur sa place, en se remettant droit à son cap d'origine.
// Courbe de Bézier cubique (départ, au-dessus du départ, au-dessus de
// l'arrivée, arrivée) et rotation par slerp, toutes deux adoucies au début
// et à la fin. Données pures, sans three.

/** Une pose complète : place, hauteur et orientation (quaternion). */
export interface FullPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

/** Une pose du trajet, comme drive() l'attend. */
export type FlightPose = DeskPose & { qx: number; qy: number; qz: number; qw: number };

/** Adoucie au début et à la fin (cubique). */
export function easeInOut(u: number): number {
  const k = Math.min(1, Math.max(0, u));
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/** Le quaternion d'un cap (rotation autour de y). */
export function yawQuaternion(ry: number) {
  return { qx: 0, qy: Math.sin(ry / 2), qz: 0, qw: Math.cos(ry / 2) };
}

/** Interpolation sphérique de deux quaternions (le plus court chemin). */
export function slerp(
  a: Pick<FullPose, 'qx' | 'qy' | 'qz' | 'qw'>,
  b: Pick<FullPose, 'qx' | 'qy' | 'qz' | 'qw'>,
  k: number,
) {
  let { qx: bx, qy: by, qz: bz, qw: bw } = b;
  let cos = a.qx * bx + a.qy * by + a.qz * bz + a.qw * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let wa: number;
  let wb: number;
  if (cos > 0.9995) {
    wa = 1 - k;
    wb = k;
  } else {
    const angle = Math.acos(cos);
    const sin = Math.sin(angle);
    wa = Math.sin((1 - k) * angle) / sin;
    wb = Math.sin(k * angle) / sin;
  }
  const qx = a.qx * wa + bx * wb;
  const qy = a.qy * wa + by * wb;
  const qz = a.qz * wa + bz * wb;
  const qw = a.qw * wa + bw * wb;
  const n = Math.hypot(qx, qy, qz, qw) || 1;
  return { qx: qx / n, qy: qy / n, qz: qz / n, qw: qw / n };
}

const bezier = (a: number, b: number, c: number, d: number, k: number) => {
  const m = 1 - k;
  return m * m * m * a + 3 * m * m * k * b + 3 * m * k * k * c + k * k * k * d;
};

/**
 * La pose au temps u (0 au départ, 1 arrivé) d'un corps qui va de start à
 * home, en passant à lift au-dessus du plus haut des deux.
 */
export function flightPose(start: FullPose, home: DeskPose, u: number, lift: number): FlightPose {
  const k = easeInOut(u);
  const peak = Math.max(start.y, home.y) + lift;
  const q = slerp(start, yawQuaternion(home.ry), k);
  const pose: FlightPose = {
    x: bezier(start.x, start.x, home.x, home.x, k),
    y: bezier(start.y, peak, peak, home.y, k),
    z: bezier(start.z, start.z, home.z, home.z, k),
    ry: 0,
    ...q,
  };
  pose.ry = Math.atan2(2 * (q.qw * q.qy + q.qx * q.qz), 1 - 2 * (q.qy * q.qy + q.qx * q.qx));
  return pose;
}

/** Le plateau vu de dessus, selon le format, et le dessous de son épaisseur. */
export interface DeskArea {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Sous cette hauteur, on est sous le plateau. */
  under: number;
}

/**
 * Un corps tombé sous le plateau ne doit pas remonter à travers lui (il
 * soulèverait ce qui est posé dessus) : le point du sol hors du plateau le
 * plus proche, à margin du bord (jamais vers le mur du fond), ou null s'il
 * n'est pas dessous.
 */
export function deskExit(
  pose: { x: number; y: number; z: number },
  desk: DeskArea,
  margin: number,
): { x: number; z: number } | null {
  const inside =
    pose.y < desk.under &&
    pose.x > desk.x0 - margin &&
    pose.x < desk.x1 + margin &&
    pose.z < desk.z1 + margin;
  if (!inside) return null;
  const left = pose.x - (desk.x0 - margin);
  const right = desk.x1 + margin - pose.x;
  const front = desk.z1 + margin - pose.z;
  if (front <= left && front <= right) return { x: pose.x, z: desk.z1 + margin };
  return left <= right ? { x: desk.x0 - margin, z: pose.z } : { x: desk.x1 + margin, z: pose.z };
}
