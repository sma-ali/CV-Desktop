// Valeurs par image partagées entre les composants de la mise en scène
// (mutables, jamais dans un état React). Un objet par Stage, passé en props.
export interface StageShared {
  /** Avancement du gros plan sur l'écran (0 à 1), écrit par la caméra, lu par l'étalonnage. */
  screenFocus: number;
}

export const createStageShared = (): StageShared => ({ screenFocus: 0 });
