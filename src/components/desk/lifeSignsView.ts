import {
  formatLifeSigns,
  LIFE_SIGNS_DAYS,
  type LifeSigns,
  type LifeSignsTexts,
  type LifeSignsView,
} from '@/lib/life-signs';

// Ce que la fiche du coffret affiche des signes de vie, à l'abri des données
// mal formées : elles viennent d'un JSON public, qui peut arriver
// incomplet. Fonction pure : la fiche l'appelle avec Date.now(), les tests
// avec un instant fixe.

/** Une barre du graphique : la valeur du jour et sa hauteur, de 0 à 1. */
export interface ActivityBar {
  value: number;
  level: number;
}

export interface ChestLiveView extends LifeSignsView {
  /** Les LIFE_SIGNS_DAYS barres, du plus ancien jour au jour de la mesure. */
  bars: ActivityBar[];
}

const isInstant = (iso: unknown): iso is string =>
  typeof iso === 'string' && Number.isFinite(Date.parse(iso));

/** Un nombre de jours propre : entier, jamais négatif ni absent. */
const cleanCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

/**
 * Les 14 derniers jours, quel que soit ce qu'on reçoit : trop court, on
 * complète par des jours vides au début ; trop long, on garde la fin.
 */
export function normalizeActivity(activity: readonly unknown[] | undefined): number[] {
  const values = (Array.isArray(activity) ? activity : []).map(cleanCount);
  const recent = values.slice(-LIFE_SIGNS_DAYS);
  return [...Array<number>(LIFE_SIGNS_DAYS - recent.length).fill(0), ...recent];
}

/**
 * Les signes de vie mis en mots pour la fiche, ou null quand il n'y a rien
 * de sûr à montrer (pas de données, instants illisibles). Une date dans le
 * futur (horloge du visiteur en retard) se lit « à l'instant ».
 */
export function chestLiveView(
  signs: LifeSigns | null,
  now: number,
  texts: LifeSignsTexts,
  locale: string,
): ChestLiveView | null {
  if (!signs || !isInstant(signs.lastActivityAt) || !isInstant(signs.since)) return null;
  if (!Number.isFinite(now)) return null;
  const activity = normalizeActivity(signs.activity);
  const view = formatLifeSigns(
    { ...signs, running: cleanCount(signs.running), activity },
    now,
    texts,
    locale,
  );
  return {
    ...view,
    bars: activity.map((value) => ({ value, level: value / view.max })),
  };
}
