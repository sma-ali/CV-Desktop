export const locales = ['fr', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

// Nom de chaque langue écrit dans cette langue, pour le lien de bascule.
export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

/** L'autre langue du site, celle du lien de bascule. */
export const otherLocale: Record<Locale, Locale> = { fr: 'en', en: 'fr' };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
