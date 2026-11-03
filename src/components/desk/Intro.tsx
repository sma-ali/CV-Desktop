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

// Le filament de l'ampoule : une spirale tendue entre deux supports, dans le
// repère de l'ampoule (viewBox 0 0 120 150). Une seule forme, dessinée deux
// fois : froide dessous, chaude dessus, découverte de gauche à droite.
const FILAMENT =
  'M38 70 q3 -9 6 0 q3 9 6 0 q3 -9 6 0 q3 9 6 0 q3 -9 6 0 q3 9 6 0 q3 -9 6 0 q3 9 6 0';

function Filament({ className }: { className: string | undefined }) {
  return (
    <svg className={className} viewBox="30 58 60 24" aria-hidden="true" focusable="false">
      <path d={FILAMENT} />
    </svg>
  );
}

// Étape 6, partie C : l'écran de chargement. Rendu par le serveur dès le
// premier octet (CSS seulement : rien ne dépend de JavaScript pour
// l'afficher), il cache tout le bureau tant que la scène se prépare : fond
// sombre, une ampoule dont le filament chauffe de gauche à droite au rythme
// du chargement réel (store.load, core/loading.ts), « Ali Smaani » et
// « Préparation du bureau ». Quand la scène est prête (done), le filament
// s'embrase, l'écran s'efface en fondu, et l'arrivée commence dans le noir
// jusqu'à ce que la lampe du bureau s'allume. Mouvement réduit : un simple
// fondu. Sans JavaScript, la feuille de style le cache (la version express
// s'affiche) ; si JavaScript ne démarre jamais, il s'efface de lui-même
// (Intro.module.css). Un lien mène à la version express pendant l'attente.
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
        <div
          className={styles.bulb}
          role="progressbar"
          aria-label={texts.preparing}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown * 100)}
        >
          <i className={styles.breath} aria-hidden="true">
            <i className={styles.glow} />
          </i>
          <svg className={styles.glass} viewBox="0 0 120 150" aria-hidden="true" focusable="false">
            {/* Le verre, le culot et les deux supports du filament. */}
            <path d="M60 18 C34 18 20 37 20 60 C20 77 30 87 38 96 C43 102 44 108 44 114 L76 114 C76 108 77 102 82 96 C90 87 100 77 100 60 C100 37 86 18 60 18 Z" />
            <path d="M46 121 L74 121 M47 128 L73 128 M51 135 L69 135" />
            <path className={styles.wire} d="M38 70 L52 112 M86 70 L68 112" />
          </svg>
          <div className={styles.filament}>
            <div className={styles.ember}>
              <Filament className={styles.cold} />
            </div>
            <div className={styles.heat}>
              <div className={styles.heatInner}>
                <Filament className={styles.hot} />
              </div>
            </div>
          </div>
        </div>
        <p className={styles.name}>{name}</p>
        <p className={styles.preparing}>{texts.preparing}</p>
      </div>
      <a className={styles.skip} href={expressHref} tabIndex={done ? -1 : undefined}>
        {texts.skip}
      </a>
    </div>
  );
}
