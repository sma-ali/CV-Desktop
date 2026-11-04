'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import { currentLoadStep, introProgress } from '@/scene/core/loading';
import { useSceneStore } from '@/scene/core/store-context';
import styles from './Intro.module.css';

/** Vrai une fois la page hydratée (faux dans le HTML du serveur, sans écart à l'hydratation). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

// L'écran de chargement, revu le 04/11 : une barre façon jeu vidéo. Rendu
// par le serveur dès le premier octet (CSS seulement : rien ne dépend de
// JavaScript pour l'afficher), il cache tout le bureau tant que la scène se
// prépare : un écran noir, « Ali Smaani », et dessous une barre encadrée
// dont les blocs dorés se remplissent au rythme du chargement réel
// (store.load, core/loading.ts), avec le pourcentage et l'étape en cours.
// Quand la scène est prête (done), la barre se remplit, l'écran s'efface en
// fondu, et l'arrivée commence : les objets tombent un à un dans la
// pénombre (core/drop.ts), puis la lampe s'allume en dernier. Mouvement
// réduit : un simple fondu. Sans JavaScript, la feuille de style le cache
// (la version express s'affiche) ; si JavaScript ne démarre jamais, il
// s'efface de lui-même (Intro.module.css). Un lien discret mène à la
// version express pendant l'attente.
export function Intro({
  name,
  texts,
  expressHref,
  state,
}: {
  name: string;
  texts: DeskHudTexts['intro'];
  /** La version express de la langue de la page. */
  expressHref: string;
  /**
   * loading : la scène se prépare ; ready : elle a dessiné, l'écran s'efface
   * en fondu ; fallback : la version express s'affiche, l'écran disparaît
   * sans attendre.
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

  return (
    <div
      className={styles.intro}
      data-js={hydrated ? 'true' : undefined}
      data-done={done ? 'true' : undefined}
      data-state={hydrated ? state : undefined}
      style={{ '--p': shown } as CSSProperties}
      aria-hidden={done ? 'true' : undefined}
    >
      <div className={styles.center}>
        <p className={styles.name}>{name}</p>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label={texts.preparing}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${label} | ${percent} %`}
        >
          <i className={styles.fill} aria-hidden="true" />
        </div>
        <p className={styles.status} aria-hidden="true">
          <span className={styles.step}>{hydrated ? label : texts.preparing}</span>
          <span className={styles.percent}>{percent}&nbsp;%</span>
        </p>
      </div>
      <a className={styles.skip} href={expressHref} tabIndex={done ? -1 : undefined}>
        {texts.skip}
      </a>
    </div>
  );
}
