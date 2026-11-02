'use client';

// Partie A de l'étape 6 : la rotation libre de l'objet présenté (glisser à
// la souris ou au doigt, type trackball, avec un peu d'inertie ; flèches du
// clavier ; « Remettre droit »). Point d'accroche posé par le socle : ce
// composant est monté dans Scene.tsx et ne fait encore rien. Il écrit
// store.heldSpin (lu par usePresentation) à ROTATION_PRIORITY, lit
// gestureHub(store).press (held : l'appui a commencé sur l'objet présenté)
// et s'abonne à uprightRequests. Voir docs/bureau-vivant.md.
export function HeldRotation() {
  return null;
}
