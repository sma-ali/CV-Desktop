import { isBodyId, isItemId, isMoodId, type BodyId, type ItemId, type MoodId } from './ids';

// Paramètres de test lus dans l'adresse. Ils servent
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
  /** ?recto (avec ?prendre=) : l'objet présenté reste à l'endroit, sans faire son geste. */
  recto: boolean;
  /**
   * ?glisse=laptop:-0.3,2.15 : glisse un objet vers une place du plateau dès
   * le départ, comme un visiteur (collisions comprises), puis le lâche.
   * ?glisse seul : le portable vers la carte.
   */
  drag: TestDrag | null;
  /** ?noshadow : sans ombres portées. */
  noShadow: boolean;
  /** ?nopost : sans post-traitement. */
  noPost: boolean;
  /** ?desordre : tout le bureau dispersé dès que le moteur physique est prêt. */
  scatter: boolean;
  /** ?tourne=0.5,-1.2 (avec ?prendre=) : une orientation donnée d'office à l'objet présenté. */
  turn: TestTurn | null;
}

/**
 * Les angles de ?tourne=x,y (radians) : x autour de l'axe horizontal de la
 * vue, puis y autour de son axe vertical (rotation/trackball.ts, turnRotation).
 */
export interface TestTurn {
  x: number;
  y: number;
}

/** Un glisser demandé par l'adresse : quel corps, et vers quelle place (x, z). */
export interface TestDrag {
  item: BodyId;
  x: number;
  z: number;
}

/** Le glisser du prototype (?glisse) : le portable poussé sur la carte. */
export const DEFAULT_TEST_DRAG: TestDrag = { item: 'laptop', x: -0.3, z: 2.15 };

function parseDrag(value: string | null): TestDrag | null {
  if (value === null) return null;
  if (value.trim() === '') return DEFAULT_TEST_DRAG;
  const match = /^([a-z]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const [, item = '', x = '', z = ''] = match;
  return isBodyId(item) ? { item, x: Number(x), z: Number(z) } : null;
}

function parseTurn(value: string | null): TestTurn | null {
  if (value === null) return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
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
    recto: query.has('recto'),
    drag: parseDrag(query.get('glisse')),
    noShadow: query.has('noshadow'),
    noPost: query.has('nopost'),
    scatter: query.has('desordre'),
    turn: parseTurn(query.get('tourne')),
  };
}
