'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BODY_IDS, isItemId, type BodyId } from '../core/ids';
import type { SceneState } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import { gestureHub } from '../gestures/hub';
import { TIDY_PRIORITY } from '../gestures/priorities';
import { TidyDirector, type TidyContext } from './director';
import { disorderScore } from './disorder';

// Le désordre du bureau, le retour en douceur d'un
// corps tombé, et le rangement demandé par le bouton du HUD (TidyButton).
// La logique est dans TidyDirector (director.ts, testé en Node avec le vrai
// moteur) ; ce composant le branche sur la scène :
//
// - à chaque image, avant le pas du monde (TIDY_PRIORITY), il fait avancer
//   les trajets (drive) et les corps tombés qui attendent ;
// - il répond à tidyRequests (requestTidy) et tient tidying à jour ;
// - quand le bureau se pose (places ou fallen changent), il recalcule le
//   score de désordre (setDisorder) ;
// - ?desordre : tout le bureau lancé en l'air dès que le moteur est prêt.
//
// Rejouer et le changement de format remettent tout à zéro (le moteur range
// déjà ses corps de son côté).

/** L'objet est-il sorti du monde (présenté, ou en route) ? Comme PhysicsLayer. */
function outOfWorld(scene: SceneState, id: BodyId, progress: Map<string, number>): boolean {
  return isItemId(id) && (scene.presented === id || (progress.get(id) ?? 0) > 0.02);
}

export function Tidy() {
  const store = useSceneStoreApi();
  const director = useMemo(() => new TidyDirector(), []);
  const replays = useSceneStore((state) => state.replays);
  // Les demandes déjà servies (le compteur du store ne fait que monter).
  const served = useRef(store.getState().tidyRequests);
  const portrait = useRef<boolean | null>(null);
  const scattered = useRef(false);
  /** ?desordre : les places restent à recopier quand le bureau dispersé se sera posé. */
  const scatterPending = useRef(false);

  // Rejouer : le store remet tout en place, on oublie les trajets en cours.
  useEffect(() => {
    director.reset();
    served.current = store.getState().tidyRequests;
  }, [replays, director, store]);

  // Le bureau se pose (ou un corps rentre) : le score de désordre suit.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.places === previous.places && state.fallen === previous.fallen) return;
        state.setDisorder(disorderScore(state.desk, state.frame.portrait));
      }),
    [store],
  );

  useEffect(() => () => director.reset(), [director]);

  useFrame(() => {
    const scene = store.getState();
    const hub = gestureHub(store);
    const physics = hub.physics;
    if (!physics) return;
    const { frame, settings, desk } = scene;

    // Changement de format : le moteur a tout rangé ; les trajets n'ont plus de sens.
    if (portrait.current !== physics.portrait) {
      if (portrait.current !== null) director.reset();
      portrait.current = physics.portrait;
    }

    const ctx: TidyContext = {
      physics,
      desk,
      portrait: physics.portrait,
      isOut: (id) => outOfWorld(scene, id, hub.progress),
      instant: settings.reducedMotion,
      frozen: settings.frozen,
    };

    if (settings.scatter && !scattered.current && scene.initialized) {
      scattered.current = true;
      scatterPending.current = true;
      director.scatter(ctx);
    }
    // Sous &fige, le monde se pose d'un coup dans la même image que le lâcher
    // et ne signale pas toujours qu'il s'est posé : on recopie les places ici.
    if (
      scatterPending.current &&
      !director.scattering &&
      !BODY_IDS.some((id) => physics.isAwake(id))
    ) {
      scatterPending.current = false;
      scene.commitPlaces();
    }

    let changed = false;
    let finished = false;
    if (scene.tidyRequests !== served.current) {
      served.current = scene.tidyRequests;
      scene.setTidying(true);
      const report = director.tidy(ctx);
      changed = report.changed;
      finished = report.finished;
    }
    const report = director.update(ctx, frame.dt);
    changed ||= report.changed;
    finished ||= report.finished;

    if (changed) scene.commitPlaces();
    // Fini : tidying repasse à faux (le bouton annonce « Bureau rangé. »).
    if (finished || (store.getState().tidying && !director.tidying)) scene.setTidying(false);
  }, TIDY_PRIORITY);

  return null;
}
