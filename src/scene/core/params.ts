import { isItemId, isMoodId, type ItemId, type MoodId } from './ids';

// Paramètres de test lus dans l'adresse, comme ceux du prototype. Ils servent
// aux captures et aux tests de bout en bout ; un visiteur ne les voit jamais.
export interface TestParams {
  /** ?t=11000 : saute à 11 s de l'arrivée (en ms dans l'adresse, en secondes ici). */
  t: number | null;
  /** ?fige : gèle l'horloge à t (et donc les animations qui en dépendent). */
  frozen: boolean;
  /** ?heure=14 : l'heure du visiteur (0 à 24, décimales permises). */
  hour: number | null;
  /** ?auto=0 : pas de visite automatique. */
  auto: boolean;
  /** ?reduit : mouvement réduit, comme prefers-reduced-motion. */
  reduced: boolean;
  /** ?prendre=book : présente un objet dès le départ. */
  present: ItemId | null;
  /** ?ambiance=night : force une ambiance. */
  mood: MoodId | null;
  /** ?noshadow : sans ombres portées. */
  noShadow: boolean;
  /** ?nopost : sans post-traitement. */
  noPost: boolean;
}

function finite(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseTestParams(search: string | URLSearchParams): TestParams {
  const query = typeof search === 'string' ? new URLSearchParams(search) : search;
  const ms = finite(query.get('t'));
  const hour = finite(query.get('heure'));
  const present = query.get('prendre');
  const mood = query.get('ambiance');
  return {
    t: ms === null ? null : Math.max(0, ms) / 1000,
    frozen: query.has('fige'),
    hour: hour === null ? null : ((hour % 24) + 24) % 24,
    auto: query.get('auto') !== '0',
    reduced: query.has('reduit'),
    present: present !== null && isItemId(present) ? present : null,
    mood: mood !== null && isMoodId(mood) ? mood : null,
    noShadow: query.has('noshadow'),
    noPost: query.has('nopost'),
  };
}
