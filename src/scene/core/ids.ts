// Identifiants partagés par la scène, le HUD et le serveur. Aucune dépendance :
// ce module part dans le JavaScript initial.

// Les objets du CV posés sur le bureau. L'écran (monitor) se regarde de près
// sans quitter le bureau : la caméra s'en approche au lieu de le soulever.
// Netherbrain et Homelab (étape 4) : le bocal au cerveau et la mini baie.
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
// portent l'id de l'expérience dans le contenu.
export const STEP_IDS = ['defi-metiers', 'dares', 'projects', 'perso', 'contact'] as const;

export type StepId = (typeof STEP_IDS)[number];

// L'étape que chaque objet raconte.
export const ITEM_STEP = {
  book: 'defi-metiers',
  badge: 'defi-metiers',
  postit: 'dares',
  headset: 'dares',
  // Le portable porte la pile technique (section compétences du CV) : il
  // reste dans l'étape des projets, dont il est l'outil.
  laptop: 'projects',
  netherbrain: 'projects',
  homelab: 'projects',
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
  projects: 'netherbrain',
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

// Les corps posés sur le plateau qui se glissent (étape 4) : les objets du CV
// à plat, les deux nouveaux objets, et deux objets du décor (la tasse et la
// manette, comme dans le prototype). Le post-it (collé à l'écran), le casque
// (sur son support) et l'écran ne glissent pas.
export const DECOR_BODY_IDS = ['mug', 'pad'] as const;

export type DecorBodyId = (typeof DECOR_BODY_IDS)[number];

export const BODY_IDS = [
  'book',
  'badge',
  'laptop',
  'card',
  'chest',
  'netherbrain',
  'homelab',
  ...DECOR_BODY_IDS,
] as const;

export type BodyId = (typeof BODY_IDS)[number];

/** Un objet du CV qui glisse. */
export type DraggableItemId = Extract<BodyId, ItemId>;

// Les ambiances de lumière, de l'aube à la nuit.
export const MOOD_IDS = ['morning', 'afternoon', 'evening', 'night'] as const;

export type MoodId = (typeof MOOD_IDS)[number];

export function isItemId(value: string): value is ItemId {
  return (ITEM_IDS as readonly string[]).includes(value);
}

export function isBodyId(value: string): value is BodyId {
  return (BODY_IDS as readonly string[]).includes(value);
}

export function isMoodId(value: string): value is MoodId {
  return (MOOD_IDS as readonly string[]).includes(value);
}
