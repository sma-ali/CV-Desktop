import { en } from './en';
import { fr } from './fr';
import { locales, type Locale } from './locales';
import { contentSchema, type Content } from './schema';

export * from './locales';
export type { Content, DeskUi, Education, Experience, Project, Ui } from './schema';
export type { ContactFormContent } from './contact/schema';
export type { LegalContent } from './legal/schema';
export type { SceneContent } from './scene/schema';
export type { SheetContent, SheetsContent } from './sheets/schema';

// Validation au chargement du module : un contenu invalide fait échouer le
// build, pas la visite d'un recruteur.
const contentByLocale = Object.fromEntries(
  locales.map((locale) => [locale, contentSchema.parse({ fr, en }[locale])]),
) as Record<Locale, Content>;

export function getContent(locale: Locale): Content {
  return contentByLocale[locale];
}
