'use client';

import { SceneCanvas } from './core/SceneCanvas';
import type { SceneTexts } from './core/texts';
import { Decor } from './decor/Decor';
import { Gestures } from './gestures/Gestures';
import { CvItems } from './items/CvItems';
import { PhysicsGate } from './physics/PhysicsGate';
import { HeldRotation } from './rotation/HeldRotation';
import { Stage } from './stage/Stage';
import { Tidy } from './tidy/Tidy';

export interface SceneProps {
  texts: SceneTexts;
  className?: string;
  onReady?: () => void;
  onContextLost?: () => void;
}

// La scène du bureau, chargée à part (next/dynamic, sans rendu serveur) après
// le premier affichage de la page. Elle compose les parties, chacune dans son
// dossier et propriété d'un seul agent : ce fichier ne change pas quand elles
// changent (voir docs/scene-3d.md). Étape 4 : les gestes s'ajoutent à côté
// du décor, des objets et de la mise en scène. Étape 6 (docs/bureau-vivant.md) :
// le moteur physique, chargé à part (PhysicsGate), la rotation libre de
// l'objet présenté (partie A) et le rangement (partie B).
export default function Scene({ texts, className, onReady, onContextLost }: SceneProps) {
  return (
    <SceneCanvas
      label={texts.canvasLabel}
      className={className}
      onReady={onReady}
      onContextLost={onContextLost}
    >
      <Decor />
      <CvItems texts={texts} />
      <Stage />
      <Gestures />
      <PhysicsGate />
      <HeldRotation />
      <Tidy />
    </SceneCanvas>
  );
}
