'use client';

import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';

// Le moteur physique arrive à part, après l'arrivée : ni Rapier ni
// son WebAssembly dans le fichier de la scène. Il se charge quand l'arrivée
// est finie (phase settled), ou plus tôt au premier appui sur un corps
// (claimBody). En cas d'échec (WebAssembly refusé, réseau), le bureau reste
// tel qu'il est : immobile, les clics et les fiches marchent toujours.
const PhysicsLayer = lazy(() => import('./PhysicsLayer'));

class PhysicsBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn('Moteur physique indisponible : le bureau reste immobile.', error);
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function PhysicsGate() {
  const store = useSceneStoreApi();
  const status = useSceneStore((state) => state.physics);
  const ready = useSceneStore((state) => state.ready);
  const settled = useSceneStore((state) => state.phase === 'settled');

  useEffect(() => {
    if (ready && settled && store.getState().physics === 'off') {
      store.getState().setPhysics('loading');
    }
  }, [ready, settled, store]);

  if (status === 'off' || status === 'failed') return null;
  return (
    <PhysicsBoundary onError={() => store.getState().setPhysics('failed')}>
      <Suspense fallback={null}>
        <PhysicsLayer />
      </Suspense>
    </PhysicsBoundary>
  );
}
