'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import { introProgress } from '@/scene/core/loading';
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

// Étape 6, partie C, revue le 04/11 : l'écran de chargement. Rendu par le
// serveur dès le premier octet (CSS seulement : rien ne dépend de
// JavaScript pour l'afficher), il cache tout le bureau tant que la scène se
// prépare : un écran noir, « Ali Smaani », et dessous un trait fin qui se
// trace au rythme du chargement réel (store.load, core/loading.ts). Quand la
// scène est prête (done), le trait se termine, l'écran s'efface en fondu,
// et l'arrivée commence : les objets tombent un à un dans la pénombre
// (core/drop.ts), puis la lampe s'allume en dernier. Mouvement réduit : un
// simple fondu. Sans JavaScript, la feuille de style le cache (la version
// express s'affiche) ; si JavaScript ne démarre jamais, il s'efface de
// lui-même (Intro.module.css). Un lien mène à la version express pendant
// l'attente.
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
  const shown = done ? 1 : progress;

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
          className={styles.track}
          role="progressbar"
          aria-label={texts.preparing}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown * 100)}
        >
          <i className={styles.line} aria-hidden="true" />
        </div>
      </div>
      <a className={styles.skip} href={expressHref} tabIndex={done ? -1 : undefined}>
        {texts.skip}
      </a>
    </div>
  );
}
