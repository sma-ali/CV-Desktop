import { z } from 'zod';

// Texte affiché : jamais vide, sans espace parasite au début ni à la fin.
export const text = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, 'espace en trop au début ou à la fin');

export const texts = z.array(text).min(1);
