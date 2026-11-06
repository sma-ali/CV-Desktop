// Priorités des useFrame des gestes et du moteur physique. L'horloge est à -100,
// la visite à -95, la caméra à -90, les lumières à -80 (docs/scene-3d.md).
// Ensuite, dans l'ordre de chaque image :

/** Les gestes : le pointeur vise un point du plateau, ?glisse se joue. */
export const GESTURES_PRIORITY = -14;

/** Le rangement : retour des corps tombés et rangement (drive() avant le pas du monde). */
export const TIDY_PRIORITY = -14;

/** Le moteur physique : il avance, puis écrit store.desk. */
export const PHYSICS_PRIORITY = -13;

/** La rotation libre de l'objet présenté (store.heldSpin), avant la présentation (-10). */
export const ROTATION_PRIORITY = -12;
