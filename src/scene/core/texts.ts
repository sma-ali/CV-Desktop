import type { Locale } from '@/content/locales';
import type { SceneContent } from '@/content/scene/schema';

// Ce que la scène reçoit du serveur, en props : des textes déjà validés.
// Seulement des types ici : ni zod ni le module de contenu n'entrent dans le
// JavaScript du navigateur.
export interface SceneTexts {
  locale: Locale;
  /** aria-label du canvas. */
  canvasLabel: string;
  /** Textes peints dans la scène (src/content/scene). */
  content: SceneContent;
}
