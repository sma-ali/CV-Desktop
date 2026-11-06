import { rng } from '../core/rng';

// La mini baie de 10 pouces du Homelab, en données pures (sans three) : ses
// dimensions, ses quatre équipements (serveur, pare-feu, switch, panneau de
// brassage) et ses LED, qui clignotent selon une graine. Le composant
// (Homelab.tsx) et la peinture de la façade (paint.ts) lisent les mêmes
// positions ; homelab.test.ts vérifie que les LED sont déterministes.
//
// Repère de l'objet : y monte depuis le plateau, la façade regarde +z (le
// visiteur), le dos -z. Unités de la scène (environ 10 cm).

/** La baie : largeur (x), profondeur (z), hauteur, épaisseur des plaques et des montants. */
export const RACK = { w: 0.96, d: 0.76, h: 0.92, plate: 0.05, top: 0.04, post: 0.05 } as const;

/** La façade des équipements : un plan peint, entre les montants. */
export const FACE = { x0: -0.42, x1: 0.42, y0: 0.06, y1: 0.79, z: 0.334 } as const;

/** Profondeur des équipements (leur façade affleure FACE.z). */
export const UNIT_DEPTH = 0.66;

export type UnitId = 'server' | 'firewall' | 'switch' | 'patch';

export interface RackUnit {
  id: UnitId;
  /** Bas et haut de l'équipement. */
  y0: number;
  y1: number;
  /** Couleur du boîtier. */
  color: number;
}

/** Du bas vers le haut : le serveur (lourd) en bas, le brassage en haut. */
export const UNITS: readonly RackUnit[] = [
  { id: 'server', y0: 0.06, y1: 0.36, color: 0x2f3237 },
  { id: 'firewall', y0: 0.38, y1: 0.51, color: 0x3b3f45 },
  { id: 'switch', y0: 0.53, y1: 0.66, color: 0x34383d },
  { id: 'patch', y0: 0.68, y1: 0.79, color: 0x26292d },
];

/** idle : la LED d'un port sans câble, éteinte. */
type LedKind = 'power' | 'link' | 'activity' | 'idle';
export type LedColor = 'green' | 'amber' | 'blue';

export interface LedSpec {
  unit: UnitId;
  /** Position sur la façade (repère de l'objet). */
  x: number;
  y: number;
  kind: LedKind;
  color: LedColor;
  /** Changements d'état par seconde (activité), décalage de phase. */
  rate: number;
  phase: number;
  /** Part du temps allumée (activité). */
  duty: number;
  /** Graine propre à la LED, pour son tirage. */
  salt: number;
}

/** Composantes linéaires de chaque couleur, allumée. */
export const LED_RGB: Record<LedColor, readonly [number, number, number]> = {
  green: [0.3, 1, 0.45],
  amber: [1, 0.62, 0.16],
  blue: [0.35, 0.7, 1],
};

/** La graine des LED de la baie : mêmes clignotements à chaque visite. */
export const HOMELAB_SEED = 1012;

/** Le milieu vertical d'un équipement. */
function unitCenter(id: UnitId): number {
  const unit = UNITS.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`équipement inconnu : ${id}`);
  return (unit.y0 + unit.y1) / 2;
}

/** Les ports RJ45 du switch (huit) et du pare-feu (quatre) : x des prises. */
const SWITCH_PORTS = Array.from({ length: 8 }, (_, i) => -0.04 + i * 0.056);
const FIREWALL_PORTS = Array.from({ length: 4 }, (_, i) => 0.06 + i * 0.075);
/** Les douze prises numérotées du panneau de brassage : x des prises. */
const PATCH_PORTS = Array.from({ length: 12 }, (_, i) => -0.328 + i * 0.05775);

export type PortUnit = 'switch' | 'firewall' | 'patch';

/** Les prises de chaque équipement, de gauche à droite. */
export const PORTS: Record<PortUnit, readonly number[]> = {
  switch: SWITCH_PORTS,
  firewall: FIREWALL_PORTS,
  patch: PATCH_PORTS,
};

/** Le centre vertical des prises de chaque équipement (la peinture et les câbles le partagent). */
export function portY(unit: PortUnit): number {
  // Sur le switch, les prises sont un peu sous le milieu : leurs LED au-dessus.
  return unitCenter(unit) + (unit === 'switch' ? -0.0105 : 0);
}

/** Taille d'une prise peinte (largeur, hauteur), en unités de la façade. */
export const JACK: Record<PortUnit, readonly [number, number]> = {
  switch: [0.039, 0.03],
  firewall: [0.045, 0.034],
  patch: [0.034, 0.026],
};

/** Une prise : un équipement et son numéro (de 0, de gauche à droite). */
export interface PortRef {
  unit: PortUnit;
  index: number;
}

/** Un câble de brassage, branché d'une prise à l'autre. */
export interface CableSpec {
  from: PortRef;
  to: PortRef;
  color: number;
}

/**
 * Le brassage : deux câbles du pare-feu (ports LAN) vers le switch, deux du
 * switch vers le panneau de brassage. Chaque bout est dans une prise.
 */
export const CABLES: readonly CableSpec[] = [
  { from: { unit: 'switch', index: 0 }, to: { unit: 'firewall', index: 1 }, color: 0x3d7cc9 },
  { from: { unit: 'switch', index: 2 }, to: { unit: 'firewall', index: 3 }, color: 0xd9b23a },
  { from: { unit: 'switch', index: 5 }, to: { unit: 'patch', index: 9 }, color: 0xc2492f },
  { from: { unit: 'switch', index: 7 }, to: { unit: 'patch', index: 11 }, color: 0x4f7a45 },
];

/** Le centre d'une prise sur la façade (x, y). */
export function portPoint(port: PortRef): [number, number] {
  const x = PORTS[port.unit][port.index];
  if (x === undefined) throw new Error(`prise inconnue : ${port.unit} ${port.index}`);
  return [x, portY(port.unit)];
}

/** Les ports du switch où un câble est branché. */
function wiredSwitchPorts(): Set<number> {
  const wired = new Set<number>();
  for (const cable of CABLES) {
    for (const end of [cable.from, cable.to]) if (end.unit === 'switch') wired.add(end.index);
  }
  return wired;
}

/** Les LED de la baie, placées et tirées une fois pour toutes d'après la graine. */
export function homelabLeds(seed: number = HOMELAB_SEED): LedSpec[] {
  const random = rng(seed);
  const leds: LedSpec[] = [];
  const add = (unit: UnitId, x: number, y: number, kind: LedKind, color: LedColor) => {
    leds.push({
      unit,
      x,
      y,
      kind,
      color,
      rate: kind === 'activity' ? 3 + random() * 6 : 0.7 + random() * 0.8,
      phase: random() * 100,
      duty: kind === 'activity' ? 0.35 + random() * 0.35 : 0.92,
      salt: Math.floor(random() * 1e6),
    });
  };
  const server = unitCenter('server');
  add('server', -0.36, server + 0.08, 'power', 'blue');
  add('server', -0.36, server + 0.02, 'activity', 'amber');
  add('server', -0.36, server - 0.04, 'activity', 'amber');
  const firewall = unitCenter('firewall');
  add('firewall', -0.36, firewall + 0.025, 'power', 'green');
  add('firewall', -0.3, firewall + 0.025, 'link', 'green');
  add('firewall', -0.24, firewall + 0.025, 'activity', 'amber');
  const sw = unitCenter('switch');
  add('switch', -0.36, sw + 0.025, 'power', 'green');
  // Une LED par port : elle ne s'allume que si un câble y est branché.
  const wired = wiredSwitchPorts();
  SWITCH_PORTS.forEach((x, i) =>
    add('switch', x, sw + 0.042, wired.has(i) ? 'activity' : 'idle', 'green'),
  );
  return leds;
}

/** Un entier mélangé en [0, 1) : le tirage d'une LED pour un créneau de temps. */
export function hash01(n: number, salt: number): number {
  let h = Math.imul((n | 0) ^ salt, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Éteinte, une LED garde un reste de lueur. */
export const LED_OFF = 0.08;

/**
 * L'éclat d'une LED à l'instant t (0 à 1) : fonction pure du temps, donc
 * figée quand l'horloge l'est (?fige). En mouvement réduit, rien ne
 * clignote : chaque LED reste allumée.
 */
export function ledLevel(led: LedSpec, t: number, reduced: boolean): number {
  if (led.kind === 'power') return 1;
  if (led.kind === 'idle') return LED_OFF;
  if (reduced) return led.kind === 'activity' ? 0.7 : 1;
  const slot = Math.floor(t * led.rate + led.phase);
  // Un lien reste presque toujours allumé ; l'activité scintille.
  return hash01(slot, led.salt) < led.duty ? 1 : LED_OFF;
}
