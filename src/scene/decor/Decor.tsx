'use client';

import { Lamp } from './Lamp';
import { Props } from './Props';
import { Room } from './Room';
import { StreamGear } from './StreamGear';
import { Workspace } from './Workspace';

// Le décor du bureau : la pièce (plateau en noyer, sol, mur et fenêtre), la
// lampe d'architecte, le poste de travail (tapis, clavier, souris, câbles),
// le matériel de stream (pavé de boutons, micro sur bras, panneau de lumière
// et gants) et les petites choses posées (corde, bandes, plante, mangas,
// figurines, tasse, manette). Tout est inventé : aucune marque, aucun logo,
// aucun jeu, anime ou pseudo réel.
//
// Lumières, ciel derrière la vitre, cône et poussière de la lampe : mise en
// scène. Le ciel se pose à WINDOW_SKY (constante du socle) ; le décor suit
// l'horloge du store pour ses LED et ses petites animations (figées par
// ?fige, coupées en mouvement réduit).
export function Decor() {
  return (
    <group name="decor">
      <Room />
      <Lamp />
      <Workspace />
      <StreamGear />
      <Props />
    </group>
  );
}
