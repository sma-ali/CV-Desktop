'use client';

import type { DeskSheets } from '@/lib/desk';
import { useSceneStore, useSceneStoreApi } from '@/scene/core/store-context';
import styles from './Desk.module.css';

// La fiche de l'objet présenté (le bristol du prototype, partie « fiches ») :
// sur-titre, étape, titre, méta, texte, note, appel au contact, Préc. /
// Reposer / Suiv., Retourner, signes de vie du coffret. Elle s'ouvre avec
// l'objet présenté (store.presented) ; sur téléphone, elle monte du bas sans
// dépasser SHEET.portrait.maxHeight de la hauteur de la fenêtre.
//
// SQUELETTE du socle : le titre et « Reposer ». La partie « fiches » le
// remplace en gardant le nom, la prop texts, l'id sheet et data-open /
// data-sheet.
export function Sheet({ texts }: { texts: DeskSheets }) {
  const store = useSceneStoreApi();
  const presented = useSceneStore((state) => state.presented);
  const sheet = presented ? texts.items[presented] : null;

  return (
    <aside
      id="sheet"
      className={styles.sheet}
      data-open={sheet ? 'true' : 'false'}
      data-sheet={presented ?? ''}
      aria-labelledby={sheet ? 'sheet-title' : undefined}
      hidden={!sheet}
    >
      {sheet ? (
        <>
          <h2 id="sheet-title" className={styles.sheetTitle}>
            {sheet.title}
          </h2>
          <button
            type="button"
            className={styles.button}
            aria-label={texts.ui.closeLabel}
            onClick={() => {
              const state = store.getState();
              state.markUser();
              state.putBack();
            }}
          >
            {texts.ui.close}
          </button>
        </>
      ) : null}
    </aside>
  );
}
