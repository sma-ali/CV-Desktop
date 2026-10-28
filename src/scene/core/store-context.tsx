'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { SceneState, SceneStore } from './store';

// Le store passe par un contexte React, jamais par une variable globale : une
// page, un store. React Three Fiber relaie les contextes dans le Canvas, donc
// le HUD et la scène lisent le même store.

const SceneStoreContext = createContext<SceneStore | null>(null);

export function SceneStoreProvider({
  store,
  children,
}: {
  store: SceneStore;
  children: ReactNode;
}) {
  return <SceneStoreContext value={store}>{children}</SceneStoreContext>;
}

/** Le store lui-même, pour lire clock et frame dans useFrame ou appeler une action. */
export function useSceneStoreApi(): SceneStore {
  const store = useContext(SceneStoreContext);
  if (!store) throw new Error('useSceneStoreApi : pas de SceneStoreProvider au-dessus');
  return store;
}

/** S'abonne à une partie de l'état réactif ; le composant se redessine quand elle change. */
export function useSceneStore<T>(selector: (state: SceneState) => T): T {
  return useStore(useSceneStoreApi(), selector);
}
