import type { Pulse } from './beats';

// Les mouvements de la mini usine (projets perso), fonctions pures du temps
// et de l'activité (activityPulse : plus les derniers jours sont actifs,
// plus la période est courte et la force grande). Le tapis roulant sort des
// cassettes, la cheminée fume. Données pures, sans three.

/** Nombre de cassettes sur le tapis, et de bouffées de fumée. */
export const CASSETTES = 3;
export const PUFFS = 3;

/** Durée d'un tour de tapis pour une cassette (secondes) : de 5.5 (calme) à 3 (très actif). */
export function beltLap({ strength }: Pulse): number {
  const k = Math.min(1, Math.max(0, (strength - 0.35) / 0.65));
  return 5.5 - k * 2.5;
}

/**
 * Avancement de la i-ème cassette sur le tapis (0 à la sortie de la halle,
 * 1 au bout), régulièrement espacées. t : secondes depuis la mise en marche.
 */
export function cassetteAt(t: number, index: number, pulse: Pulse): number {
  const lap = beltLap(pulse);
  const u = Math.max(0, t) / lap + index / CASSETTES;
  return u - Math.floor(u);
}

/** Une bouffée de fumée : hauteur au-dessus de la cheminée, taille et opacité. */
export interface Puff {
  rise: number;
  scale: number;
  opacity: number;
}

/**
 * La i-ème bouffée à l'instant t : elle monte, grossit et s'efface, puis
 * repart. Plus l'usine est active, plus la fumée est dense.
 */
export function puffAt(t: number, index: number, pulse: Pulse): Puff {
  const cycle = 2.4 + pulse.period * 0.4;
  const u0 = Math.max(0, t) / cycle + index / PUFFS;
  const u = u0 - Math.floor(u0);
  return {
    rise: u * 0.55,
    scale: 0.05 + u * 0.09,
    opacity: (1 - u) * Math.min(1, u * 6) * (0.35 + pulse.strength * 0.4),
  };
}
