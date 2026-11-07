import { useRef, useState, type KeyboardEvent } from 'react';

// Une rangée d'onglets au clavier : les flèches gauche et droite (et Début,
// Fin) passent d'un onglet à l'autre, en boucle, et lui donnent le focus.
// Elles ne tournent pas l'objet tenu tant que le focus est sur les onglets.
export function useTabList(count: number, initial = 0) {
  const [index, setIndex] = useState(initial);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: number) => {
    const target = (next + count) % count;
    setIndex(target);
    tabs.current[target]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    // Le clavier de la fiche (rotation de l'objet) ne s'en mêle pas.
    event.preventDefault();
    select(next);
  };

  /** À passer en ref à l'onglet i. */
  const tabRef = (i: number) => (node: HTMLButtonElement | null) => {
    tabs.current[i] = node;
  };

  return { index, select, onKeyDown, tabRef };
}
