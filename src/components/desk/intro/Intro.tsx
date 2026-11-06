'use client';

import { useEffect, useRef } from 'react';
import { useHydrated } from '@/components/hooks/useHydrated';
import type { DeskHudTexts } from '@/lib/desk';
import { currentLoadStep, introProgress } from '@/scene/core/loading';
import { useSceneStore } from '@/scene/core/store-context';
import { createDevScene, INTRO_FIRST_FRAME, INTRO_VIEWBOX } from './introArt';
import styles from './Intro.module.css';

/** Après le « ting », le temps de dessiner encore pendant le fondu (ms). */
const DRAW_AFTER_DONE_MS = 2000;

const noop = () => undefined;

// L'écran de chargement, revu le 05/11 : Ali derrière son ordinateur, qui
// tape (introArt.ts). La barre sous l'ordinateur suit le chargement réel
// (store.load, core/loading.ts), lissée à l'œil ; aria-valuenow garde la
// valeur exacte. Rendu par le serveur dès le premier octet (la première
// image du dessin est dans le HTML), il cache tout le bureau tant que la
// scène se prépare. Quand elle est prête, ses verres s'allument, « ting ! »,
// puis l'écran s'efface en fondu et l'arrivée commence (ClockDriver attend
// le « ting » avant de lancer l'horloge). Mouvement réduit : un dessin
// immobile dont seule la barre avance, et un simple fondu. Sans JavaScript,
// la feuille de style le cache (la version express s'affiche) ; si
// JavaScript ne démarre jamais, il s'efface de lui-même (Intro.module.css).
export function Intro({
  name,
  texts,
  state,
}: {
  name: string;
  texts: DeskHudTexts['intro'];
  /**
   * loading : la scène se prépare ; ready : elle a dessiné, « ting », puis
   * l'écran s'efface ; fallback : la version express s'affiche, l'écran
   * disparaît sans attendre.
   */
  state: 'loading' | 'ready' | 'fallback';
}) {
  const hydrated = useHydrated();
  const done = state !== 'loading';
  const progress = useSceneStore((state) => introProgress(state.load, state.ready));
  const step = useSceneStore((state) => currentLoadStep(state.load, state.ready));
  const shown = done ? 1 : progress;
  const percent = Math.round(shown * 100);
  const label = done || step === null ? texts.done : texts.steps[step];

  const art = useRef<SVGSVGElement>(null);
  const target = useRef(shown);
  const phase = useRef(state);
  /** Relance la boucle de dessin si elle s'est arrêtée (mouvement réduit). */
  const wake = useRef<() => void>(noop);
  useEffect(() => {
    target.current = shown;
    phase.current = state;
    wake.current();
  }, [shown, state]);

  useEffect(() => {
    const svg = art.current;
    if (!svg) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = createDevScene('intro', { still });
    // Le SVG du serveur porte déjà la première image.
    let markup = INTRO_FIRST_FRAME;
    let value = 0;
    let last = performance.now();
    let frame = 0;
    let scheduled = false;
    let doneAt: number | null = null;
    const draw = (now: number) => {
      scheduled = false;
      // La version express a pris la place : plus rien à dessiner.
      if (phase.current === 'fallback') return;
      const goal = target.current;
      // La barre rattrape le chargement réel en douceur, sans jamais reculer.
      value = still
        ? goal
        : Math.min(goal, value + (goal - value) * Math.min(1, (now - last) / 160));
      if (goal - value < 0.004) value = goal;
      last = now;
      // Le SVG n'est réécrit (et relu par le navigateur) que si le dessin change.
      const next = render(value, now);
      const changed = next !== markup;
      if (changed) {
        svg.innerHTML = next;
        markup = next;
      }
      if (value >= 1 && doneAt === null) doneAt = now;
      if (doneAt !== null && now - doneAt > DRAW_AFTER_DONE_MS) return;
      // Mouvement réduit : rien ne bouge de soi-même. La boucle s'arrête
      // quand le dessin a rattrapé la barre, et repart quand elle avance.
      if (still && !changed && value === goal) return;
      schedule();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      frame = requestAnimationFrame(draw);
    };
    wake.current = schedule;
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      wake.current = noop;
    };
  }, []);

  return (
    <div
      className={styles.intro}
      data-js={hydrated ? 'true' : undefined}
      data-done={done ? 'true' : undefined}
      data-state={hydrated ? state : undefined}
      aria-hidden={done ? 'true' : undefined}
    >
      <div className={styles.center}>
        <p className={styles.name}>{name}</p>
        <div
          className={styles.stage}
          role="progressbar"
          aria-label={texts.preparing}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${label} | ${percent} %`}
        >
          <svg
            ref={art}
            className={styles.art}
            viewBox={INTRO_VIEWBOX}
            aria-hidden="true"
            focusable="false"
            dangerouslySetInnerHTML={{ __html: INTRO_FIRST_FRAME }}
          />
        </div>
      </div>
    </div>
  );
}
