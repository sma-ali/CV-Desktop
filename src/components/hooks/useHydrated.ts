import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => undefined;

/**
 * Vrai une fois la page hydratée, faux dans le HTML du serveur et pendant
 * l'hydratation : le premier rendu du navigateur égale celui du serveur,
 * puis React refait le rendu avec la valeur du navigateur.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
