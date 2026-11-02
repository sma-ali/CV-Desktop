// Règles du formulaire de contact, partagées par le navigateur et le serveur.
// Ce module n'importe ni zod ni le module de contenu : le composant client
// s'en sert pour vérifier les champs avant l'envoi, et le schéma zod du
// serveur (schema.ts) s'appuie sur les mêmes fonctions. Les deux côtés
// appliquent donc exactement les mêmes limites.

/** Les champs que le visiteur remplit. */
export const CONTACT_FIELDS = ['name', 'email', 'message'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Codes d'erreur d'un champ, stables : le client les traduit par le module de contenu. */
export type FieldErrorCode = 'required' | 'too_short' | 'too_long' | 'invalid';

/** Codes d'erreur de la route, stables. */
export const CONTACT_ERROR_CODES = [
  'validation',
  'origin',
  'rate_limited',
  'too_large',
  'unsupported',
  'unavailable',
  'send_failed',
] as const;
export type ContactErrorCode = (typeof CONTACT_ERROR_CODES)[number];

/** Réponse JSON de /api/contact. */
export type ContactResponse =
  | { ok: true }
  | { ok: false; error: ContactErrorCode; fields?: Partial<Record<string, FieldErrorCode>> };

export const CONTACT_LIMITS = {
  name: { min: 1, max: 100 },
  email: { max: 254 },
  message: { min: 10, max: 5000 },
} as const;

/** Une saisie envoyée moins de 3 s après la première frappe vient d'un robot. */
export const MIN_TYPING_MS = 3000;

/** Taille maximale du corps de la requête lu par le serveur (16 ko). */
export const MAX_BODY_BYTES = 16 * 1024;

/** Le champ piège : caché aux humains, rempli par les robots. */
export const HONEYPOT_FIELD = 'website';

/** D'où vient le formulaire : la page où renvoyer un envoi sans JavaScript. */
export const CONTACT_SOURCES = ['express', 'desk'] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

// Une adresse simple : une partie locale, une arobase, un domaine avec un
// point. Ni espace, ni chevron, ni guillemet, ni virgule : rien qui puisse
// déborder dans un en-tête d'e-mail.
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;

// Caractères de contrôle, séparateurs de ligne Unicode et marques de
// direction (qui retourneraient l'affichage du sujet de l'e-mail).
const NAME_FORBIDDEN = /[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;
// Dans le message, les retours à la ligne et les tabulations restent permis.
const MESSAGE_FORBIDDEN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

/** Le nom tel qu'il sera envoyé : sans espace au bord, espaces internes réduits. */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function cleanEmail(value: string): string {
  return value.trim();
}

/**
 * Le message tel qu'il sera envoyé. Un formulaire envoyé sans JavaScript
 * transmet les retours à la ligne en \r\n : on les ramène à \n, pour que la
 * longueur soit la même que celle comptée dans le navigateur.
 */
export function cleanMessage(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

export function checkName(raw: string): FieldErrorCode | null {
  // Le contrôle porte sur le texte brut : un retour à la ligne dans un nom est refusé,
  // pas effacé.
  if (NAME_FORBIDDEN.test(raw.trim())) return 'invalid';
  const value = cleanName(raw);
  if (value.length < CONTACT_LIMITS.name.min) return 'required';
  if (value.length > CONTACT_LIMITS.name.max) return 'too_long';
  return null;
}

export function checkEmail(raw: string): FieldErrorCode | null {
  const value = cleanEmail(raw);
  if (value === '') return 'required';
  if (value.length > CONTACT_LIMITS.email.max) return 'too_long';
  if (!EMAIL_PATTERN.test(value)) return 'invalid';
  return null;
}

export function checkMessage(raw: string): FieldErrorCode | null {
  const value = cleanMessage(raw);
  if (value === '') return 'required';
  if (MESSAGE_FORBIDDEN.test(value)) return 'invalid';
  if (value.length < CONTACT_LIMITS.message.min) return 'too_short';
  if (value.length > CONTACT_LIMITS.message.max) return 'too_long';
  return null;
}

export const FIELD_CHECKS: Record<ContactField, (raw: string) => FieldErrorCode | null> = {
  name: checkName,
  email: checkEmail,
  message: checkMessage,
};

export type ContactValues = Record<ContactField, string>;

/** Vérifie les trois champs : les erreurs, dans l'ordre du formulaire. */
export function checkContactFields(
  values: ContactValues,
): Partial<Record<ContactField, FieldErrorCode>> {
  const errors: Partial<Record<ContactField, FieldErrorCode>> = {};
  for (const field of CONTACT_FIELDS) {
    const code = FIELD_CHECKS[field](values[field]);
    if (code) errors[field] = code;
  }
  return errors;
}

/** Longueur du message telle que le serveur la comptera. */
export function messageLength(raw: string): number {
  return cleanMessage(raw).length;
}

/**
 * L'état lisible par la page après un envoi sans JavaScript
 * (`?contact=envoye`, `?contact=erreur-validation`). Le même mot sert
 * d'ancre (`#contact-envoye`) : la page l'affiche par :target, sans script.
 */
export type ContactRedirectState = 'envoye' | `erreur-${ContactErrorCode}`;

export function redirectState(error: ContactErrorCode | null): ContactRedirectState {
  return error === null ? 'envoye' : `erreur-${error}`;
}

/** Tous les états possibles, pour que la page prépare chaque message. */
export const CONTACT_REDIRECT_STATES: ContactRedirectState[] = [
  'envoye',
  ...CONTACT_ERROR_CODES.map((code) => `erreur-${code}` as const),
];
