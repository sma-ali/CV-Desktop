// Identifiants partagés par la scène, le HUD et le serveur. Aucune dépendance :
// ce module part dans le JavaScript initial.

// Les objets du CV posés sur le bureau. L'écran (monitor) se regarde de près
// sans quitter le bureau : la caméra s'en approche au lieu de le soulever.
// Netherbrain et Homelab : le bocal au cerveau et la mini baie.
export const ITEM_IDS = [
  'book',
  'badge',
  'postit',
  'headset',
  'laptop',
  'card',
  'chest',
  'monitor',
  'netherbrain',
  'homelab',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

// Les étapes du CV, dans l'ordre des puces du bas de page. Les deux premières
// portent l'id de l'expérience dans le contenu, les deux suivantes celui du
// projet. Une étape par objet : Netherbrain, Homelab et l'usine sont à égalité.
// Le contact est posé à part, en bas à droite.
export type StepId = 'defi-metiers' | 'dares' | 'netherbrain' | 'homelab' | 'perso' | 'contact';

// L'étape que chaque objet raconte.
export const ITEM_STEP = {
  book: 'defi-metiers',
  badge: 'defi-metiers',
  postit: 'dares',
  headset: 'dares',
  // Le portable porte la pile technique (section compétences du CV), commune
  // à tous les projets : aucune puce ne lui correspond, comme l'écran.
  laptop: null,
  netherbrain: 'netherbrain',
  homelab: 'homelab',
  // L'écran montre tout le parcours (les deux postes, la pile) : aucune puce
  // ne lui correspond, aucune ne s'allume pendant son gros plan.
  monitor: null,
  card: 'contact',
  chest: 'perso',
} as const satisfies Record<ItemId, StepId | null>;

// L'objet présenté quand on choisit une étape (puce du bas de page).
export const STEP_ITEM = {
  'defi-metiers': 'book',
  dares: 'postit',
  netherbrain: 'netherbrain',
  homelab: 'homelab',
  perso: 'chest',
  contact: 'card',
} as const satisfies Record<StepId, ItemId>;

/**
 * L'ordre des fiches (boutons Préc. et Suiv., flèches du clavier) : le
 * parcours dans le temps, les projets, la pile, le coffret, le contact, puis
 * l'écran qui résume tout. La liste boucle.
 */
export const SHEET_ORDER = [
  'book',
  'badge',
  'postit',
  'headset',
  'netherbrain',
  'homelab',
  'laptop',
  'chest',
  'card',
  'monitor',
] as const satisfies readonly ItemId[];

/** L'objet suivant (direction 1) ou précédent (-1) dans SHEET_ORDER, en bouclant. */
export function neighborItem(item: ItemId, direction: 1 | -1): ItemId {
  const order: readonly ItemId[] = SHEET_ORDER;
  const index = order.indexOf(item);
  const next = (index + direction + order.length) % order.length;
  return order[index < 0 ? 0 : next] ?? 'book';
}

// Les corps du moteur physique : tout ce qui se
// déplace, se lance, se renverse et tombe. Les objets du CV posés sur le
// plateau, le casque (pendu à son support, il tombe si on le heurte), et
// tout le décor posé. Restent fixes : l'écran (son gros plan et le post-it
// collé dessus en dépendent), le support du casque, le plateau, le mur.
export const ITEM_BODY_IDS = [
  'book',
  'badge',
  'laptop',
  'card',
  'chest',
  'netherbrain',
  'homelab',
  'headset',
] as const;

/** Un objet du CV qui est un corps. */
export type ItemBodyId = (typeof ITEM_BODY_IDS)[number];

/**
 * Les morceaux du décor qui sont des corps. Leurs enfants sont dessinés à
 * leur place en paysage (repère du monde) ; l'origine du corps est l'ancre
 * du morceau (DECOR_ANCHORS, decor/layout.ts), sauf la tasse et la manette,
 * dessinées dans leur propre repère.
 */
const DECOR_BODY_IDS = [
  'mug',
  'pad',
  'keyboard',
  'mouse',
  'lamp',
  'plant',
  'manga',
  'fox',
  'wanderer',
  'rope',
  'wraps',
  'kimono',
] as const;

export type DecorBodyId = (typeof DECOR_BODY_IDS)[number];

export const BODY_IDS = [...ITEM_BODY_IDS, ...DECOR_BODY_IDS] as const;

export type BodyId = (typeof BODY_IDS)[number];

// Les ambiances de lumière, de l'aube à la nuit.
export const MOOD_IDS = ['morning', 'afternoon', 'evening', 'night'] as const;

export type MoodId = (typeof MOOD_IDS)[number];

export function isItemId(value: string): value is ItemId {
  return (ITEM_IDS as readonly string[]).includes(value);
}

export function isBodyId(value: string): value is BodyId {
  return (BODY_IDS as readonly string[]).includes(value);
}

export function isDecorBodyId(value: string): value is DecorBodyId {
  return (DECOR_BODY_IDS as readonly string[]).includes(value);
}

export function isMoodId(value: string): value is MoodId {
  return (MOOD_IDS as readonly string[]).includes(value);
}
