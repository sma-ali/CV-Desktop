'use client';

import Link from 'next/link';
import { useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import type { DeskHudTexts, DeskStep } from '@/lib/desk';
import { MOOD_SWATCHES } from '@/scene/core/constants';
import { ITEM_STEP, MOOD_IDS, type MoodId } from '@/scene/core/ids';
import { formatVisitorTime, moodOfHour, visitorNow } from '@/scene/core/mood';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import styles from './Desk.module.css';

/** L'heure du visiteur à la minute près (null avant l'hydratation : le serveur ne la connaît pas). */
function useVisitorMinute(offsetMs: number): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, 15_000);
      return () => window.clearInterval(timer);
    },
    () => Math.floor((Date.now() + offsetMs) / 60_000),
    () => null,
  );
}

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

// Le HUD du bureau, d'après le prototype : identité, commandes, puces du CV,
// heure du visiteur et ambiances, carton d'arrivée, indication. Rendu par le
// serveur, visible avant la 3D. Expose l'état de la scène aux tests par des
// attributs data-* (phase, ambiance, objet présenté, mode auto...).
export function Hud({ texts, loading }: { texts: DeskHudTexts; loading: boolean }) {
  const store = useSceneStoreApi();
  const coarse = useCoarsePointer();
  const initialized = useSceneStore((state) => state.initialized);
  const ready = useSceneStore((state) => state.ready);
  const phase = useSceneStore((state) => state.phase);
  const hud = useSceneStore((state) => state.hud);
  const mood = useSceneStore((state) => state.mood);
  const moodPinned = useSceneStore((state) => state.moodPinned);
  const autoOn = useSceneStore((state) => state.autoOn);
  const presented = useSceneStore((state) => state.presented);
  const settings = useSceneStore((state) => state.settings);
  const minute = useVisitorMinute(settings.hourOffsetMs);

  const presentedStep = presented ? ITEM_STEP[presented] : null;
  // Avant la première image de la scène, tout le HUD est visible. Ensuite,
  // l'identité et les puces suivent l'arrivée.
  const brandHidden = ready && !hud.brand ? 'true' : undefined;
  const chipsHidden = ready && !hud.chips ? 'true' : undefined;
  const showHint = ready && hud.hint && (!presented || autoOn);
  const hint = autoOn ? texts.hint.auto : coarse ? texts.hint.touch : texts.hint.pointer;

  const onStep = (event: MouseEvent<HTMLAnchorElement>, step: DeskStep) => {
    const state = store.getState();
    // Sans la scène, la puce reste un lien vers la version express.
    if (!state.ready) return;
    event.preventDefault();
    if (state.presented === step.item) {
      state.markUser();
      state.putBack();
    } else {
      state.present(step.item, 'chip');
    }
  };

  const onMood = (next: MoodId) => {
    const state = store.getState();
    const hourMood = moodOfHour(visitorNow(state.settings.hourOffsetMs).getHours());
    state.markUser();
    state.setMood(next, next !== hourMood);
  };

  const [before, after] = texts.clock.visitorTime.split('{time}');
  const time = minute === null ? null : formatVisitorTime(new Date(minute * 60_000), texts.locale);

  return (
    <div
      id="hud"
      className={styles.hud}
      data-ready={ready ? 'true' : 'false'}
      data-phase={phase}
      data-mood={initialized ? mood : undefined}
      data-presented={presented ?? ''}
      data-auto={autoOn ? 'true' : 'false'}
      data-reduced={settings.reducedMotion ? 'true' : 'false'}
      data-frozen={settings.frozen ? 'true' : 'false'}
    >
      <p className={styles.carton} data-on={hud.carton ? 'true' : undefined} aria-hidden="true">
        <span className={styles.cartonKicker}>{texts.arrivalKicker}</span>
        <span className={styles.cartonName}>{texts.firstName}</span>
        <span className={styles.cartonRole}>{texts.headline}</span>
      </p>

      <header className={styles.top}>
        <div className={styles.brand} data-arrival-hidden={brandHidden}>
          <h1 className={styles.name}>{texts.name}</h1>
          <p className={styles.role}>{texts.headline}</p>
          <p className={styles.status}>
            <i className={styles.pulse} aria-hidden="true" />
            <span>{texts.availability}</span>
            <span className={styles.separator} aria-hidden="true">
              |
            </span>
            <span>{texts.location}</span>
          </p>
        </div>
        <nav className={styles.controls} aria-label={texts.controlsLabel}>
          <Link href={texts.express.href} className={`${styles.button} ${styles.buttonGold}`}>
            {texts.express.label}
          </Link>
          <Link
            href={texts.language.href}
            hrefLang={texts.language.locale}
            lang={texts.language.locale}
            className={styles.button}
          >
            {texts.language.label}
          </Link>
          {ready && !settings.reducedMotion ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => store.getState().replay(performance.now() / 1000)}
            >
              {texts.replay}
            </button>
          ) : null}
        </nav>
      </header>

      {loading ? (
        <p className={styles.loading} role="status">
          {texts.loading}
        </p>
      ) : null}

      <p
        className={styles.hint}
        data-on={showHint ? 'true' : undefined}
        data-auto={autoOn ? 'true' : undefined}
      >
        <i aria-hidden="true" />
        <span>{hint}</span>
      </p>

      <footer className={styles.bottom} data-arrival-hidden={chipsHidden}>
        <nav aria-label={texts.glance}>
          <ul className={styles.steps}>
            {texts.steps.map((step) => (
              <li key={step.id}>
                <a
                  href={step.href}
                  className={styles.chip}
                  data-step={step.id}
                  data-contact={step.contact ? 'true' : undefined}
                  data-on={presentedStep === step.id ? 'true' : undefined}
                  onClick={(event) => onStep(event, step)}
                >
                  <span className={styles.chipTitle}>
                    {step.title}
                    {step.live ? <i className={styles.live} aria-hidden="true" /> : null}
                  </span>
                  <span className={styles.chipDetail}>{step.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.corner}>
          <p className={styles.clock} aria-live="polite">
            {initialized && time !== null ? (
              moodPinned ? (
                <>
                  {texts.clock.pinned} <em>{texts.moods[mood].light}</em>
                </>
              ) : (
                <>
                  {before}
                  <b>{time}</b>
                  {after} <em>{texts.moods[mood].light}</em>
                </>
              )
            ) : null}
          </p>
          <div className={styles.moods} role="group" aria-label={texts.moodsLabel}>
            {MOOD_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.mood}
                aria-label={texts.moods[id].name}
                title={texts.moods[id].name}
                aria-pressed={initialized && mood === id}
                style={{ '--swatch': MOOD_SWATCHES[id] } as CSSProperties}
                onClick={() => onMood(id)}
              >
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
