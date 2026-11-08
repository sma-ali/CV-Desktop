import { z } from 'zod';
import { text, texts } from './text';

// Une page de texte (mentions légales, « Comment ce site est fait ») : un
// titre, une phrase d'introduction, des sections de quelques paragraphes et
// une date de mise à jour.

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant attendu en kebab-case');

const textSectionSchema = z.strictObject({
  id,
  heading: text,
  paragraphs: texts,
});

export const textPageSchema = z.strictObject({
  title: text,
  /** La phrase sous le titre. */
  intro: text,
  /** « Mis à jour le 6 novembre 2026 ». */
  updated: text,
  sections: z.array(textSectionSchema).min(1),
});

export type TextPageContent = z.infer<typeof textPageSchema>;
