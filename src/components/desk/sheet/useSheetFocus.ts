'use client';

import { useEffect, useRef, type FocusEvent } from 'react';
import { ITEM_STEP, type ItemId } from '@/scene/core/ids';
import type { PresentSource } from '@/scene/core/store';

/**
 * Le visiteur se sert-il du clavier ? La dernière action (touche ou
 * pointeur) le dit : la fiche ouverte au clavier prend le focus, ouverte à
 * la souris ou au doigt, elle le laisse où il est.
 */
function useKeyboardModality() {
  const keyboard = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboard.current = true;
    };
    const onPointer = () => {
      keyboard.current = false;
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);
  return keyboard;
}

/**
 * Le focus et les annonces de la fiche, à l'ouverture, au changement
 * d'objet et à la fermeture. Ouverte au clavier, la fiche prend le focus
 * (sur son titre) et le rend à l'élément d'où il venait quand elle se
 * ferme (ou à la puce de l'objet). Ouverte par la visite automatique ou au
 * pointeur, elle ne le prend pas ; ouverte depuis la scène, elle s'annonce
 * (une puce s'annonce elle-même).
 */
export function useSheetFocus({
  presented,
  presentedBy,
  announcement,
  onAnnounce,
}: {
  presented: ItemId | null;
  presentedBy: PresentSource | null;
  /** Ce que la fiche annonce à son ouverture (null : pas de fiche). */
  announcement: string | null;
  onAnnounce: (text: string) => void;
}) {
  const keyboard = useKeyboardModality();
  const sheetRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** L'élément qui avait le focus avant que la fiche ne le prenne. */
  const returnFocus = useRef<HTMLElement | null>(null);
  /** Le focus est-il (ou était-il, avant de disparaître avec un bouton) dans la fiche ? */
  const focusInside = useRef(false);
  const previous = useRef<ItemId | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = presented;
    if (before === presented) return;
    const byVisitor = presentedBy !== null && presentedBy !== 'auto';

    if (presented && announcement !== null) {
      const active = document.activeElement;
      const inside = active instanceof Node && !!sheetRef.current?.contains(active);
      if (byVisitor && keyboard.current && !inside) {
        // Ouverte au clavier depuis le HUD ou la scène : le focus vient sur le titre.
        if (active instanceof HTMLElement && active !== document.body) {
          returnFocus.current = active;
        }
        titleRef.current?.focus({ preventScroll: true });
        focusInside.current = true;
      } else if (byVisitor && presentedBy !== 'chip') {
        onAnnounce(announcement);
      }
      return;
    }

    // Fermée : le focus revient d'où il venait, s'il était dans la fiche.
    const active = document.activeElement;
    if (focusInside.current && (active === null || active === document.body)) {
      const back = returnFocus.current;
      const step = before ? ITEM_STEP[before] : null;
      const chip = step ? document.querySelector<HTMLElement>(`[data-step="${step}"]`) : null;
      const target = back?.isConnected ? back : chip;
      target?.focus({ preventScroll: true });
    }
    returnFocus.current = null;
    focusInside.current = false;
  }, [presented, presentedBy, announcement, keyboard, onAnnounce]);

  const onFocus = () => {
    focusInside.current = true;
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    // Le bouton qui disparaît avec la fiche ne compte pas comme une sortie.
    if (next !== null) focusInside.current = false;
  };

  return { sheetRef, titleRef, onFocus, onBlur };
}
