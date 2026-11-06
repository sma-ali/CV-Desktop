'use client';

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { FactoryTexts, FactoryView } from './factoryView';
import styles from './Desk.module.css';

// La fiche de l'usine (projets perso) : le circuit en cinq étapes, la
// validation humaine mise en avant, les chiffres globaux et leur graphique
// sur 14 jours, puis un genre par onglet d'intercalaire (sans chiffre). Un seul onglet ouvert à la fois : la fiche garde la
// même hauteur. Au clavier, les flèches gauche et droite (et Début, Fin)
// passent d'un onglet à l'autre ; elles ne tournent pas l'objet tenu tant
// que le focus est sur les onglets.

/** L'étape du circuit mise en avant : la validation humaine. */
const HUMAN_STEP = 2;

export function FactoryPanel({ view, texts }: { view: FactoryView; texts: FactoryTexts }) {
  const [index, setIndex] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const genre = view.genres[index] ?? view.genres[0];
  if (!genre) return null;

  const select = (next: number) => {
    const count = view.genres.length;
    const target = (next + count) % count;
    setIndex(target);
    tabs.current[target]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: view.genres.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    // Le clavier de la fiche (rotation de l'objet) ne s'en mêle pas.
    event.preventDefault();
    select(next);
  };

  return (
    <section className={styles.factory} data-factory="" aria-label={texts.circuitLabel}>
      <p className={styles.liveHead}>
        <span data-factory-status="">
          <i aria-hidden="true" />
          {view.status}
        </span>
        {view.sample ? <span data-sample="">{texts.sample}</span> : null}
      </p>

      <ol className={styles.circuit} aria-label={texts.circuitLabel}>
        {texts.circuit.map((step, i) => (
          <li key={step} data-human={i === HUMAN_STEP ? '' : undefined}>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <dl className={styles.figures}>
        {view.figures.map((figure) => (
          <div key={figure.label} data-wide={figure.wide ? '' : undefined}>
            <dd>{figure.value}</dd>
            <dt>{figure.label}</dt>
          </div>
        ))}
      </dl>
      {view.since ? (
        <p className={styles.factorySince} data-factory-since="">
          {view.since}
        </p>
      ) : null}

      <div className={styles.liveChart} role="img" aria-label={view.chartLabel}>
        {view.bars.map((bar, i) => (
          <i
            key={i}
            style={{ '--level': bar.level } as CSSProperties}
            data-today={i === view.bars.length - 1 ? '' : undefined}
          />
        ))}
      </div>
      <p className={styles.liveAxis} aria-hidden="true">
        <span>{view.axisStart}</span>
        <span>{view.axisEnd}</span>
      </p>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label={texts.tabsLabel}
        onKeyDown={onKeyDown}
      >
        {view.genres.map((entry, i) => (
          <button
            key={entry.id}
            ref={(node) => {
              tabs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${entry.id}`}
            aria-selected={i === index}
            aria-controls={`${base}-panel`}
            tabIndex={i === index ? 0 : -1}
            data-genre={entry.id}
            onClick={() => select(i)}
          >
            {entry.tab}
          </button>
        ))}
      </div>
      <div
        className={styles.tabPanel}
        role="tabpanel"
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
