import { z } from 'zod';
import { text } from '../text';

// Textes peints dans la scène 3D : étiquettes des objets et code de l'écran.
// Squelette posé à l'étape 3 ; la partie « objets » (src/scene/items) le
// complète avec les textes peints sur chaque objet (couverture du livre,
// badge, post-it, carte de visite, plaque du coffret...). Mêmes règles que le
// reste du contenu : des faits du CV, rien d'inventé ni d'arrondi.

// Étiquette accrochée à un objet du CV : un repère court (« 2020 ») et un mot.
const labelSchema = z.strictObject({
  mark: text,
  text,
});

// Une ligne de code de l'écran : peut être vide (ligne blanche) ou indentée,
// mais tient dans la largeur de l'écran.
const codeLine = z
  .string()
  .max(60, 'ligne de code trop longue pour l’écran')
  .refine((value) => value.trimEnd() === value, 'espace en trop en fin de ligne');

const screenSchema = z.strictObject({
  fileName: text,
  code: z.array(codeLine).min(1),
});

export const sceneContentSchema = z.strictObject({
  labels: z.strictObject({
    book: labelSchema,
    postit: labelSchema,
    laptop: labelSchema,
    card: labelSchema,
    chest: labelSchema,
  }),
  screen: screenSchema,
});

export type SceneContent = z.infer<typeof sceneContentSchema>;
