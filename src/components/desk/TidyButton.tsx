'use client';

import type { DeskHudTexts } from '@/lib/desk';

// Partie B de l'étape 6 : le bouton « Oulala, vous avez tout cassé. Je range
// pour vous ? », qui apparaît quand le score de désordre (store.disorder)
// passe un seuil, et appelle requestTidy(). Point d'accroche posé par le
// socle, monté dans le HUD, qui ne montre encore rien. Voir
// docs/bureau-vivant.md.
export function TidyButton({ texts }: { texts: DeskHudTexts['tidy'] }) {
  void texts;
  return null;
}
