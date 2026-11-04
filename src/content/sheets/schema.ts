import { z } from 'zod';
import { text } from '../text';

// Les fiches du bureau (le bristol du prototype) : une par objet du CV,
// ouverte quand l'objet est présenté. Des faits du CV, rien d'inventé ni
// d'arrondi : sheets.test.ts compare chaque valeur au contenu. Les textes
// d'interface de la fiche (boutons, signes de vie) sont dans ui.

// Une ligne de la liste de définitions : un terme et sa valeur, avec un lien
// pour le courriel et LinkedIn (jamais vers un dépôt : ceux-là sont ajoutés
// par src/lib/desk.ts, et seulement s'ils sont publics).
const metaSchema = z.strictObject({
  term: text,
  value: text,
  href: z
    .string()
    .regex(/^(mailto:|https:\/\/)/, 'lien mailto: ou https:// attendu')
    .optional(),
});

const sheetSchema = z.strictObject({
  /** Sur-titre : la période (« Sept. 2020 - Août 2023 ») ou le genre de l'objet. */
  kicker: text,
  /** L'étape (« Étape 1 sur 3 », « Contact »). */
  step: text,
  title: text,
  meta: z.array(metaSchema).min(1),
  body: text,
  /** Une note manuscrite en bas de fiche, facultative (mêmes fiches en FR et en EN). */
  note: text.optional(),
});

// Un gabarit : {n} (et {h}, {mm}, {days}, {values}) y sont remplacés.
const template = (...keys: string[]) =>
  text.refine(
    (value) => keys.every((key) => value.includes(`{${key}}`)),
    `il manque ${keys.map((key) => `{${key}}`).join(' ou ')}`,
  );

const pluralSchema = z.strictObject({ one: template('n'), other: template('n') });

// Les signes de vie du coffret (src/lib/life-signs/format.ts, LifeSignsTexts).
const liveSchema = z.strictObject({
  title: text,
  sample: text,
  running: text,
  last: text,
  since: text,
  chart: template('days', 'values'),
  axisStart: template('days'),
  axisEnd: text,
  ago: z.strictObject({
    now: text,
    minutes: template('n'),
    hours: template('h'),
    hoursMinutes: template('h', 'mm'),
    days: pluralSchema,
  }),
  age: pluralSchema,
});

// Un genre montré en exemple dans la fiche de l'usine : jamais de nom de
// chaîne, de compte ni de lien (sheets.test.ts le vérifie).
const genreSchema = z.strictObject({
  /** Le texte de l'onglet, court. */
  tab: text,
  title: text,
  body: text,
  rows: z.array(z.strictObject({ term: text, value: text })).min(1),
});

// La fiche de l'usine (FactoryPanel) : le circuit, les chiffres globaux et
// les genres en onglets. Les chiffres viennent des signes de vie.
const factorySchema = z.strictObject({
  circuitLabel: text,
  /** Les cinq étapes ; la troisième, la validation humaine, est mise en avant. */
  circuit: z.array(text).length(5),
  status: text,
  last: template('ago'),
  more: template('n'),
  figures: z.strictObject({
    // Le libellé sous le chiffre, au singulier ou au pluriel (sans {n}).
    channels: z.strictObject({ one: text, other: text }),
    videos: z.strictObject({ one: text, other: text }),
    perDay: text,
    views: text,
    likes: text,
  }),
  tabsLabel: text,
  stats: z.strictObject({
    views: text,
    retention: text,
    retentionValue: template('n'),
    rejected: text,
    rejectedValue: template('n'),
    production: text,
    productionValue: template('n'),
  }),
  chart: template('days', 'values'),
  legend: template('days'),
  genres: z.strictObject({
    fantasy: genreSchema,
    philosophy: genreSchema,
    marbles: genreSchema,
    quiz: genreSchema,
  }),
});

const uiSchema = z.strictObject({
  /** Nom de la région de la fiche pour les lecteurs d'écran. */
  label: text,
  /** Préc. et Suiv. : l'abréviation visible, puis son complément pour les lecteurs d'écran. */
  prev: text,
  prevLabel: text,
  next: text,
  nextLabel: text,
  /** Reposer et Retourner : le texte visible est aussi le nom du bouton. */
  close: text,
  flip: text,
  /** Le raccourci de « Retourner » (une touche, la même en FR et en EN). */
  flipKey: z.string().regex(/^[A-Z]$/, 'une lettre majuscule attendue'),
  /** Étape 6 : remettre droit l'objet tourné par le visiteur (rotation libre). */
  upright: text,
  /** L'appel au contact (lien vers la section contact de la version express). */
  contact: text,
  /** Le lien vers le dépôt d'un projet public. */
  repository: text,
  /** Le bouton « Son » du HUD (aria-pressed porte l'état). */
  sound: text,
  live: liveSchema,
  factory: factorySchema,
});

export const sheetsSchema = z.strictObject({
  ui: uiSchema,
  // Dans l'ordre de SHEET_ORDER (src/scene/core/ids.ts).
  items: z.strictObject({
    book: sheetSchema,
    badge: sheetSchema,
    postit: sheetSchema,
    headset: sheetSchema,
    netherbrain: sheetSchema,
    homelab: sheetSchema,
    laptop: sheetSchema,
    chest: sheetSchema,
    card: sheetSchema,
    monitor: sheetSchema,
  }),
});

export type SheetsContent = z.infer<typeof sheetsSchema>;
export type SheetContent = SheetsContent['items']['book'];
