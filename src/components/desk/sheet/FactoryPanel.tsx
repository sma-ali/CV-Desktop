'use client';

import { useId, type CSSProperties } from 'react';
import type { FactoryTexts, FactoryView } from './factoryView';
import { useTabList } from './useTabList';
import styles from './FactoryPanel.module.css';

// La fiche de l'usine (projets perso) : le circuit en cinq étapes, chacune
// avec ce qui s'y passe (la validation humaine mise en avant), les chiffres
// globaux et leur graphique sur 14 jours, puis un genre par onglet
// d'intercalaire (sans chiffre). Étapes et genres sont deux rangées
// d'onglets : un seul ouvert à la fois, la fiche garde la même hauteur.

/** L'étape du circuit mise en avant : la validation humaine. */
const HUMAN_STEP = 2;

export function FactoryPanel({ view, texts }: { view: FactoryView; texts: FactoryTexts }) {
  const steps = useTabList(texts.circuit.length);
  const genres = useTabList(view.genres.length);
  const base = useId();
  const step = texts.circuit[steps.index] ?? texts.circuit[0];
  const genre = view.genres[genres.index] ?? view.genres[0];
  if (!genre || !step) return null;

  return (
    <section className={styles.factory} data-factory="" aria-label={texts.circuitLabel}>
      <p className={styles.head}>
        <span data-factory-status="">
          <i aria-hidden="true" />
          {view.status}
        </span>
        {view.sample ? <span data-sample="">{texts.sample}</span> : null}
      </p>

      <div
        className={styles.circuit}
        role="tablist"
        aria-label={texts.circuitLabel}
        onKeyDown={steps.onKeyDown}
      >
        {texts.circuit.map((entry, i) => (
          <button
            key={entry.label}
            ref={steps.tabRef(i)}
            type="button"
            role="tab"
            id={`${base}-step-${i}`}
            aria-selected={i === steps.index}
            aria-controls={`${base}-step-panel`}
            tabIndex={i === steps.index ? 0 : -1}
            data-human={i === HUMAN_STEP ? '' : undefined}
            onClick={() => steps.select(i)}
          >
            <span>{entry.label}</span>
          </button>
        ))}
      </div>
      <p
        className={styles.stepPanel}
        role="tabpanel"
        tabIndex={0}
        id={`${base}-step-panel`}
        aria-labelledby={`${base}-step-${steps.index}`}
        data-step-panel=""
      >
        {step.detail}
      </p>

      <dl className={styles.figures}>
        {view.figures.map((figure) => (
          <div key={figure.label} data-wide={figure.wide ? '' : undefined}>
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      {view.since ? (
        <p className={styles.since} data-factory-since="">
          {view.since}
        </p>
      ) : null}

      <div className={styles.chart} role="img" aria-label={view.chartLabel}>
        {view.bars.map((bar, i) => (
          <i
            key={i}
            style={{ '--level': bar.level } as CSSProperties}
            data-today={i === view.bars.length - 1 ? '' : undefined}
          />
        ))}
      </div>
      <p className={styles.axis} aria-hidden="true">
        <span>{view.axisStart}</span>
        <span>{view.axisEnd}</span>
      </p>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label={texts.tabsLabel}
        onKeyDown={genres.onKeyDown}
      >
        {view.genres.map((entry, i) => (
          <button
            key={entry.id}
            ref={genres.tabRef(i)}
            type="button"
            role="tab"
            id={`${base}-tab-${entry.id}`}
            aria-selected={i === genres.index}
            aria-controls={`${base}-panel`}
            tabIndex={i === genres.index ? 0 : -1}
            data-genre={entry.id}
            onClick={() => genres.select(i)}
          >
            {entry.tab}
          </button>
        ))}
      </div>
      <div
        className={styles.tabPanel}
        role="tabpanel"
        // Rien de focusable dans le panneau : il prend lui-même le focus,
        // pour que Tab mène des onglets à leur contenu.
        tabIndex={0}
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${genre.id}`}
        data-panel={genre.id}
      >
        <h3>{genre.title}</h3>
        <p>{genre.body}</p>
        <dl>
          {genre.rows.map((row) => (
            <div key={row.term}>
              <dt>{row.term}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
