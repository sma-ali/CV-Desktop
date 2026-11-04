'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import { rebaseLifeSigns, type LifeSigns } from '@/lib/life-signs';
import { IDLE_BEAT_MS, idleWait, loadTimeout } from '@/scene/core/loading';
import { moodOfHour, hourOffset, visitorNow } from '@/scene/core/mood';
import { parseTestParams } from '@/scene/core/params';
import { createSceneStore, settingsFromParams, type SceneStore } from '@/scene/core/store';
import { SceneStoreProvider } from '@/scene/core/store-context';
import type { SceneTexts } from '@/scene/core/texts';
import { Grain } from './Grain';
import { Hud } from './Hud';
import { Intro } from './Intro';
import { createLifeSignsRefresher } from './lifeSignsRefresh';
import { SceneBoundary } from './SceneBoundary';
import { createWebAudioSound } from './sound';
import styles from './Desk.module.css';

// La scène 3D, dans son propre fichier JavaScript : chargée seulement dans le
// navigateur, après le premier affichage (ni three ni React Three Fiber dans
// le JavaScript initial).
const Scene = dynamic(() => import('@/scene/Scene'), { ssr: false });

/** Le fichier de la scène est arrivé (étape « code » du chargement, core/loading.ts). */
function markCodeLoaded(store: SceneStore) {
  void import('@/scene/Scene').then(
    () => store.getState().setLoad('code', 1),
    () => undefined,
  );
}

/**
 * Pourquoi la page montre la version express à la place du bureau : pas de
 * WebGL, la scène n'a pas pu démarrer, elle a perdu son contexte en route
 * (onglet longtemps en arrière-plan sur un téléphone), ou elle tarde trop à
 * se préparer (LOAD_TIMEOUT_MS, ?attente).
 */
export type FallbackReason = 'no-webgl' | 'crashed' | 'context-lost' | 'timeout';

function isFallback(status: Status): status is FallbackReason {
  return (
    status === 'no-webgl' ||
    status === 'crashed' ||
    status === 'context-lost' ||
    status === 'timeout'
  );
}

type Status = 'idle' | 'loading' | 'ready' | FallbackReason;

/** Le navigateur sait-il créer un contexte WebGL ? Le contexte d'essai est aussitôt rendu. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export interface DeskShellProps {
  hud: DeskHudTexts;
  scene: SceneTexts;
  /** Les signes de vie du coffret, lus par le serveur (le JSON public, ou l'exemple). */
  lifeSigns: LifeSigns | null;
  /** Le repli : la version express, rendue par le serveur. */
  children: ReactNode;
}

// La page du bureau côté navigateur. Le HUD, l'écran de chargement (Intro)
// et le repli sont dans le HTML du serveur ; la scène arrive ensuite, sous
// l'écran de chargement qui s'efface quand elle est prête. Pendant
// l'attente, le HUD caché dessous sort du parcours au clavier (inert). Sans JavaScript, la feuille de style
// montre le repli (@media (scripting: none)) ; sans WebGL, ou si la scène
// plante ou perd son contexte, data-fallback le montre et cache le HUD et le
// canvas : un seul h1 à la fois.
export function DeskShell({ hud, scene, lifeSigns, children }: DeskShellProps) {
  const [store] = useState(() =>
    createSceneStore('afternoon', { sound: createWebAudioSound(), lifeSigns }),
  );
  const [status, setStatus] = useState<Status>('idle');

  // Les données d'exemple se recalent sur l'heure du visiteur (la page est
  // rendue au build) ; le son se ferme avec la page.
  useEffect(() => {
    if (lifeSigns) store.getState().setLifeSigns(rebaseLifeSigns(lifeSigns, Date.now()));
  }, [lifeSigns, store]);
  useEffect(() => () => store.getState().sound.dispose(), [store]);

  // À l'ouverture de la fiche du coffret, des signes de vie de plus de 10
  // minutes sont redemandés à /api/signes-de-vie, sans bloquer la fiche ;
  // en cas d'échec, on garde ce qu'on a. Abonné avant init(), pour voir
  // aussi le coffret présenté dès l'arrivée (?prendre=chest).
  const [refresher] = useState(() =>
    createLifeSignsRefresher(lifeSigns, {
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
    }),
  );
  useEffect(() => {
    const onChest = () => {
      void refresher.refresh().then((fresh) => {
        if (fresh) store.getState().setLifeSigns(rebaseLifeSigns(fresh, Date.now()));
      });
    };
    if (store.getState().presented === 'chest') onChest();
    return store.subscribe((state, previous) => {
      if (state.presented === 'chest' && previous.presented !== 'chest') onChest();
    });
  }, [refresher, store]);

  useEffect(() => {
    const params = parseTestParams(window.location.search);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const offset = hourOffset(params.hour, new Date());
    const hourMood = moodOfHour(visitorNow(offset).getHours());
    const mood = params.mood ?? hourMood;
    store
      .getState()
      .init(settingsFromParams(params, prefersReduced, offset), mood, mood !== hourMood);
    // Le son est ouvert par défaut ; il sonne au premier geste du visiteur.
    store.getState().setSound(true);
    // Le premier rendu côté client doit égaler celui du serveur : le choix
    // entre la scène et le repli se fait juste après.
    const webgl = hasWebGL();
    if (webgl) markCodeLoaded(store);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(webgl ? 'loading' : 'no-webgl');
  }, [store]);

  // La scène tarde trop (réseau très lent, fichier qui n'arrive pas) : la
  // version express prend sa place. Seule compte l'attente onglet visible,
  // page inoccupée (idleWait) : une page qui compile ses shaders avance.
  useEffect(() => {
    if (status !== 'loading') return;
    const limit = loadTimeout(window.location.search);
    if (!Number.isFinite(limit)) return;
    let waited = 0;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      waited = idleWait(waited, now - last, document.hidden);
      last = now;
      if (waited >= limit) {
        window.clearInterval(timer);
        setStatus((current) => (current === 'loading' ? 'timeout' : current));
      }
    }, IDLE_BEAT_MS);
    return () => window.clearInterval(timer);
  }, [status]);

  // Échap repose l'objet présenté.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const state = store.getState();
      if (state.presented) {
        state.markUser();
        state.putBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const onReady = useCallback(() => setStatus('ready'), []);
  const onCrash = useCallback(() => setStatus('crashed'), []);
  const onContextLost = useCallback(() => setStatus('context-lost'), []);

  const fallback = isFallback(status) ? status : null;
  const sceneMounted = status === 'loading' || status === 'ready';
  const reason =
    fallback === 'no-webgl'
      ? hud.fallback.noWebgl
      : fallback === 'crashed'
        ? hud.fallback.crashed
        : fallback === 'context-lost'
          ? hud.fallback.contextLost
          : fallback === 'timeout'
            ? hud.intro.slow
            : hud.fallback.noScript;

  return (
    <SceneStoreProvider store={store}>
      <div className={styles.desk} data-fallback={fallback ?? undefined}>
        <div className={styles.stage} data-visible={status === 'ready' ? 'true' : undefined}>
          {sceneMounted ? (
            <SceneBoundary onError={onCrash}>
              <Scene
                texts={scene}
                className={styles.canvas}
                onReady={onReady}
                onContextLost={onContextLost}
              />
            </SceneBoundary>
          ) : null}
        </div>
        <div className={styles.vignette} aria-hidden="true" />
        <Grain className={styles.grain} />
        <Hud texts={hud} loading={status === 'loading'} />
        <Intro
          name={hud.name}
          texts={hud.intro}
          expressHref={hud.expressHref}
          state={status === 'ready' ? 'ready' : fallback ? 'fallback' : 'loading'}
        />

        <section className={styles.fallback} aria-label={hud.fallback.expressLink}>
          <p className={styles.fallbackNotice}>
            {reason}{' '}
            <a href={hud.expressHref} className={styles.fallbackLink}>
              {hud.fallback.expressLink}
            </a>
          </p>
          <div className={styles.sheet}>{children}</div>
        </section>
      </div>
    </SceneStoreProvider>
  );
}
