import type { Content, SheetContent, SheetsContent } from '@/content';
import { localeNames, type Locale } from '@/content/locales';
import { SHEET_ORDER, STEP_ITEM, type ItemId, type MoodId, type StepId } from '@/scene/core/ids';
import type { SceneTexts } from '@/scene/core/texts';
import { deskPath, expressPath } from './site';

// Ce que la page du bureau passe à ses composants client : des textes déjà
// validés, tirés du contenu côté serveur. Ni zod ni le module de contenu
// n'entrent ainsi dans le JavaScript du navigateur.

/** Une puce du bas de page : une étape du CV. */
export interface DeskStep {
  id: StepId;
  /** L'objet que la scène présente quand on la choisit. */
  item: ItemId;
  /** Le grand repère (« 2020 », « Projets perso »). */
  title: string;
  /** Le détail en petites capitales (« DEFI-METIERS »). */
  detail: string;
  /** La section correspondante de la version express (sans la scène, le lien y mène). */
  href: string;
  /** Les projets perso donnent des signes de vie (point vert). */
  live: boolean;
  /** La puce du contact, d'un autre ton. */
  contact: boolean;
}

/** Une fiche telle que le HUD l'affiche : celle du contenu, plus le lien du dépôt s'il est public. */
export interface DeskSheet extends SheetContent {
  /** Le dépôt GitHub du projet, seulement s'il est public (repository.public). */
  repository: { label: string; href: string } | null;
}

/** Les fiches du bureau et leurs textes d'interface. */
export interface DeskSheets {
  ui: SheetsContent['ui'];
  /** L'appel au contact : la section contact de la version express. */
  contactHref: string;
  /** Une fiche par objet, dans l'ordre de SHEET_ORDER. */
  items: Record<ItemId, DeskSheet>;
}

/** Les textes du HUD et du repli. */
export interface DeskHudTexts {
  locale: Locale;
  name: string;
  firstName: string;
  headline: string;
  availability: string;
  location: string;
  controlsLabel: string;
  express: { label: string; href: string };
  language: { label: string; href: string; locale: Locale };
  replay: string;
  loading: string;
  arrivalKicker: string;
  glance: string;
  steps: DeskStep[];
  clock: { visitorTime: string; pinned: string };
  moodsLabel: string;
  moods: Record<MoodId, { name: string; light: string }>;
  hint: {
    pointer: string;
    touch: string;
    auto: string;
    presented: string;
    held: { pointer: string; touch: string };
  };
  /** Les fiches (le bristol), le bouton « Son » et les signes de vie du coffret. */
  sheets: DeskSheets;
  fallback: {
    noScript: string;
    noWebgl: string;
    crashed: string;
    contextLost: string;
    expressLink: string;
  };
}

const otherLocale: Record<Locale, Locale> = { fr: 'en', en: 'fr' };

/** Année de début d'une expérience, d'après sa période (« 2020-09 » donne « 2020 »). */
function experienceStep(content: Content, id: 'defi-metiers' | 'dares', locale: Locale): DeskStep {
  const experience = content.experiences.find((entry) => entry.id === id);
  if (!experience) throw new Error(`expérience absente du contenu : ${id}`);
  return {
    id,
    item: STEP_ITEM[id],
    title: experience.period.start.slice(0, 4),
    detail: experience.organization,
    href: `${expressPath(locale)}#${id}`,
    live: false,
    contact: false,
  };
}

/** Les cinq étapes du bas de page, dans l'ordre du parcours. */
export function buildDeskSteps(content: Content, locale: Locale): DeskStep[] {
  const { projects, desk, sections } = content;
  const projectYear = Math.max(...projects.map((project) => project.year));
  return [
    experienceStep(content, 'defi-metiers', locale),
    experienceStep(content, 'dares', locale),
    {
      id: 'projects',
      item: STEP_ITEM.projects,
      title: String(projectYear),
      detail: projects.map((project) => project.name).join(' | '),
      href: `${expressPath(locale)}#projects`,
      live: false,
      contact: false,
    },
    {
      id: 'perso',
      item: STEP_ITEM.perso,
      title: desk.perso.title,
      detail: desk.perso.detail,
      // La version express n'a pas (encore) de section dédiée : les projets.
      href: `${expressPath(locale)}#projects`,
      live: true,
      contact: false,
    },
    {
      id: 'contact',
      item: STEP_ITEM.contact,
      title: sections.contact,
      detail: desk.contactDetail,
      href: `${expressPath(locale)}#contact`,
      live: false,
      contact: true,
    },
  ];
}

/**
 * Les fiches du HUD. Le lien d'un dépôt n'y entre que si le dépôt est public :
 * le contenu le marque (repository.public), à vérifier sur GitHub avant.
 */
export function buildDeskSheets(content: Content, locale: Locale): DeskSheets {
  const { ui, items } = content.sheets;
  const repositoryOf = (id: ItemId): DeskSheet['repository'] => {
    const project = content.projects.find((entry) => entry.id === id);
    return project?.repository.public
      ? { label: ui.repository, href: project.repository.url }
      : null;
  };
  return {
    ui,
    contactHref: `${expressPath(locale)}#contact`,
    items: Object.fromEntries(
      SHEET_ORDER.map((id) => [id, { ...items[id], repository: repositoryOf(id) }]),
    ) as Record<ItemId, DeskSheet>,
  };
}

export function buildDeskTexts(content: Content, locale: Locale): DeskHudTexts {
  const { profile, desk } = content;
  const other = otherLocale[locale];
  return {
    locale,
    name: profile.name,
    firstName: profile.name.split(' ')[0] ?? profile.name,
    headline: profile.headline,
    availability: profile.availability,
    location: profile.location,
    controlsLabel: desk.controlsLabel,
    express: { label: desk.expressLink, href: expressPath(locale) },
    language: { label: localeNames[other], href: deskPath(other), locale: other },
    replay: desk.replay,
    loading: desk.loading,
    arrivalKicker: desk.arrivalKicker,
    glance: desk.glance,
    steps: buildDeskSteps(content, locale),
    clock: desk.clock,
    moodsLabel: desk.moodsLabel,
    moods: desk.moods,
    hint: desk.hint,
    sheets: buildDeskSheets(content, locale),
    fallback: desk.fallback,
  };
}

export function buildSceneTexts(content: Content, locale: Locale): SceneTexts {
  return { locale, canvasLabel: content.desk.canvasLabel, content: content.scene };
}
