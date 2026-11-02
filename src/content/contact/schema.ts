import { z } from 'zod';
import { text } from '../text';

// Les textes du formulaire de contact (version express et fiche de la carte
// de visite). Les codes d'erreur (required, too_long...) sont ceux de la
// route /api/contact (src/lib/contact/rules.ts) : le formulaire les traduit
// ici. {min}, {max} et {n} sont remplacés par les limites de rules.ts.

const template = (...keys: string[]) =>
  text.refine(
    (value) => keys.every((key) => value.includes(`{${key}}`)),
    `il manque ${keys.map((key) => `{${key}}`).join(' ou ')}`,
  );

export const contactFormSchema = z.strictObject({
  /** Le titre repliable de la version express (« Écrire un message »). */
  open: text,
  intro: text,
  name: z.strictObject({
    label: text,
    errors: z.strictObject({ required: text, too_long: template('max'), invalid: text }),
  }),
  email: z.strictObject({
    label: text,
    hint: text,
    errors: z.strictObject({ required: text, too_long: template('max'), invalid: text }),
  }),
  message: z.strictObject({
    label: text,
    hint: template('min', 'max'),
    counter: template('n', 'max'),
    errors: z.strictObject({
      required: text,
      too_short: template('min'),
      too_long: template('max'),
      invalid: text,
    }),
  }),
  /** Le libellé du champ piège (jamais vu ni lu : il reste caché). */
  honeypot: text,
  submit: text,
  sending: text,
  /** La mention sous le formulaire : par où passe le message, ce qui en reste. */
  privacy: text,
  /** Le lien e-mail proposé quand l'envoi échoue. */
  emailInstead: text,
  /** L'état après l'envoi, par code de la route, plus « sent » et « network ». */
  status: z.strictObject({
    sent: text,
    validation: text,
    origin: text,
    rate_limited: text,
    too_large: text,
    unsupported: text,
    unavailable: text,
    send_failed: text,
    network: text,
  }),
});

export type ContactFormContent = z.infer<typeof contactFormSchema>;
