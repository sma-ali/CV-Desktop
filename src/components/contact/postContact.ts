import {
  CONTACT_ERROR_CODES,
  CONTACT_FIELDS,
  type ContactErrorCode,
  type ContactField,
  type ContactResponse,
  type FieldErrorCode,
} from '@/lib/contact/rules';

// L'envoi du formulaire de contact par fetch, côté navigateur : la requête
// JSON vers /api/contact et la lecture de sa réponse, quelle qu'elle soit.

export type FieldErrors = Partial<Record<ContactField, FieldErrorCode>>;

function isErrorCode(value: unknown): value is ContactErrorCode {
  return (CONTACT_ERROR_CODES as readonly unknown[]).includes(value);
}

/** Le code d'une réponse sans corps lisible, d'après son statut. */
function codeOfStatus(status: number): ContactErrorCode {
  if (status === 400) return 'validation';
  if (status === 403) return 'origin';
  if (status === 413) return 'too_large';
  if (status === 415 || status === 405) return 'unsupported';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  return 'send_failed';
}

type SendResult =
  { ok: true } | { ok: false; code: ContactErrorCode | 'network'; fields: FieldErrors };

/**
 * Envoie le message en JSON à /api/contact et lit la réponse : le code
 * d'erreur et les champs refusés viennent du corps, ou à défaut du statut.
 */
export async function postContact(body: Record<string, unknown>): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: 'network', fields: {} };
  }

  let result: ContactResponse | null = null;
  try {
    result = (await response.json()) as ContactResponse;
  } catch {
    result = null;
  }
  if (response.ok && result?.ok) return { ok: true };

  const code =
    result && !result.ok && isErrorCode(result.error)
      ? result.error
      : codeOfStatus(response.status);
  const fields: FieldErrors = {};
  if (result && !result.ok && result.fields) {
    for (const field of CONTACT_FIELDS) {
      const fieldCode = result.fields[field];
      if (fieldCode) fields[field] = fieldCode;
    }
  }
  return { ok: false, code, fields };
}
