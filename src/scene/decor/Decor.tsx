'use client';

import { Kimono } from './Kimono';
import { Lamp } from './Lamp';
import { LoadProbe } from './LoadProbe';
import { Props } from './Props';
import { Room } from './Room';
import { Workspace } from './Workspace';

// Le décor du bureau : la pièce (plateau en noyer, sol, mur et fenêtre), la
// lampe d'architecte, le poste de travail (tapis, clavier, souris, câbles),
// le kimono plié et sa ceinture, et les petites choses posées (pendule,
// bandes, plante, mangas, figurines, tasse, manette). Chaque morceau posé est
// un corps du moteur physique (DecorPiece suit sa pose). Tout est inventé :
// aucune marque, aucun logo, aucun jeu, anime ou
// pseudo réel.
//
// Lumières, ciel derrière la vitre, cône et poussière de la lampe : mise en
// scène. Le ciel se pose à WINDOW_SKY (core/constants.ts) ; le décor suit
// l'horloge du store pour ses LED et ses petites animations (figées par
// ?fige, coupées en mouvement réduit). LoadProbe fait avancer l'écran de
// chargement (textures, shaders, première image).
export function Decor() {
  return (
    <group name="decor">
      <Room />
      <Lamp />
      <Workspace />
      <Kimono />
      <Props />
      <LoadProbe />
    </group>
  );
}
