import type { Locale } from '@/content/locales';

// L'envoi du message par e-mail, derrière une interface : Mailjet en
// production, un « dry run » qui n'envoie rien en local et dans les tests.

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  locale: Locale;
}

export interface Mailer {
  /** Envoie le message ; lève une MailerError en cas d'échec. */
  send(message: ContactMessage): Promise<void>;
  /** Vrai pour le dry run : rien ne part vraiment. */
  readonly dryRun?: boolean;
}

export type MailerFailure = 'timeout' | 'network' | 'rejected' | 'unexpected';

/**
 * Un envoi raté. Le message d'erreur ne contient ni le texte du visiteur, ni
 * son adresse, ni une clé : seulement la cause, le statut HTTP et les codes
 * d'erreur de Mailjet (« mj-0002 »).
 */
export class MailerError extends Error {
  constructor(
    readonly reason: MailerFailure,
    readonly status?: number,
    readonly codes: string[] = [],
  ) {
    const detail = [status ? `HTTP ${status}` : null, ...codes].filter(Boolean).join(', ');
    super(`envoi refusé (${reason}${detail ? `, ${detail}` : ''})`);
    this.name = 'MailerError';
  }
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';
export const MAILJET_TIMEOUT_MS = 8000;

export interface MailjetOptions {
  apiKey: string;
  apiSecret: string;
  /** Destinataire : la boîte d'Ali (CONTACT_TO). */
  to: string;
  /** Expéditeur validé chez Mailjet (CONTACT_FROM). */
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const languageNames: Record<Locale, string> = { fr: 'français', en: 'anglais' };

/** Le sujet : « Message du site | Nom », le nom déjà nettoyé et borné. */
export function contactSubject(name: string): string {
  return `Message du site | ${name}`;
}

/** Le corps, en texte seul. */
export function contactText({ name, email, message, locale }: ContactMessage): string {
  return [
    `Nom : ${name}`,
    `E-mail : ${email}`,
    `Langue : ${languageNames[locale]}`,
    '',
    message,
    '',
  ].join('\n');
}

/**
 * La requête de l'API Send v3.1 de Mailjet
 * (https://dev.mailjet.com/email/guides/send-api-v31/) : un tableau Messages,
 * From et ReplyTo en { Email, Name }, To en tableau. Texte seul (TextPart,
 * aucune partie HTML), sans suivi des ouvertures ni des clics.
 */
export function mailjetPayload(
  message: ContactMessage,
  { to, from }: { to: string; from: string },
) {
  return {
    Messages: [
      {
        From: { Email: from, Name: 'alismaani.fr' },
        To: [{ Email: to }],
        ReplyTo: { Email: message.email, Name: message.name },
        Subject: contactSubject(message.name),
        TextPart: contactText(message),
        TrackOpens: 'disabled',
        TrackClicks: 'disabled',
      },
    ],
  };
}

interface MailjetError {
  ErrorCode?: unknown;
}

interface MailjetResponse {
  Messages?: { Status?: unknown; Errors?: MailjetError[] }[];
  ErrorCode?: unknown;
}

/** Les codes d'erreur d'une réponse Mailjet (globale ou par message), sans leurs textes. */
function errorCodes(body: MailjetResponse | null): string[] {
  if (!body) return [];
  const codes = [
    body.ErrorCode,
    ...(body.Messages ?? []).flatMap((m) => (m.Errors ?? []).map((e) => e.ErrorCode)),
  ];
  return codes.filter(
    (code): code is string => typeof code === 'string' && /^[\w-]{1,32}$/.test(code),
  );
}

export function createMailjetMailer(options: MailjetOptions): Mailer {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? MAILJET_TIMEOUT_MS;
  const authorization = `Basic ${Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString('base64')}`;

  return {
    async send(message) {
      let response: Response;
      try {
        response = await doFetch(MAILJET_SEND_URL, {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify(mailjetPayload(message, options)),
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        throw new MailerError(
          name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network',
        );
      }

      let body: MailjetResponse | null = null;
      try {
        body = (await response.json()) as MailjetResponse;
      } catch {
        body = null;
      }

      if (!response.ok) throw new MailerError('rejected', response.status, errorCodes(body));
      const status = body?.Messages?.[0]?.Status;
      if (status !== 'success') {
        throw new MailerError('unexpected', response.status, errorCodes(body));
      }
    },
  };
}

/** N'envoie rien : journalise seulement l'acceptation et la longueur du message. */
export function createDryRunMailer(logger: Logger): Mailer {
  return {
    dryRun: true,
    async send(message) {
      logger.info(`contact : message accepté (dry run), ${message.message.length} caractères`);
    },
  };
}
