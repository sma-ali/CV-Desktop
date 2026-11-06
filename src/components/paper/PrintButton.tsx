'use client';

import { useHydrated } from '@/components/hooks/useHydrated';

// Bouton « Imprimer ». Il n'apparaît qu'une fois le JavaScript chargé : sans
// lui, il ne servirait à rien (le raccourci du navigateur reste disponible).
export function PrintButton({ label, className }: { label: string; className?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
