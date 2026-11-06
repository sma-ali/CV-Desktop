import { z } from 'zod';
import { text, texts } from '../text';

// La page des mentions légales et de la confidentialité : un titre, une
// date de mise à jour, puis des sections de quelques paragraphes.

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant attendu en kebab-case');

const legalSectionSchema = z.strictObject({
  id,
  heading: text,
  paragraphs: texts,
});

export const legalSchema = z.strictObject({
  title: text,
  /** La phrase sous le titre. */
  intro: text,
  /** « Mis à jour le 6 novembre 2026 ». */
  updated: text,
  sections: z.array(legalSectionSchema).min(1),
});

export type LegalContent = z.infer<typeof legalSchema>;
