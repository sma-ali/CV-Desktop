'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DeskHudTexts } from '@/lib/desk';
import { useSceneStore } from '@/scene/core/store-context';
import { Sheet } from '../sheet/Sheet';
import { Hint } from './Hint';
import { HudProbe } from './HudProbe';
import { StepChips } from './StepChips';
import { TidyButton } from './TidyButton';
import styles from './Hud.module.css';

// Le HUD du bureau, rendu par le serveur et visible avant la 3D : carton
// d'arrivée, identité et bouton de langue en haut, puces du CV et
// indication en bas, fiche de l'objet présenté, bouton de rangement. La
// lumière suit l'heure du visiteur, sans réglage ni texte ; le son est
// ouvert par défaut (DeskShell), sans bouton. La racine (HudProbe) expose
// l'état de la scène aux tests.
export function Hud({
  texts,
  loading,
}: {
  texts: DeskHudTexts;
  /** La scène se prépare sous l'écran de chargement (Intro). */
  loading: boolean;
}) {
  const ready = useSceneStore((state) => state.ready);
  const hud = useSceneStore((state) => state.hud);
  // Ce que la région d'état annonce : seulement les gestes du visiteur
  // (objet présenté par une puce ou depuis la scène).
  const [announcement, setAnnouncement] = useState('');

  // Avant la première image de la scène, tout le HUD est visible. Ensuite,
  // l'identité et les puces suivent l'arrivée.
  const brandHidden = ready && !hud.brand ? 'true' : undefined;
  const chipsHidden = ready && !hud.chips ? 'true' : undefined;

  return (
    <HudProbe className={styles.hud} loading={loading}>
      <p className={styles.titleCard} data-on={hud.carton ? 'true' : undefined} aria-hidden="true">
        <span className={styles.titleCardKicker}>{texts.arrivalKicker}</span>
        <span className={styles.titleCardName}>{texts.firstName}</span>
        <span className={styles.titleCardRole}>{texts.headline}</span>
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
          <Link
            href={texts.language.href}
            hrefLang={texts.language.locale}
            lang={texts.language.locale}
            aria-label={texts.language.name}
            title={texts.language.name}
            className={styles.button}
          >
            {texts.language.label}
          </Link>
        </nav>
      </header>

      <footer className={styles.bottom} data-arrival-hidden={chipsHidden}>
        <StepChips texts={texts} onAnnounce={setAnnouncement} />
        <Hint texts={texts.hint} />
      </footer>

      <Sheet texts={texts.sheets} locale={texts.locale} onAnnounce={setAnnouncement} />
      <TidyButton texts={texts.tidy} />

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </HudProbe>
  );
}
