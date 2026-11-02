import { z } from 'zod';
import { locales } from '@/content/locales';
import {
  checkEmail,
  checkMessage,
  checkName,
  cleanEmail,
  cleanMessage,
  cleanName,
  CONTACT_FIELDS,
  CONTACT_SOURCES,
  HONEYPOT_FIELD,
  type ContactField,
  type FieldErrorCode,
} from './rules';

// Validation côté serveur de ce que le formulaire envoie, en JSON comme en
// x-www-form-urlencoded. Les champs du visiteur passent par les fonctions de
// rules.ts, celles que le navigateur applique aussi : mêmes limites, mêmes codes.

const FIELD_CODES = new Set<string>(['required', 'too_short', 'too_long', 'invalid']);

/** Un absent vaut une chaîne vide (« required ») ; un nombre ou un objet est refusé. */
const blankIfMissing = (value: unknown) => (value === undefined || value === null ? '' : value);

/** Un champ facultatif laissé vide vaut absent. */
const undefinedIfBlank = (value: unknown) => (value === '' || value === null ? undefined : value);

function visitorField(
  check: (raw: string) => FieldErrorCode | null,
  clean: (raw: string) => string,
) {
  return z.preprocess(
    blankIfMissing,
    z.string().transform((raw, context) => {
      const code = check(raw);
      if (code) {
        context.addIssue({ code: 'custom', message: code });
        return z.NEVER;
      }
      return clean(raw);
    }),
  );
}

export const contactRequestSchema = z.object({
  name: visitorField(checkName, cleanName),
  email: visitorField(checkEmail, cleanEmail),
  message: visitorField(checkMessage, cleanMessage),
  locale: z.enum(locales),
  from: z.preprocess(undefinedIfBlank, z.enum(CONTACT_SOURCES).optional()),
  // Le piège : n'importe quel texte, borné. Rempli, le message est ignoré.
  [HONEYPOT_FIELD]: z.preprocess(undefinedIfBlank, z.string().max(500).optional()),
  // Durée de saisie mesurée par le navigateur (ms), depuis la première frappe.
  // Une durée plutôt qu'un horodatage : l'horloge du visiteur peut différer
  // de celle du serveur. Absente sans JavaScript.
  typingMs: z.preprocess(
    undefinedIfBlank,
    z.coerce.number().int().min(0).max(86_400_000).optional(),
  ),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;

/** Les erreurs de champ d'un échec zod, en codes stables (« name »: « too_long »). */
export function fieldErrors(error: z.ZodError): Partial<Record<string, FieldErrorCode>> {
  const fields: Partial<Record<string, FieldErrorCode>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== 'string' || fields[key]) continue;
    const isVisitorField = (CONTACT_FIELDS as readonly string[]).includes(key);
    fields[key] =
      isVisitorField && FIELD_CODES.has(issue.message)
        ? (issue.message as FieldErrorCode)
        : 'invalid';
  }
  return fields;
}

export type { ContactField };
