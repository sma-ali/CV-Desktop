import { isLocale, type Locale } from '@/content/locales';
import { deskPath, expressPath, SITE_ORIGIN } from '@/lib/site';
import { MailerError, type Logger, type Mailer } from './mailer';
import { clientKey, type RateLimiter } from './rate-limit';
import {
  HONEYPOT_FIELD,
  MAX_BODY_BYTES,
  MIN_TYPING_MS,
  redirectState,
  type ContactErrorCode,
  type ContactResponse,
  type ContactSource,
  type FieldErrorCode,
} from './rules';
import { contactRequestSchema, fieldErrors } from './schema';

// Le traitement d'un POST sur /api/contact, sans dépendance à Next : la route
// lui passe la requête et ses outils (limite de débit, envoi, horloge,
// journal), les tests aussi.

export type MailerResolution = { ok: true; mailer: Mailer } | { ok: false; problems: string[] };

export interface ContactDeps {
  /** Les envois : par IP et pour toute l'instance (quota d'envoi). */
  limiter: RateLimiter;
  /** Les tentatives, valides ou non, par IP, comptées avant la lecture du corps. */
  attemptLimiter: RateLimiter;
  /** L'envoi configuré, ou la liste des variables qui manquent. */
  resolveMailer: () => MailerResolution;
  now: () => number;
  logger: Logger;
}

type BodyKind = 'json' | 'form';

const STATUS: Record<ContactErrorCode, number> = {
  validation: 400,
  origin: 403,
  rate_limited: 429,
  too_large: 413,
  unsupported: 415,
  unavailable: 503,
  send_failed: 502,
};

/**
 * En dry run seulement, l'en-tête posé sur un envoi passé par le mailer :
 * les tests de bout en bout distinguent ainsi un vrai envoi d'un succès de
 * façade (piège, saisie trop rapide), qui ne le porte jamais. Hors dry run,
 * il n'existe pas : rien ne renseigne un robot.
 */
export const DRY_RUN_HEADER = 'X-Contact-Dry-Run';

/** Méthodes acceptées, pour l'en-tête Allow des réponses 405. */
const ALLOWED_METHODS = 'POST';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: ContactResponse, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** Réponse 405 des autres méthodes. */
export function methodNotAllowed(): Response {
  return json({ ok: false, error: 'unsupported' }, 405, { Allow: ALLOWED_METHODS });
}

interface Target {
  locale: Locale;
  from: ContactSource;
}

/**
 * Réponse d'un formulaire envoyé sans JavaScript : 303 vers la page
 * d'origine, avec l'état en paramètre et en ancre (« ?contact=envoye#contact-envoye »).
 */
function redirect(
  target: Target,
  error: ContactErrorCode | null,
  headers: Record<string, string> = {},
) {
  const path = target.from === 'desk' ? deskPath(target.locale) : expressPath(target.locale);
  const state = redirectState(error);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${path}?contact=${state}#contact-${state}`,
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function fail(
  kind: BodyKind,
  target: Target,
  error: ContactErrorCode,
  extra: {
    fields?: Partial<Record<string, FieldErrorCode>>;
    headers?: Record<string, string>;
  } = {},
) {
  if (kind === 'form') return redirect(target, error, extra.headers);
  const body: ContactResponse = extra.fields
    ? { ok: false, error, fields: extra.fields }
    : { ok: false, error };
  return json(body, STATUS[error], extra.headers);
}

function succeed(kind: BodyKind, target: Target, headers: Record<string, string> = {}) {
  return kind === 'form' ? redirect(target, null, headers) : json({ ok: true }, 200, headers);
}

/**
 * L'origine est-elle le site ? Un POST sans en-tête Origin passe (certains
 * clients ne l'envoient pas, et la limite de débit tient toujours) ; une
 * origine présente doit être celle du site (SITE_URL) ou l'hôte de la
 * requête (local, aperçus Vercel), en HTTPS hors local.
 */
export function isAllowedOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (origin === null) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // « null » et toute valeur illisible
  }
  if (url.origin === SITE_ORIGIN.origin) return true;
  const host = headers.get('host');
  if (host === null || url.host !== host) return false;
  // En HTTP seulement en local ; partout ailleurs, HTTPS.
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.hostname));
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function bodyKind(headers: Headers): BodyKind | null {
  const type = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (type === 'application/json') return 'json';
  if (type === 'application/x-www-form-urlencoded') return 'form';
  return null;
}

/** Lit le corps, MAX_BODY_BYTES au plus ; null s'il est plus gros. */
async function readBody(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseBody(kind: BodyKind, text: string): Record<string, unknown> | null {
  if (kind === 'form') return Object.fromEntries(new URLSearchParams(text));
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Le piège contient-il quelque chose ? Absent, null ou texte blanc : non. */
function isTrapFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return typeof value !== 'string' || value.trim() !== '';
}

/** Où renvoyer un formulaire sans JavaScript, même quand le reste est invalide. */
function targetOf(raw: Record<string, unknown> | null): Target {
  const locale = typeof raw?.locale === 'string' && isLocale(raw.locale) ? raw.locale : 'fr';
  const from = raw?.from === 'desk' ? 'desk' : 'express';
  return { locale, from };
}

export async function handleContactPost(request: Request, deps: ContactDeps): Promise<Response> {
  const { logger } = deps;
  const fallbackTarget: Target = { locale: 'fr', from: 'express' };

  // Jamais d'en-tête CORS : une autre origine est refusée, sans explication.
  if (!isAllowedOrigin(request.headers)) {
    logger.warn('contact : origine refusée');
    return json({ ok: false, error: 'origin' }, 403);
  }

  const kind = bodyKind(request.headers);
  if (kind === null) return json({ ok: false, error: 'unsupported' }, 415);

  const key = clientKey(request.headers);
  const attempt = deps.attemptLimiter.hit(key, deps.now());
  if (!attempt.ok) {
    logger.warn('contact : trop de tentatives');
    return fail(kind, fallbackTarget, 'rate_limited', {
      headers: { 'Retry-After': String(attempt.retryAfterSeconds) },
    });
  }

  const text = await readBody(request, MAX_BODY_BYTES);
  if (text === null) return fail(kind, fallbackTarget, 'too_large');

  const raw = parseBody(kind, text);
  const target = targetOf(raw);
  if (raw === null) return fail(kind, target, 'validation');

  // Le piège rempli : même réponse qu'un succès, rien n'est envoyé. Toute
  // valeur compte, quel que soit son type : une erreur de validation sur ce
  // champ dirait au robot lequel éviter.
  if (isTrapFilled(raw[HONEYPOT_FIELD])) {
    logger.info('contact : piège à robots rempli, rien envoyé');
    return succeed(kind, target);
  }

  const parsed = contactRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(kind, target, 'validation', { fields: fieldErrors(parsed.error) });
  }
  const data = parsed.data;

  // Saisie trop rapide pour un humain : succès apparent, rien n'est envoyé.
  // Le formulaire envoie toujours la durée en JSON : son absence trahit un
  // robot. Sans JavaScript (formulaire HTML), elle manque forcément.
  const typingMs = data.typingMs ?? (kind === 'json' ? 0 : undefined);
  if (typingMs !== undefined && typingMs < MIN_TYPING_MS) {
    logger.info('contact : saisie trop rapide, rien envoyé');
    return succeed(kind, target);
  }

  const resolved = deps.resolveMailer();
  if (!resolved.ok) {
    logger.error(`contact : envoi non configuré (${resolved.problems.join(', ')})`);
    return fail(kind, target, 'unavailable');
  }

  const limit = deps.limiter.hit(key, deps.now());
  if (!limit.ok) {
    logger.warn('contact : limite de débit atteinte');
    return fail(kind, target, 'rate_limited', {
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  try {
    await resolved.mailer.send({
      name: data.name,
      email: data.email,
      message: data.message,
      locale: data.locale,
    });
  } catch (error) {
    const reason = error instanceof MailerError ? error.message : 'erreur inattendue';
    logger.error(`contact : ${reason}`);
    return fail(kind, target, 'send_failed');
  }
  return succeed(kind, target, resolved.mailer.dryRun ? { [DRY_RUN_HEADER]: 'sent' } : {});
}
