'use client';

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { ContactForm } from '@/components/contact/ContactForm';
import type { DeskHudTexts, DeskSheets } from '@/lib/desk';
import { ITEM_STEP, neighborItem, type ItemId } from '@/scene/core/ids';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import { chestLiveView } from './lifeSignsView';
import styles from './Desk.module.css';
import { UPRIGHT_KEY, UprightButton } from './UprightButton';
import { rotateKey, rotationInput } from '@/scene/rotation/control';

/** L'instant présent à la minute près, pour « il y a 2 h 14 » (null côté serveur). */
function useNowMinute(): number | null {
  const minute = useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, 20_000);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  return minute === null ? null : minute * 60_000;
}

/**
 * Le visiteur se sert-il du clavier ? La dernière action (touche ou
 * pointeur) le dit : la fiche ouverte au clavier prend le focus, ouverte à
 * la souris ou au doigt, elle le laisse où il est.
 */
function useKeyboardModality() {
  const keyboard = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboard.current = true;
    };
    const onPointer = () => {
      keyboard.current = false;
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);
  return keyboard;
}

/** Une touche tapée dans un champ ne pilote pas la fiche. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export interface SheetProps {
  texts: DeskSheets;
  locale: DeskHudTexts['locale'];
  /** Fait lire un texte par la région d'état du HUD. */
  onAnnounce: (text: string) => void;
}

// La fiche de l'objet présenté : le bristol du prototype (papier ligné,
// marge rouge, légère rotation). Sur-titre, étape, titre, méta, texte,
// note, formulaire de contact (carte de visite), signes de vie du coffret,
// Retourner, appel au contact, dépôt public,
// Remettre droit, Préc. / Reposer / Suiv. Elle s'ouvre avec l'objet présenté
// (store.presented), quelle qu'en soit la source : puce, clic, étiquette,
// visite. Flèches pour tourner l'objet, Début pour le remettre droit, Page
// précédente et Page suivante pour l'objet voisin, R pour retourner ; Échap
// repose (dans DeskShell).
//
// Le focus : ouverte au clavier, la fiche le prend (sur son titre) et le
// rend à l'élément d'où il venait quand elle se ferme. Ouverte par la
// visite automatique ou au pointeur, elle ne le prend pas. En portrait,
// elle monte du bas sans dépasser SHEET.portrait.maxHeight (42 %) de la
// hauteur, et défile ; en paysage, elle se pose à droite.
export function Sheet({ texts, locale, onAnnounce }: SheetProps) {
  const store = useSceneStoreApi();
  const presented = useSceneStore((state) => state.presented);
  const presentedBy = useSceneStore((state) => state.presentedBy);
  const flipped = useSceneStore((state) => state.flipped);
  const lifeSigns = useSceneStore((state) => state.lifeSigns);
  const now = useNowMinute();
  const keyboard = useKeyboardModality();

  const sheetRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** L'élément qui avait le focus avant que la fiche ne le prenne. */
  const returnFocus = useRef<HTMLElement | null>(null);
  /** Le focus est-il (ou était-il, avant de disparaître avec un bouton) dans la fiche ? */
  const focusInside = useRef(false);
  const previous = useRef<ItemId | null>(null);

  const sheet = presented ? texts.items[presented] : null;
  const { ui } = texts;

  // Ouverture, changement d'objet, fermeture : focus et annonce.
  useEffect(() => {
    const before = previous.current;
    previous.current = presented;
    if (before === presented) return;
    const byVisitor = presentedBy !== null && presentedBy !== 'auto';

    if (presented && sheet) {
      const active = document.activeElement;
      const inside = active instanceof Node && !!sheetRef.current?.contains(active);
      if (byVisitor && keyboard.current && !inside) {
        // Ouverte au clavier depuis le HUD ou la scène : le focus vient sur le titre.
        if (active instanceof HTMLElement && active !== document.body) {
          returnFocus.current = active;
        }
        titleRef.current?.focus({ preventScroll: true });
        focusInside.current = true;
      } else if (byVisitor && presentedBy !== 'chip') {
        // La puce s'annonce elle-même ; les autres sources, ici.
        onAnnounce(`${sheet.title}. ${sheet.kicker}, ${sheet.step}.`);
      }
      return;
    }

    // Fermée : le focus revient d'où il venait, s'il était dans la fiche.
    const active = document.activeElement;
    if (focusInside.current && (active === null || active === document.body)) {
      const back = returnFocus.current;
      const step = before ? ITEM_STEP[before] : null;
      const chip = step ? document.querySelector<HTMLElement>(`[data-step="${step}"]`) : null;
      const target = back?.isConnected ? back : chip;
      target?.focus({ preventScroll: true });
    }
    returnFocus.current = null;
    focusInside.current = false;
  }, [presented, presentedBy, sheet, keyboard, onAnnounce]);

  // Tant que la fiche est ouverte (étape 6) : les flèches tournent l'objet
  // présenté, Début le remet droit, Page précédente et Page suivante passent
  // à l'objet voisin, R le retourne.
  useEffect(() => {
    if (!presented) return;
    const flipKey = ui.flipKey.toLowerCase();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(event.target)) return;
      const state = store.getState();
      if (!state.presented) return;
      const rotate = rotateKey(event.key);
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault();
        state.present(neighborItem(state.presented, event.key === 'PageDown' ? 1 : -1), 'sheet');
      } else if (rotate) {
        if (state.presented === 'monitor') return;
        event.preventDefault();
        // La visite qui tenait l'objet le laisse au visiteur.
        if (state.presentedBy === 'auto') store.setState({ presentedBy: 'keyboard' });
        state.markUser();
        rotationInput(store).nudge(rotate[0], rotate[1]);
      } else if (event.key === UPRIGHT_KEY) {
        if (state.presented === 'monitor') return;
        event.preventDefault();
        if (state.presentedBy === 'auto') store.setState({ presentedBy: 'keyboard' });
        state.requestUpright();
      } else if (event.key.toLowerCase() === flipKey && !event.repeat) {
        if (state.presented === 'monitor') return;
        event.preventDefault();
        state.toggleFlip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presented, store, ui.flipKey]);

  const go = (direction: 1 | -1) => {
    const state = store.getState();
    if (state.presented) state.present(neighborItem(state.presented, direction), 'sheet');
  };

  const putBack = () => {
    const state = store.getState();
    state.markUser();
    state.putBack();
  };

  // L'horloge avance par pas : jamais avant l'instant de la mesure, sinon
  // « il y a 2 h 14 » se lirait « 2 h 13 » juste après le chargement.
  const measuredAt = lifeSigns ? Date.parse(lifeSigns.measuredAt) : Number.NaN;
  const live =
    presented === 'chest' && now !== null
      ? chestLiveView(
          lifeSigns,
          Number.isFinite(measuredAt) ? Math.max(now, measuredAt) : now,
          ui.live,
          locale,
        )
      : null;
  const canFlip = presented !== null && presented !== 'monitor';

  return (
    <aside
      ref={sheetRef}
      id="sheet"
      className={styles.bristol}
      data-open={sheet ? 'true' : 'false'}
      data-sheet={presented ?? ''}
      aria-labelledby={sheet ? 'sheet-title' : undefined}
      hidden={!sheet}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        // Le bouton qui disparaît avec la fiche ne compte pas comme une sortie.
        if (next !== null) focusInside.current = false;
      }}
    >
      {sheet && presented ? (
        <>
          <p className={styles.sheetKicker}>
            <span>{sheet.kicker}</span>
            <span>{sheet.step}</span>
          </p>
          <h2 id="sheet-title" ref={titleRef} className={styles.sheetTitle} tabIndex={-1}>
            {sheet.title}
          </h2>
          <dl className={styles.sheetMeta}>
            {sheet.meta.map((row) => (
              <div key={row.term}>
                <dt>{row.term}</dt>
                <dd>
                  {row.href ? (
                    <a
                      href={row.href}
                      {...(row.href.startsWith('https:')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.sheetBody}>{sheet.body}</p>
          {sheet.note ? <p className={styles.sheetNote}>{sheet.note}</p> : null}

          {/* La carte de visite porte le formulaire de contact. */}
          {presented === 'card' ? (
            <ContactForm
              texts={texts.contactForm.texts}
              email={texts.contactForm.email}
              locale={locale}
              from="desk"
              variant="bristol"
            />
          ) : null}

          {live ? (
            <section className={styles.lifeSigns} aria-labelledby="sheet-live-title" data-live="">
              <p className={styles.liveHead}>
                <span id="sheet-live-title">
                  <i aria-hidden="true" />
                  {ui.live.title}
                </span>
                {live.sample ? <span data-sample="">{ui.live.sample}</span> : null}
              </p>
              <dl className={styles.liveRows}>
                <div>
                  <dt>{ui.live.running}</dt>
                  <dd data-live-running="">{live.running}</dd>
                </div>
                <div>
                  <dt>{ui.live.last}</dt>
                  <dd data-live-last="">{live.lastActivity}</dd>
                </div>
                <div>
                  <dt>{ui.live.since}</dt>
                  <dd data-live-since="">{live.since}</dd>
                </div>
              </dl>
              <div className={styles.liveChart} role="img" aria-label={live.chartLabel}>
                {live.bars.map((bar, index) => (
                  <i
                    key={index}
                    style={{ '--level': bar.level } as CSSProperties}
                    data-today={index === live.bars.length - 1 ? '' : undefined}
                  />
                ))}
              </div>
              <p className={styles.liveAxis} aria-hidden="true">
                <span>{live.axisStart}</span>
                <span>{live.axisEnd}</span>
              </p>
            </section>
          ) : null}

          <div className={styles.sheetActions}>
            {canFlip ? (
              <button
                type="button"
                className={styles.sheetFlip}
                aria-pressed={flipped}
                aria-keyshortcuts={ui.flipKey}
                onClick={() => store.getState().toggleFlip()}
              >
                {ui.flip}
                <kbd aria-hidden="true">{ui.flipKey}</kbd>
              </button>
            ) : null}
            {canFlip ? <UprightButton label={ui.upright} /> : null}
            <a href={texts.contactHref} className={styles.sheetCta}>
              {ui.contact}
            </a>
            {sheet.repository ? (
              <a
                href={sheet.repository.href}
                className={styles.sheetRepo}
                target="_blank"
                rel="noopener noreferrer"
                data-repository=""
              >
                {sheet.repository.label}
              </a>
            ) : null}
          </div>

          <div className={styles.sheetFoot}>
            {/* Le nom de chaque bouton commence par son texte visible (WCAG
                2.5.3, commande vocale) ; l'abréviation se complète pour les
                lecteurs d'écran. */}
            <button type="button" aria-keyshortcuts="PageUp" onClick={() => go(-1)}>
              <span aria-hidden="true">‹ </span>
              {ui.prev}
              <span className="visually-hidden"> ({ui.prevLabel})</span>
            </button>
            <button
              type="button"
              className={styles.sheetClose}
              aria-keyshortcuts="Escape"
              onClick={putBack}
            >
              {ui.close}
            </button>
            <button type="button" aria-keyshortcuts="PageDown" onClick={() => go(1)}>
              {ui.next}
              <span className="visually-hidden"> ({ui.nextLabel})</span>
              <span aria-hidden="true"> ›</span>
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
