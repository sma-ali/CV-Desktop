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

/**
 * L'attente au-delà de laquelle une scène qui n'a toujours pas dessiné sa
 * première image cède la place à la version express. Seul compte le temps
 * où la page attend sans rien faire (réseau lent, fichier qui n'arrive pas),
 * onglet visible : le temps où elle travaille (montage de la scène,
 * compilation des shaders, qui bloquent la page) ne compte pas, car elle
 * avance. Un recruteur pressé a de toute façon le lien vers la version
 * express sous les yeux.
 */
export const LOAD_TIMEOUT_MS = 20_000;

/** Le battement qui mesure l'attente (setInterval). */
export const IDLE_BEAT_MS = 250;

/**
 * Un écart entre deux battements à partir duquel la page travaillait (une
 * longue tâche l'a bloquée) au lieu d'attendre : cet écart ne compte pas.
 */
export const BUSY_GAP_MS = 1000;

/** L'attente cumulée après un battement survenu gapMs après le précédent. */
export function idleWait(waited: number, gapMs: number, hidden: boolean): number {
  if (hidden || !(gapMs > 0) || gapMs >= BUSY_GAP_MS) return waited;
  return waited + gapMs;
}

/**
 * Le délai de l'adresse (?attente=ms, pour les tests), sinon LOAD_TIMEOUT_MS.
 * ?attente=0 ne renonce jamais.
 */
export function loadTimeout(search: string): number {
  const raw = new URLSearchParams(search).get('attente');
  if (raw === null || raw.trim() === '') return LOAD_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return LOAD_TIMEOUT_MS;
  return value === 0 ? Infinity : value;
}

/**
 * Ce que montre l'écran de chargement : l'avancement réel, arrondi au
 * centième (le filament ne change pas de dessin pour un millième), et 1
 * quand la scène est prête.
 */
export function introProgress(load: LoadProgress, ready: boolean): number {
  if (ready) return 1;
  return Math.floor(loadProgress(load) * 100) / 100;
}
