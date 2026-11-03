'use client';

import { useEffect, useRef, useState, type FocusEvent } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import type { SceneState } from '@/scene/core/store';
import { useSceneStoreApi } from '@/scene/core/store-context';
import { offerShown } from '@/scene/tidy/disorder';
import styles from './TidyButton.module.css';

// Partie B de l'étape 6 : le bouton « Oulala, vous avez tout cassé. Je
// range pour vous ? ». Il apparaît quand le score de désordre
// (store.disorder) passe DISORDER.offer, et disparaît sous
// DISORDER.withdraw. Au clic (ou Entrée, Espace : c'est un vrai bouton,
// dans l'ordre du clavier) : requestTidy(). Pendant le rangement, il dit
// « Je range le bureau. » sans réagir ; à la fin, « Bureau rangé. » un
// instant, puis il s'en va. Chaque étape s'annonce aux lecteurs d'écran
// (région role="status"). S'il avait le focus en partant, le focus revient
// d'où il venait (ou sur la première puce du CV), jamais dans le vide.

type Phase = 'hidden' | 'offer' | 'tidying' | 'done';

/** Combien de temps « Bureau rangé. » reste affiché (ms). */
const DONE_SHOWN = 2200;

/** Le bouton peut-il se proposer ? La scène tourne et le moteur est prêt. */
const offerable = (state: SceneState) => state.ready && state.physics === 'ready';

export function TidyButton({ texts }: { texts: DeskHudTexts['tidy'] }) {
  const store = useSceneStoreApi();
  const [phase, setPhaseState] = useState<Phase>('hidden');
  /** La phase courante, lue par l'abonnement au store. */
  const phaseRef = useRef<Phase>('hidden');
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** L'élément qui avait le focus avant le bouton. */
  const returnTo = useRef<HTMLElement | null>(null);
  /** Le bouton avait-il le focus (au moment où il disparaît) ? */
  const focused = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    const setPhase = (next: Phase) => {
      phaseRef.current = next;
      setPhaseState(next);
    };
    const idle = (state: SceneState, shown: boolean): Phase =>
      offerable(state) && offerShown(state.disorder, shown) ? 'offer' : 'hidden';

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.tidying && !previous.tidying) {
        window.clearTimeout(timer);
        setPhase('tidying');
        setAnnouncement(texts.tidying);
        return;
      }
      if (!state.tidying && previous.tidying) {
        setPhase('done');
        setAnnouncement(texts.done);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          setPhase(idle(store.getState(), false));
        }, DONE_SHOWN);
        return;
      }
      if (
        state.disorder === previous.disorder &&
        state.physics === previous.physics &&
        state.ready === previous.ready
      ) {
        return;
      }
      const current = phaseRef.current;
      if (current === 'tidying' || current === 'done') return;
      const next = idle(state, current === 'offer');
      if (next === current) return;
      if (next === 'offer') setAnnouncement(texts.offer);
      setPhase(next);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [store, texts]);

  // Le bouton s'en va : le focus qu'il avait revient d'où il venait.
  useEffect(() => {
    if (phase !== 'hidden' || !focused.current) return;
    focused.current = false;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const target =
      returnTo.current?.isConnected === true
        ? returnTo.current
        : document.querySelector<HTMLElement>('#hud [data-step]');
    target?.focus({ preventScroll: true });
  }, [phase]);

  const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
    focused.current = true;
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && from !== buttonRef.current) returnTo.current = from;
  };

  const label = phase === 'tidying' ? texts.tidying : phase === 'done' ? texts.done : texts.offer;

  return (
    <>
      {phase !== 'hidden' ? (
        <button
          ref={buttonRef}
          type="button"
          className={styles.tidy}
          data-tidy={phase}
          aria-disabled={phase !== 'offer' ? 'true' : undefined}
          onFocus={onFocus}
          onBlur={() => {
            // Encore là : le visiteur est parti ailleurs. Disparu : le focus est perdu.
            if (buttonRef.current?.isConnected) focused.current = false;
          }}
          onClick={() => {
            if (phase === 'offer') store.getState().requestTidy();
          }}
        >
          <i className={styles.icon} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ) : null}
      <p className="visually-hidden" role="status" data-tidy-status="">
        {announcement}
      </p>
    </>
  );
}
