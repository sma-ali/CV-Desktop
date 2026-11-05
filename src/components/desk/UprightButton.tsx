'use client';

import { useEffect, useRef } from 'react';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import styles from './Desk.module.css';

/** La touche du clavier qui remet l'objet présenté droit (Sheet). */
export const UPRIGHT_KEY = 'Home';

// Partie A de l'étape 6 : le bouton « Remettre droit » de la fiche, présent
// seulement quand le visiteur a tourné l'objet présenté (store.heldTurned).
// Il appelle requestUpright() : HeldRotation ramène l'objet à sa pose de
// présentation (animé, immédiat en mouvement réduit). La touche Début fait
// de même.
//
// Le bouton disparaît quand l'objet est remis droit : s'il avait le focus,
// celui-ci passe au titre de la fiche au lieu de se perdre.
export function UprightButton({ label }: { label: string }) {
  const store = useSceneStoreApi();
  const turned = useSceneStore((state) => state.presented !== null && state.heldTurned);
  /** Le bouton d'avant, noté quand celui-ci prend le focus (null : il ne l'a pas). */
  const fallback = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (turned) return;
    const target = fallback.current;
    fallback.current = null;
    const active = document.activeElement;
    if (target?.isConnected && (active === null || active === document.body)) {
      target.focus({ preventScroll: true });
    }
  }, [turned]);

  if (!turned) return null;
  return (
    <button
      type="button"
      className={styles.sheetFlip}
      data-upright=""
      aria-keyshortcuts={UPRIGHT_KEY}
      onFocus={(event) => {
        // Le titre de la fiche (focusable par script) : il n'y a plus de
        // bouton « Retourner » juste avant.
        fallback.current =
          event.currentTarget.closest('aside')?.querySelector<HTMLElement>('h2') ?? null;
      }}
      onBlur={(event) => {
        if (event.relatedTarget !== null) fallback.current = null;
      }}
      onClick={() => store.getState().requestUpright()}
    >
      {label}
    </button>
  );
}
