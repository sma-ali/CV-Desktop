'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// Bouton « Imprimer ». Il n'apparaît qu'une fois le JavaScript chargé : sans
// lui, il ne servirait à rien (le raccourci du navigateur reste disponible).
export function PrintButton({ label, className }: { label: string; className?: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
