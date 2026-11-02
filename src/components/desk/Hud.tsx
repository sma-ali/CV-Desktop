'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import type { DeskHudTexts, DeskStep } from '@/lib/desk';
import { formatPlaces } from '@/scene/core/bodies';
import { MOOD_SWATCHES } from '@/scene/core/constants';
import { ITEM_STEP, MOOD_IDS, type MoodId } from '@/scene/core/ids';
import { formatVisitorTime, moodOfHour, visitorNow } from '@/scene/core/mood';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import { Sheet } from './Sheet';
import { TidyButton } from './TidyButton';
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

// Le HUD du bureau, d'après le prototype : identité, commandes (dont le
// bouton « Son »), puces du CV, heure du visiteur et ambiances, carton
// d'arrivée, indication, fiche de l'objet présenté. Rendu par le serveur,
// visible avant la 3D. Expose l'état de la scène aux tests par des attributs
// data-* (phase, ambiance, objet présenté, mode auto, objet retourné, glisser,
// son, places des objets déplacés, ce qui sort du cadre, et depuis l'étape 6
// le moteur physique, les corps tombés, le désordre, le rangement, l'objet
// tourné).
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
  const flipped = useSceneStore((state) => state.flipped);
  const dragging = useSceneStore((state) => state.dragging);
  const places = useSceneStore((state) => state.places);
  const soundOn = useSceneStore((state) => state.soundOn);
  const offscreen = useSceneStore((state) => state.offscreen);
  const fallen = useSceneStore((state) => state.fallen);
  const physics = useSceneStore((state) => state.physics);
  const disorder = useSceneStore((state) => state.disorder);
  const tidying = useSceneStore((state) => state.tidying);
  const heldTurned = useSceneStore((state) => state.heldTurned);
  const settings = useSceneStore((state) => state.settings);
  const minute = useVisitorMinute(settings.hourOffsetMs);
  // Ce que la région d'état annonce : seulement les gestes du visiteur
  // (objet présenté par une puce, ambiance choisie), jamais l'heure qui passe.
  const [announcement, setAnnouncement] = useState('');

  const presentedStep = presented ? ITEM_STEP[presented] : null;
  // Avant la première image de la scène, tout le HUD est visible. Ensuite,
  // l'identité et les puces suivent l'arrivée.
  const brandHidden = ready && !hud.brand ? 'true' : undefined;
  const chipsHidden = ready && !hud.chips ? 'true' : undefined;
  // L'indication : la visite, l'objet tenu (comment le retourner), ou
  // comment prendre et glisser. Au doigt, ses variantes tactiles.
  const showHint = ready && hud.hint;
  const held = presented !== null && !autoOn && !dragging;
  const hint = autoOn
    ? texts.hint.auto
    : held
      ? coarse
        ? texts.hint.held.touch
        : texts.hint.held.pointer
      : coarse
        ? texts.hint.touch
        : texts.hint.pointer;
  // Une phrase par ligne sur téléphone : l'indication n'y est plus coupée.
  const hintSentences = hint.split(/(?<=[.!?])\s+/);

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
      setAnnouncement(`${step.title} ${step.detail}. ${texts.hint.presented}`);
    }
  };

  const onMood = (next: MoodId) => {
    const state = store.getState();
    const hourMood = moodOfHour(visitorNow(state.settings.hourOffsetMs).getHours());
    state.markUser();
    state.setMood(next, next !== hourMood);
    setAnnouncement(`${texts.clock.pinned} ${texts.moods[next].light}`);
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
      data-flipped={presented && flipped ? 'true' : 'false'}
      data-dragging={dragging ?? ''}
      data-sound={soundOn ? 'on' : 'off'}
      data-places={formatPlaces(places)}
      data-offscreen={offscreen.join(' ')}
      data-physics={physics}
      data-fallen={fallen.join(' ')}
      data-disorder={disorder.toFixed(2)}
      data-tidying={tidying ? 'true' : 'false'}
      data-turned={presented && heldTurned ? 'true' : 'false'}
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
          {ready ? (
            <button
              type="button"
              className={styles.button}
              aria-pressed={soundOn}
              data-sound-toggle=""
              onClick={() => store.getState().toggleSound()}
            >
              {texts.sheets.ui.sound}
            </button>
          ) : null}
          {/* En mouvement réduit aussi : l'arrivée ne se rejoue pas, mais les
              objets déplacés reprennent leur place. */}
          {ready ? (
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
            ))}
          </ul>
        </nav>
        <div className={styles.corner}>
          <p className={styles.clock}>
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
        {/* Dans le footer : sous 1300 px, elle se pose juste au-dessus. */}
        <p
          className={styles.hint}
          data-on={showHint ? 'true' : undefined}
          data-auto={autoOn ? 'true' : undefined}
          data-held={held ? 'true' : undefined}
        >
          <i aria-hidden="true" />
          <span>
            {hintSentences.map((sentence, index) => (
              <span key={index} className={styles.hintLine}>
                {sentence}
                {index < hintSentences.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        </p>
      </footer>

      <Sheet texts={texts.sheets} locale={texts.locale} onAnnounce={setAnnouncement} />
      <TidyButton texts={texts.tidy} />

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}
