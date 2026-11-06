'use client';

import type { ReactNode } from 'react';
import { formatPlaces } from '@/scene/core/bodies';
import { useSceneStore } from '@/scene/core/store-context';

// La racine du HUD (#hud), qui expose l'état de la scène aux tests par des
// attributs data-* : phase, ambiance, objet présenté, visite, mouvement
// réduit, horloge gelée, objet retourné ou tourné, glisser, son, places des
// objets déplacés, ce qui sort du cadre, moteur physique, corps tombés,
// désordre, rangement. Ces valeurs changent souvent (un glisser déplace les
// places à chaque image) : seul ce composant s'y abonne. Le reste du HUD
// arrive en children, des éléments créés par Hud, que React ne refait pas
// quand seule la sonde change.
export function HudProbe({
  className,
  loading,
  children,
}: {
  className?: string;
  /** L'écran de chargement couvre le HUD : hors du parcours au clavier. */
  loading: boolean;
  children: ReactNode;
}) {
  const initialized = useSceneStore((state) => state.initialized);
  const ready = useSceneStore((state) => state.ready);
  const phase = useSceneStore((state) => state.phase);
  const mood = useSceneStore((state) => state.mood);
  const autoOn = useSceneStore((state) => state.autoOn);
  const presented = useSceneStore((state) => state.presented);
  const flipped = useSceneStore((state) => state.flipped);
  const dragging = useSceneStore((state) => state.dragging);
  const places = useSceneStore((state) => state.places);
  const soundOn = useSceneStore((state) => state.soundOn);
  const offscreen = useSceneStore((state) => state.offscreen);
  const fallen = useSceneStore((state) => state.fallen);
  const physics = useSceneStore((state) => state.physics);
  const disorder = useSceneStore((state) => state.disorder);
  const tidying = useSceneStore((state) => state.tidying);
  const heldTurned = useSceneStore((state) => state.heldTurned);
  const settings = useSceneStore((state) => state.settings);

  return (
    <div
      id="hud"
      className={className}
      data-ready={ready ? 'true' : 'false'}
      data-phase={phase}
      data-mood={initialized ? mood : undefined}
      data-presented={presented ?? ''}
      data-auto={autoOn ? 'true' : 'false'}
      data-reduced={settings.reducedMotion ? 'true' : 'false'}
      data-frozen={settings.frozen ? 'true' : 'false'}
      data-flipped={presented && flipped ? 'true' : 'false'}
      data-dragging={dragging ?? ''}
      data-sound={soundOn ? 'on' : 'off'}
      data-places={formatPlaces(places)}
      data-offscreen={offscreen.join(' ')}
      data-physics={physics}
      data-fallen={fallen.join(' ')}
      data-disorder={disorder.toFixed(2)}
      data-tidying={tidying ? 'true' : 'false'}
      data-turned={presented && heldTurned ? 'true' : 'false'}
      inert={loading}
    >
      {children}
    </div>
  );
}
