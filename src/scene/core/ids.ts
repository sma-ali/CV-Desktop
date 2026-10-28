// Identifiants partagés par la scène, le HUD et le serveur. Aucune dépendance :
// ce module part dans le JavaScript initial.

// Les objets du CV posés sur le bureau. L'écran (monitor) se regarde de près
// sans quitter le bureau : la caméra s'en approche au lieu de le soulever.
export const ITEM_IDS = [
  'book',
  'badge',
  'postit',
  'headset',
  'laptop',
  'card',
  'chest',
  'monitor',
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
  laptop: 'projects',
  monitor: 'projects',
  card: 'contact',
  chest: 'perso',
} as const satisfies Record<ItemId, StepId>;

// L'objet présenté quand on choisit une étape (puce du bas de page, mode auto).
export const STEP_ITEM = {
  'defi-metiers': 'book',
  dares: 'postit',
  projects: 'laptop',
  perso: 'chest',
  contact: 'card',
} as const satisfies Record<StepId, ItemId>;

// Les ambiances de lumière, de l'aube à la nuit.
export const MOOD_IDS = ['morning', 'afternoon', 'evening', 'night'] as const;

export type MoodId = (typeof MOOD_IDS)[number];

export function isItemId(value: string): value is ItemId {
  return (ITEM_IDS as readonly string[]).includes(value);
}

export function isMoodId(value: string): value is MoodId {
  return (MOOD_IDS as readonly string[]).includes(value);
}
