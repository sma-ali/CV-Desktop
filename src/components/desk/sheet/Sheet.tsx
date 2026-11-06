'use client';

import { ContactForm } from '@/components/contact/ContactForm';
import type { DeskHudTexts, DeskSheets } from '@/lib/desk';
import { neighborItem } from '@/scene/core/ids';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import { FactoryPanel } from './FactoryPanel';
import { UprightButton } from './UprightButton';
import { useFactoryView } from './useFactoryView';
import { useSheetFocus } from './useSheetFocus';
import { useSheetKeys } from './useSheetKeys';
import styles from './Sheet.module.css';

type SheetContent = DeskSheets['items'][keyof DeskSheets['items']];

export interface SheetProps {
  texts: DeskSheets;
  locale: DeskHudTexts['locale'];
  /** Fait lire un texte par la région d'état du HUD. */
  onAnnounce: (text: string) => void;
}

// La fiche de l'objet présenté, un bristol ligné : sur-titre et étape,
// titre, lignes de méta, texte, note, puis selon l'objet le formulaire de
// contact (carte de visite) ou la fiche de l'usine, Remettre droit, le
// dépôt public, et Préc. / Reposer / Suiv. Elle s'ouvre avec l'objet
// présenté (store.presented), quelle qu'en soit la source : puce, clic,
// étiquette, visite. Clavier : useSheetKeys ; focus et annonces :
// useSheetFocus. En portrait, elle monte du bas et défile ; en paysage,
// elle se pose à droite (Sheet.module.css).
export function Sheet({ texts, locale, onAnnounce }: SheetProps) {
  const store = useSceneStoreApi();
  const presented = useSceneStore((state) => state.presented);
  const presentedBy = useSceneStore((state) => state.presentedBy);
  const sheet = presented ? texts.items[presented] : null;
  const { ui } = texts;

  const factory = useFactoryView(presented === 'chest', ui.factory, locale);
  const { sheetRef, titleRef, onFocus, onBlur } = useSheetFocus({
    presented,
    presentedBy,
    announcement: sheet ? `${sheet.title}. ${sheet.kicker}, ${sheet.step}.` : null,
    onAnnounce,
  });
  useSheetKeys(presented, ui.flipKey);

  const go = (direction: 1 | -1) => {
    const state = store.getState();
    if (state.presented) state.present(neighborItem(state.presented, direction), 'sheet');
  };

  const putBack = () => {
    const state = store.getState();
    state.markUser();
    state.putBack();
  };

  // L'écran ne se tourne pas : pas de « Remettre droit ».
  const turnable = presented !== null && presented !== 'monitor';

  return (
    <aside
      ref={sheetRef}
      id="sheet"
      className={styles.sheet}
      data-open={sheet ? 'true' : 'false'}
      data-sheet={presented ?? ''}
      aria-labelledby={sheet ? 'sheet-title' : undefined}
      hidden={!sheet}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {sheet && presented ? (
        <>
          <p className={styles.kicker}>
            <span>{sheet.kicker}</span>
            <span>{sheet.step}</span>
          </p>
          <h2 id="sheet-title" ref={titleRef} className={styles.title} tabIndex={-1}>
            {sheet.title}
          </h2>
          {factory ? null : <SheetMeta rows={sheet.meta} />}
          <p className={styles.body}>{sheet.body}</p>
          {factory ? <FactoryPanel view={factory} texts={ui.factory} /> : null}
          {sheet.note ? <p className={styles.note}>{sheet.note}</p> : null}

          {/* La carte de visite porte le formulaire de contact. */}
          {presented === 'card' ? (
            <ContactForm
              texts={texts.contactForm.texts}
              email={texts.contactForm.email}
              locale={locale}
              from="desk"
              variant="sheet"
            />
          ) : null}

          <div className={styles.actions}>
            {/* Pas de bouton « Retourner » : on retourne l'objet d'un clic
                (ou R au clavier), et le contact est en bas à droite. */}
            {turnable ? <UprightButton label={ui.upright} /> : null}
            {sheet.repository ? (
              <a
                href={sheet.repository.href}
                className={styles.repo}
                target="_blank"
                rel="noopener noreferrer"
                data-repository=""
              >
                {sheet.repository.label}
              </a>
            ) : null}
          </div>

          <div className={styles.foot}>
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
              className={styles.close}
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

/** Les lignes de méta de la fiche ; un lien https s'ouvre dans un nouvel onglet. */
function SheetMeta({ rows }: { rows: SheetContent['meta'] }) {
  return (
    <dl className={styles.meta}>
      {rows.map((row) => (
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
  );
}
