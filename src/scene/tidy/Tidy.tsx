'use client';

// Partie B de l'étape 6 : le désordre du bureau (score), le retour en douceur
// d'un objet tombé, et le rangement animé demandé par le bouton du HUD.
// Point d'accroche posé par le socle : ce composant est monté dans
// Scene.tsx et ne fait encore rien. Il lit store.desk et homePose(), pilote
// les corps par gestureHub(store).physics (takeOver, drive, handBack,
// sendHome) à TIDY_PRIORITY, écrit setDisorder et setTidying, et s'abonne à
// tidyRequests. Voir docs/bureau-vivant.md.
export function Tidy() {
  return null;
}
