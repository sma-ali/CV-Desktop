import type { Pulse } from './beats';

// Les mouvements du tapis roulant (projets perso), fonctions pures du temps
// et de l'activité (activityPulse : plus les derniers jours sont actifs,
// plus la période est courte et la force grande). Des cartes vidéo sortent
// de la machine de création, passent sous le scanner (la relecture par les
// agents), reçoivent le tampon du bras robot (la validation humaine) et
// partent dans le tube d'envoi (la publication). Données pures, sans three.

/** Nombre de cartes sur le tapis. */
export const CARDS = 4;

/** Où se tiennent les postes le long du tapis (0 : sortie de la création, 1 : tube d'envoi). */
export const STATIONS = { scan: 0.3, stamp: 0.62 } as const;

/** Demi-largeur (en avancement) de la zone où un poste agit sur une carte. */
const REACH = 0.07;

/** Durée d'un tour de tapis pour une carte (secondes) : de 7 (calme) à 4 (très actif). */
export function beltLap({ strength }: Pulse): number {
  const k = Math.min(1, Math.max(0, (strength - 0.35) / 0.65));
  return 7 - k * 3;
}

/**
 * Avancement de la i-ème carte sur le tapis (0 à la sortie de la création,
 * 1 à l'entrée du tube), régulièrement espacées. t : secondes depuis la
 * mise en marche.
 */
export function cardAt(t: number, index: number, pulse: Pulse): number {
  const lap = beltLap(pulse);
  const u = Math.max(0, t) / lap + index / CARDS;
  return u - Math.floor(u);
}

/** Proximité d'une carte à un poste : 1 juste dessous, 0 hors de portée. */
export function nearStation(u: number, station: number): number {
  return Math.max(0, 1 - Math.abs(u - station) / REACH);
}

/** La plus forte proximité d'une des cartes à un poste (le scanner s'allume, le bras descend). */
export function stationLevel(positions: readonly number[], station: number): number {
  return positions.reduce((level, u) => Math.max(level, nearStation(u, station)), 0);
}

/** Une carte porte le tampon dès qu'elle a passé le bras. */
export function isStamped(u: number): boolean {
  return u >= STATIONS.stamp;
}

/**
 * Les angles d'un bras à deux segments (épaule, coude) dont le bout atteint
 * le point (dz, dy) depuis l'épaule, coude vers le haut. Angles depuis
 * l'horizontale, vers le haut. Hors de portée, le bras s'étire vers le point.
 */
export function armAngles(
  dz: number,
  dy: number,
  upper: number,
  lower: number,
): { shoulder: number; elbow: number } {
  const reach = Math.min(Math.hypot(dz, dy), upper + lower - 1e-6);
  const toward = Math.atan2(dy, dz);
  const cos = (upper ** 2 + reach ** 2 - lower ** 2) / (2 * upper * reach);
  const shoulder = toward + Math.acos(Math.min(1, Math.max(-1, cos)));
  const ez = upper * Math.cos(shoulder);
  const ey = upper * Math.sin(shoulder);
  const tz = reach * Math.cos(toward);
  const ty = reach * Math.sin(toward);
  return { shoulder, elbow: Math.atan2(ty - ey, tz - ez) };
}
