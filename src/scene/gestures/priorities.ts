/**
 * Priorité du useFrame des gestes : après la caméra et les lumières (-90,
 * -80), avant les objets (-11, -10) qui se posent à leur place du plateau
 * (store.desk) dans la même image. Le décor (tasse, manette) la lit à 0.
 */
export const GESTURES_PRIORITY = -12;
