'use client';

import { useSyncExternalStore } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import { useSceneStore } from '@/scene/core/store-context';
import styles from './Hud.module.css';

/** Le visiteur pointe-t-il avec le doigt ? */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
}

// L'indication : la visite en cours, l'objet tenu (comment le tourner, le
// retourner, le reposer), ou comment prendre et glisser un objet. Au doigt,
// ses variantes tactiles. Elle paraît quand l'arrivée la montre (hud.hint).
// Dans le footer : sous 1300 px, elle se pose juste au-dessus des puces.
export function Hint({ texts }: { texts: DeskHudTexts['hint'] }) {
  const coarse = useCoarsePointer();
  const ready = useSceneStore((state) => state.ready);
  const shown = useSceneStore((state) => state.hud.hint);
  const autoOn = useSceneStore((state) => state.autoOn);
  const presented = useSceneStore((state) => state.presented);
  const dragging = useSceneStore((state) => state.dragging);

  const held = presented !== null && !autoOn && !dragging;
  const hint = autoOn
    ? texts.auto
    : held
      ? coarse
        ? texts.held.touch
        : texts.held.pointer
      : coarse
        ? texts.touch
        : texts.pointer;
  // Une phrase par ligne sur téléphone : l'indication n'y est plus coupée.
  const sentences = hint.split(/(?<=[.!?])\s+/);

  return (
    <p
      className={styles.hint}
      data-on={ready && shown ? 'true' : undefined}
      data-auto={autoOn ? 'true' : undefined}
      data-held={held ? 'true' : undefined}
    >
      <i aria-hidden="true" />
      <span>
        {sentences.map((sentence, index) => (
          <span key={index} className={styles.hintLine}>
            {sentence}
            {index < sentences.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </p>
  );
}
