'use client';

import { useEffect, useRef } from 'react';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import styles from './Desk.module.css';
import own from './UprightButton.module.css';

/** La touche du clavier qui remet l'objet présenté droit (Sheet). */
export const UPRIGHT_KEY = 'Home';

// Partie A de l'étape 6 : le bouton « Remettre droit » de la fiche, visible
// quand le visiteur a tourné l'objet présenté (store.heldTurned). Il appelle
// requestUpright() : HeldRotation ramène l'objet à sa pose de présentation
// (animé, immédiat en mouvement réduit). La touche Début fait de même.
//
// Le bouton disparaît quand l'objet est remis droit : s'il avait le focus,
// celui-ci passe au bouton d'avant (Retourner) au lieu de se perdre.
export function UprightButton({ label }: { label: string }) {
  const store = useSceneStoreApi();
  const turned = useSceneStore((state) => state.presented !== null && state.heldTurned);
  const ref = useRef<HTMLButtonElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (turned || !focused.current) return;
    focused.current = false;
    const previous = ref.current?.previousElementSibling;
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  }, [turned]);

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.sheetFlip} ${own.upright}`}
      data-upright=""
      hidden={!turned}
      aria-keyshortcuts={UPRIGHT_KEY}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={(event) => {
        if (event.relatedTarget !== null) focused.current = false;
      }}
      onClick={() => store.getState().requestUpright()}
    >
      {label}
    </button>
  );
}
