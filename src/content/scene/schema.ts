import { z } from 'zod';
import { text, texts } from '../text';

// Textes peints dans la scène 3D : étiquettes des objets, code de l'écran,
// couvertures, pages, badge, post-it, carte de visite, portable, coffret,
// bocal de Netherbrain et baie du Homelab.
// Mêmes règles que le reste du contenu : des faits du CV, rien d'inventé ni
// d'arrondi. Les faits sont regroupés dans `facts` et comparés au contenu du
// CV par scene.test.ts ; le reste n'est que du décor qui n'affirme rien
// (« Exercice 1.1 », « Ticket résolu »).

// Étiquette accrochée à un objet du CV : un repère court (« 2020 ») et un mot.
const labelSchema = z.strictObject({
  mark: text,
  text,
});

// Une ligne de code : peut être vide (ligne blanche) ou indentée, mais tient
// dans la largeur de l'écran.
const codeLine = z
  .string()
  .max(60, 'ligne de code trop longue pour l’écran')
  .refine((value) => value.trimEnd() === value, 'espace en trop en fin de ligne');

// Un identifiant du code affiché (clé d'objet, nom de fonction).
const identifier = z
  .string()
  .regex(/^[\p{L}_$][\p{L}\p{N}_$]*$/u, 'identifiant TypeScript attendu');

const screenSchema = z.strictObject({
  /** L'onglet actif de l'éditeur. */
  fileName: text,
  /** Un second onglet, inactif. */
  otherFile: text,
  /** Le vocabulaire du code généré (voir screen-code.ts). */
  words: z.strictObject({
    list: identifier,
    entry: identifier,
    object: identifier,
    title: identifier,
    stack: identifier,
    location: identifier,
    available: identifier,
    /** Les compétences montrées, prises dans le CV. */
    stackItems: texts,
  }),
  /** Le code affiché, généré par buildScreenCode (un test vérifie qu'il est à jour). */
  code: z.array(codeLine).min(1),
  /** La ligne finale, tapée puis effacée en boucle. */
  closing: codeLine.pipe(text),
  /** La barre d'état de l'éditeur. */
  status: z.strictObject({ language: text, encoding: text, line: text, errors: text }),
});

// Les faits du CV que les objets portent. Chacun est vérifié contre le
// contenu (scene.test.ts) : un changement du CV fait échouer le test.
const factsSchema = z.strictObject({
  name: text,
  headline: text,
  location: text,
  availability: text,
  email: z.email(),
  /** Le profil LinkedIn sans le protocole (« linkedin.com/in/... »). */
  linkedin: text,
  defiMetiers: z.strictObject({
    organization: text,
    detail: text,
    role: text,
    /** Année de début (« 2020 »). */
    year: text,
    /** La période au mois près, comme dans la version express. */
    period: text,
    /** Années de début et de fin (« 2020 - 2023 »). */
    years: text,
    stack: text,
    /** Alternance : le CV anglais la mentionne (EPSI et My Digital School, 2020 - 2023). */
    kind: text,
    /** La migration du catalogue des formations (les deux bases). */
    migration: z.strictObject({ from: text, to: text }),
  }),
  dares: z.strictObject({
    organization: text,
    role: text,
    period: text,
    support: text,
    tickets: text,
    users: text,
    tools: text,
  }),
  projects: z.strictObject({
    year: text,
    items: z.array(z.strictObject({ name: text, tagline: text })).min(1),
    /** Autocollants du portable : noms des projets et compétences du CV. */
    stickers: texts,
    /** Pastilles de l'écran du portable : technologies citées dans les projets. */
    chips: texts,
    tests: text,
  }),
});

export const sceneContentSchema = z.strictObject({
  // Une étiquette par objet dont la pose a un point d'accroche (ITEM_POSES).
  labels: z.strictObject({
    book: labelSchema,
    postit: labelSchema,
    laptop: labelSchema,
    card: labelSchema,
    chest: labelSchema,
    netherbrain: labelSchema,
    homelab: labelSchema,
  }),
  screen: screenSchema,
  facts: factsSchema,
  // Décor : des mots qui n'affirment aucun fait.
  book: z.strictObject({
    cover: z.strictObject({ kicker: text, title: text, subtitle: texts, edition: text }),
    chapter: text,
    exercise: text,
    /** Le code PHP de la page de droite. */
    code: texts,
    /** La phrase sous le code, sur la migration (faits du CV). */
    lines: texts,
  }),
  postit: z.strictObject({
    resolved: text,
    /** Les deux post-it décoratifs du cadre de l'écran. */
    frame: z.tuple([text, text]),
  }),
  card: z.strictObject({ contact: text }),
  laptop: z.strictObject({ path: text }),
  chest: z.strictObject({ kicker: text, title: text }),
  // Faits du CV, comparés au contenu par scene.test.ts.
  netherbrain: z.strictObject({
    /** L'étiquette au dos du bocal, lue quand on le retourne. */
    label: z.strictObject({
      name: text,
      tagline: text,
      year: text,
      /** La pile, ligne à ligne, telle que le CV l'écrit. */
      stack: texts,
      tests: text,
    }),
  }),
  homelab: z.strictObject({
    name: text,
    /** Les plaques des unités de la baie : le serveur et le pare-feu (le switch n'en a pas). */
    units: z.strictObject({ server: text, firewall: text }),
    /** La petite étiquette de l'accès. */
    access: text,
  }),
});

export type SceneContent = z.infer<typeof sceneContentSchema>;
