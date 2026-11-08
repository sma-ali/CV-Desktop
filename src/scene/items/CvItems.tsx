'use client';

import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { Badge } from './Badge';
import { Book } from './Book';
import { Card } from './Card';
import { Casd } from './Casd';
import { Factory } from './Factory';
import { Headset } from './Headset';
import { Homelab } from './Homelab';
import { Laptop } from './Laptop';
import { Monitor } from './Monitor';
import { Netherbrain } from './Netherbrain';
import { PostIt } from './PostIt';
import { ITEMS_PRIORITY } from './presentation';
import { TagAnchorsContext, TagLayer, type TagAnchors } from './TagLayer';
import { PresentProgress, ProgressContext } from './usePresentation';

// Les objets du CV posés sur le bureau : l'écran et son code, le livre et le
// badge (DEFI-METIERS), le post-it, le casque et le boîtier du CASD
// (DARES), le bocal de Netherbrain et la baie du Homelab (projets 2026), le
// portable (les compétences), la carte de visite (contact) et l'usine,
// un tapis roulant (projets perso). Chacun se survole, se présente au clic et porte son étiquette.
// Un clic hors des objets repose celui qui est présenté.

export function CvItems({ texts }: { texts: SceneTexts }) {
  const store = useSceneStoreApi();
  const [progress] = useState(() => new PresentProgress());
  const [anchors] = useState<TagAnchors>(() => new Map());

  // Avant les objets : la caméra que la mise en scène vient de placer sert à
  // calculer la pose de l'objet tenu ; ses matrices doivent être à jour.
  useFrame(({ camera }) => {
    camera.updateMatrixWorld();
  }, ITEMS_PRIORITY - 1);

  // Après les objets : l'avancement de la présentation, lu par la mise en scène.
  useFrame(() => {
    store.getState().frame.presentLevel = progress.max();
  }, ITEMS_PRIORITY + 1);

  return (
    <ProgressContext value={progress}>
      <TagAnchorsContext value={anchors}>
        <group
          name={`cv-items-${texts.locale}`}
          onPointerMissed={() => {
            const scene = store.getState();
            scene.markUser();
            scene.putBack();
          }}
        >
          <Monitor texts={texts} />
          <Book texts={texts} />
          <Badge texts={texts} />
          <PostIt texts={texts} />
          <Headset />
          <Casd texts={texts} />
          <Laptop texts={texts} />
          <Card texts={texts} />
          <Factory texts={texts} />
          <Netherbrain texts={texts} />
          <Homelab texts={texts} />
        </group>
        <TagLayer texts={texts} progress={progress} />
      </TagAnchorsContext>
    </ProgressContext>
  );
}
