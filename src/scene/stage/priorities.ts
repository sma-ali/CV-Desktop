// Priorités des useFrame de la mise en scène. Le socle passe d'abord (-100,
// CLOCK_PRIORITY), puis la visite automatique et la caméra, avant les objets
// (priorité 0 ou plus haute) : l'objet présenté se place d'après la caméra
// déjà posée pour cette image. Le post-traitement rend en dernier (1).
export const STAGE_PRIORITY = {
  auto: -95,
  camera: -90,
  lights: -80,
  effects: -10,
} as const;

/** Priorité de rendu du post-traitement : positive, elle remplace le rendu automatique. */
export const RENDER_PRIORITY = 1;
