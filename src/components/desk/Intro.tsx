'use client';

import type { DeskHudTexts } from '@/lib/desk';

// Partie C de l'étape 6 : l'écran de chargement (fond sombre, le filament de
// la lampe qui chauffe sert de barre de progression, « Ali Smaani » et
// « Préparation du bureau »), rendu par le serveur dès le premier octet, puis
// fondu quand la scène est prête. Point d'accroche posé par le socle, monté
// dans DeskShell, qui ne montre encore rien : l'ancien « Le bureau
// s'installe » du HUD tient lieu d'écran de chargement. La progression
// réelle est dans store.load (core/loading.ts, loadProgress). Voir
// docs/bureau-vivant.md.
export function Intro({
  name,
  texts,
  done,
}: {
  name: string;
  texts: DeskHudTexts['intro'];
  /** La scène est prête, ou le repli s'affiche : l'écran s'efface. */
  done: boolean;
}) {
  void name;
  void texts;
  void done;
  return null;
}
