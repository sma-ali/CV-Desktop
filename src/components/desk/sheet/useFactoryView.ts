'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/content/locales';
import { useSceneStore } from '@/scene/core/store-context';
import { factoryView, type FactoryTexts, type FactoryView } from './factoryView';

/** L'instant présent à la minute près, pour « dernière vidéo hier » (null côté serveur). */
function useNowMinute(): number | null {
  const minute = useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, 20_000);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  return minute === null ? null : minute * 60_000;
}

/**
 * Ce que la fiche de l'usine affiche, d'après les signes de vie du store ;
 * null si la fiche ouverte n'est pas celle de l'usine, ou côté serveur.
 * L'horloge avance par pas, jamais avant l'instant de la mesure : une
 * horloge de visiteur en retard ne lit pas « dernière vidéo » dans le futur.
 */
export function useFactoryView(
  open: boolean,
  texts: FactoryTexts,
  locale: Locale,
): FactoryView | null {
  const lifeSigns = useSceneStore((state) => state.lifeSigns);
  const now = useNowMinute();
  if (!open || now === null) return null;
  const measuredAt = lifeSigns ? Date.parse(lifeSigns.measuredAt) : Number.NaN;
  const clock = Number.isFinite(measuredAt) ? Math.max(now, measuredAt) : now;
  return factoryView(lifeSigns, clock, texts, locale);
}
