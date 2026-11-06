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
// dossier (voir docs/architecture.md) : le décor, les objets du CV, la mise en
// scène et les gestes, puis le moteur physique, chargé à part (PhysicsGate),
// la rotation libre de l'objet présenté et le rangement du bureau.
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
