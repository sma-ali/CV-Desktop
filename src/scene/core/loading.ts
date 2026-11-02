// L'avancement du chargement de la scène (étape 6), montré par l'écran de
// chargement : le filament de la lampe qui chauffe (partie C). Des étapes
// réelles, chacune de 0 à 1, écrites dans le store (setLoad) :
//
// - code : le fichier JavaScript de la scène (DeskShell, à l'arrivée du module) ;
// - assets : les textures peintes et les polices (useCanvasTexture) ;
// - shaders : la compilation des matériaux (première image, ou gl.compile) ;
// - frame : la première image dessinée (markReady).
//
// Aucune dépendance : ce module part dans le JavaScript initial.

export const LOAD_STEPS = ['code', 'assets', 'shaders', 'frame'] as const;

export type LoadStep = (typeof LOAD_STEPS)[number];

export type LoadProgress = Readonly<Record<LoadStep, number>>;

export const EMPTY_LOAD: LoadProgress = { code: 0, assets: 0, shaders: 0, frame: 0 };

/** Le poids de chaque étape dans la barre (somme : 1). Le code pèse le plus sur un réseau lent. */
export const LOAD_WEIGHTS: LoadProgress = { code: 0.45, assets: 0.2, shaders: 0.25, frame: 0.1 };

/** L'avancement global, de 0 à 1. */
export function loadProgress(load: LoadProgress): number {
  let total = 0;
  for (const step of LOAD_STEPS) total += LOAD_WEIGHTS[step] * Math.min(1, Math.max(0, load[step]));
  return Math.min(1, total);
}
