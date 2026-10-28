import type { Vec3 } from './constants';
import type { BodyId } from './ids';

// Le cadrage de la caméra et la place des objets en portrait. Séparé de
// constants.ts à l'étape 4 : ce fichier appartient à la partie « objets »
// (cadrage sur téléphone), le reste du socle ne bouge pas. constants.ts le
// réexporte : on l'importe toujours depuis '../core/constants'.

/** En dessous de ce rapport largeur / hauteur, la fenêtre est en portrait. */
export const PORTRAIT_MAX_ASPECT = 0.9;

/** Une vue : point visé, élévation et azimut (radians), distance, champ vertical (degrés). */
export interface View {
  target: Vec3;
  elev: number;
  az: number;
  dist: number;
  fov: number;
}

/**
 * La vue de repos, d'en haut. La distance est calculée au cadrage
 * (layout() du prototype, fitRestView dans stage/framing.ts) : c'est la plus
 * petite qui fait tenir tout le bureau utile (corps du plateau, écran,
 * casque, micro, lampe) et les points REST_FIT dans les limites données en
 * coordonnées normalisées de l'écran.
 */
export const REST = {
  landscape: { target: [0.1, 0, 0.05], elev: 0.96, az: 0, dist: 15, fov: 29 },
  // En portrait, un peu plus bas qu'en paysage : l'écran se lit mieux, et le
  // mur et la fenêtre remplissent le haut (le bureau est deux fois plus
  // large que haut, le téléphone deux fois plus haut que large).
  portrait: { target: [0, 0, -0.05], elev: 0.85, az: 0, dist: 15, fov: 40 },
} as const satisfies Record<string, View>;

/**
 * Points du décor qui doivent aussi tenir dans le cadre au repos (le reste
 * du bureau utile est calculé : stage/framing.ts, deskExtent), et limites à
 * l'écran. En portrait, les limites se calculent d'après PORTRAIT_HUD quand
 * la taille de la fenêtre est connue.
 */
export const REST_FIT = {
  landscape: {
    points: [
      [-6.1, 0, 2.9],
      [5.9, 0, 2.6],
      [-5.8, 0, -3.0],
      [5.6, 0, -2.9],
      [0.3, 3.85, -3.0],
      [6.6, 2.2, -1.2],
    ] as Vec3[],
    limits: { x: 0.98, yBottom: -0.74, yTop: 0.86 },
  },
  portrait: {
    points: [
      [-4.3, 0, 2.55],
      [4.3, 0, 2.4],
      [-4.2, 0, -2.9],
      [4.2, 0, -2.6],
      [0.3, 3.8, -3.0],
    ] as Vec3[],
    limits: { x: 0.98, yBottom: -0.5, yTop: 0.7 },
  },
} as const;

/**
 * Ce que le HUD occupe en portrait, en pixels CSS : en haut, l'identité (les
 * boutons à droite descendent plus bas, mais seulement sur le bord) ; en bas,
 * l'indication, l'heure et les puces. Le bureau tient entre les deux, sur
 * toute la largeur (x, en coordonnées normalisées).
 */
export const PORTRAIT_HUD = { top: 112, bottom: 205, x: 0.985 } as const;

/** La vue de départ de l'arrivée, au ras du bureau (START_L et START_P). */
export const START_L: View = { target: [-0.3, 1.2, 1.1], elev: 0.26, az: 0.3, dist: 7.8, fov: 36 };
export const START_P: View = { target: [-2.4, 2.3, 0.9], elev: 0.32, az: 0.3, dist: 9.5, fov: 52 };

/**
 * Où se tient un objet présenté : centre en coordonnées normalisées (x, y)
 * et part de la hauteur et de la largeur de l'écran qu'il occupe au plus.
 * En portrait, la fiche monte du bas sur au plus 42 % de la hauteur
 * (SHEET.portrait.maxHeight) : l'objet tient au-dessus, de -0.04 à 0.64 en
 * y, sous l'identité du HUD, dans la bande de mur que le cadrage de repos
 * laisse au-dessus du bureau.
 */
export const HELD = {
  landscape: { x: -0.3, y: 0.06, fracH: 0.6, fracW: 0.44 },
  portrait: { x: 0, y: 0.3, fracH: 0.34, fracW: 0.9 },
} as const;

/** Distance maximale entre la caméra et un objet présenté. */
export const HELD_MAX_DISTANCE = 6.2;

/** Gros plan sur l'écran : décalage du point visé et distance, selon l'orientation. */
export const SCREEN_FOCUS = {
  landscape: { offset: [1.55, -0.15, 0] as Vec3, dist: 10 },
  portrait: { offset: [0, -1.7, 0] as Vec3, dist: 14 },
} as const;

/**
 * Places de repos qui changent en portrait (aucune pour l'instant). À
 * l'étape 3, le coffret reculait vers le centre en portrait ; avec ses vrais
 * encombrements (core/bodies.ts), cette place mordait sur le support du
 * casque et le pavé : il reste à sa place, et c'est le cadrage qui fait tenir
 * tout le bureau. Un objet déplacé par le visiteur garde sa place, quel que
 * soit le format. bodies.test.ts vérifie qu'une place ajoutée ici est libre.
 */
export const PORTRAIT_PLACES: Partial<Record<BodyId, { x: number; z: number; ry?: number }>> = {};
