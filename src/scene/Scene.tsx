'use client';

import { SceneCanvas } from './core/SceneCanvas';
import type { SceneTexts } from './core/texts';
import { Decor } from './decor/Decor';
import { CvItems } from './items/CvItems';
import { Stage } from './stage/Stage';

export interface SceneProps {
  texts: SceneTexts;
  className?: string;
  onReady?: () => void;
  onContextLost?: () => void;
}

// La scène du bureau, chargée à part (next/dynamic, sans rendu serveur) après
// le premier affichage de la page. Elle compose les trois parties, chacune
// dans son dossier et propriété d'un seul agent : ce fichier ne change pas
// quand elles changent (voir docs/scene-3d.md).
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
    </SceneCanvas>
  );
}
