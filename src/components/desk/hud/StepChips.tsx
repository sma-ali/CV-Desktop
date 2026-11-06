'use client';

import { Fragment, useEffect, useRef, type MouseEvent } from 'react';
import type { DeskHudTexts, DeskStep } from '@/lib/desk';
import { ITEM_STEP } from '@/scene/core/ids';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import styles from './Hud.module.css';

/** Au-delà, une puce touchée pendant le chargement mène à la version express. */
const PENDING_MS = 6000;

// Les puces du CV, en bas de page : une par objet du bureau, plus le CV
// écrit (un vrai lien) à gauche du contact. Chaque puce est un lien vers la
// section de la version express ; avec la scène, elle présente son objet,
// ou le repose s'il était déjà présenté.
export function StepChips({
  texts,
  onAnnounce,
}: {
  texts: DeskHudTexts;
  /** Fait lire un texte par la région d'état du HUD. */
  onAnnounce: (text: string) => void;
}) {
  const store = useSceneStoreApi();
  const ready = useSceneStore((state) => state.ready);
  const presented = useSceneStore((state) => state.presented);
  const presentedStep = presented ? ITEM_STEP[presented] : null;

  // Une puce touchée pendant le chargement : l'objet se présente dès que la
  // scène est prête. Si elle ne l'est pas à temps (pas de WebGL), la puce
  // reste un lien vers la version express.
  const pending = useRef<{ step: DeskStep; timer: number } | null>(null);
  useEffect(() => {
    const waiting = pending.current;
    if (!ready || !waiting) return;
    window.clearTimeout(waiting.timer);
    pending.current = null;
    store.getState().present(waiting.step.item, 'chip');
  }, [ready, store]);
  useEffect(() => () => window.clearTimeout(pending.current?.timer), []);

  const onStep = (event: MouseEvent<HTMLAnchorElement>, step: DeskStep) => {
    const state = store.getState();
    event.preventDefault();
    if (!state.ready) {
      window.clearTimeout(pending.current?.timer);
      const timer = window.setTimeout(() => {
        pending.current = null;
        window.location.assign(step.href);
      }, PENDING_MS);
      pending.current = { step, timer };
      return;
    }
    if (state.presented === step.item) {
      state.markUser();
      state.putBack();
    } else {
      state.present(step.item, 'chip');
      onAnnounce(`${step.title} ${step.detail}. ${texts.hint.presented}`);
    }
  };

  return (
    <nav aria-label={texts.glance}>
      <ul className={styles.steps}>
        {texts.steps.map((step) => (
          <Fragment key={step.id}>
            {step.contact ? (
              <li data-written="">
                <a href={texts.written.href} className={styles.chip} data-written="">
                  <span className={styles.chipTitle}>{texts.written.title}</span>
                  <span className={styles.chipDetail}>{texts.written.detail}</span>
                </a>
              </li>
            ) : null}
            <li>
              <a
                href={step.href}
                className={styles.chip}
                data-step={step.id}
                data-contact={step.contact ? 'true' : undefined}
                data-on={presentedStep === step.id ? 'true' : undefined}
                aria-current={presentedStep === step.id ? 'true' : undefined}
                onClick={(event) => onStep(event, step)}
              >
                <span className={styles.chipTitle}>
                  {step.title}
                  {step.live ? <i className={styles.live} aria-hidden="true" /> : null}
                </span>
                <span className={styles.chipDetail}>{step.detail}</span>
              </a>
            </li>
          </Fragment>
        ))}
      </ul>
    </nav>
  );
}
