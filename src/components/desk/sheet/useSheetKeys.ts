'use client';

import { useEffect } from 'react';
import { neighborItem, type ItemId } from '@/scene/core/ids';
import { useSceneStoreApi } from '@/scene/core/store-context';
import { rotateKey, rotationInput } from '@/scene/rotation/control';
import { UPRIGHT_KEY } from './UprightButton';

/** Une touche tapée dans un champ ne pilote pas la fiche. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Le clavier tant que la fiche est ouverte : Page précédente et Page
 * suivante passent à l'objet voisin ; les flèches tournent l'objet
 * présenté, Début le remet droit, la touche de retournement (R) le
 * retourne. L'écran ne se tourne ni ne se retourne. Échap, qui repose
 * l'objet, est dans DeskShell.
 */
export function useSheetKeys(presented: ItemId | null, flipKey: string) {
  const store = useSceneStoreApi();

  useEffect(() => {
    if (!presented) return;
    const flip = flipKey.toLowerCase();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(event.target)) return;
      const state = store.getState();
      if (!state.presented) return;

      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault();
        state.present(neighborItem(state.presented, event.key === 'PageDown' ? 1 : -1), 'sheet');
        return;
      }
      if (state.presented === 'monitor') return;

      // La visite qui tenait l'objet le laisse au visiteur.
      const takeOver = () => {
        if (state.presentedBy === 'auto') store.setState({ presentedBy: 'keyboard' });
      };
      const rotate = rotateKey(event.key);
      if (rotate) {
        event.preventDefault();
        takeOver();
        state.markUser();
        rotationInput(store).nudge(rotate[0], rotate[1]);
      } else if (event.key === UPRIGHT_KEY) {
        event.preventDefault();
        takeOver();
        state.requestUpright();
      } else if (event.key.toLowerCase() === flip && !event.repeat) {
        event.preventDefault();
        state.toggleFlip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presented, store, flipKey]);
}
