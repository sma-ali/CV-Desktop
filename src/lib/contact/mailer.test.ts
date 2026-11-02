import { describe, expect, it, vi } from 'vitest';
import {
  contactSubject,
  contactText,
  createDryRunMailer,
  createMailjetMailer,
  MAILJET_SEND_URL,
  MailerError,
  type ContactMessage,
} from './mailer';

const message: ContactMessage = {
  name: 'Camille Martin',
  email: 'camille@exemple.fr',
  message: 'Bonjour,\nune question sur votre parcours.',
  locale: 'en',
};

const options = {
  apiKey: 'cle-test',
  apiSecret: 'secret-test',
  to: 'boite@exemple.fr',
  from: 'site@exemple.fr',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SUCCESS = {
  Messages: [{ Status: 'success', To: [{ Email: 'boite@exemple.fr', MessageID: 1 }] }],
};

function fakeFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

describe('Mailjet', () => {
  it('envoie la requête exacte de l’API Send v3.1', async () => {
    const fetchMock = fakeFetch(jsonResponse(SUCCESS));
    await createMailjetMailer({ ...options, fetch: fetchMock }).send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(MAILJET_SEND_URL);
    expect(url).toBe('https://api.mailjet.com/v3.1/send');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('cle-test:secret-test').toString('base64')}`,
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      Messages: [
        {
          From: { Email: 'site@exemple.fr', Name: 'alismaani.fr' },
          To: [{ Email: 'boite@exemple.fr' }],
          ReplyTo: { Email: 'camille@exemple.fr', Name: 'Camille Martin' },
          Subject: 'Message du site | Camille Martin',
          TextPart:
            'Nom : Camille Martin\nE-mail : camille@exemple.fr\nLangue : anglais\n\nBonjour,\nune question sur votre parcours.\n',
          TrackOpens: 'disabled',
          TrackClicks: 'disabled',
        },
      ],
    });
    // Texte seul : aucune partie HTML.
    expect(String(init?.body)).not.toContain('HTMLPart');
  });

  it('écrit le sujet et le corps', () => {
    expect(contactSubject('Camille')).toBe('Message du site | Camille');
    expect(contactText({ ...message, locale: 'fr' })).toContain('Langue : français');
  });

  it('remonte un refus avec son statut et ses codes, sans les textes de Mailjet', async () => {
    const body = {
      Messages: [
        {
          Status: 'error',
          Errors: [
            {
              ErrorCode: 'mj-0013',
              StatusCode: 400,
              ErrorMessage: '"camille@exemple.fr" is an invalid email address.',
              ErrorRelatedTo: ['ReplyTo'],
            },
          ],
        },
      ],
    };
    const mailer = createMailjetMailer({ ...options, fetch: fakeFetch(jsonResponse(body, 400)) });
    const error = await mailer.send(message).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MailerError);
    expect(error).toMatchObject({ reason: 'rejected', status: 400, codes: ['mj-0013'] });
    expect((error as Error).message).not.toContain('camille');
  });

  it('remonte une erreur globale (clés refusées)', async () => {
    const body = { ErrorCode: 'mj-0015', StatusCode: 401, ErrorMessage: 'API key authentication' };
    const mailer = createMailjetMailer({ ...options, fetch: fakeFetch(jsonResponse(body, 401)) });
    await expect(mailer.send(message)).rejects.toMatchObject({
      reason: 'rejected',
      status: 401,
      codes: ['mj-0015'],
    });
  });

  it('refuse une réponse 200 sans succès', async () => {
    const mailer = createMailjetMailer({
      ...options,
      fetch: fakeFetch(new Response('pas du JSON', { status: 200 })),
    });
    await expect(mailer.send(message)).rejects.toMatchObject({ reason: 'unexpected' });
  });

  it('distingue le délai dépassé et l’erreur réseau', async () => {
    const timeout = new DOMException('signal timed out', 'TimeoutError');
    await expect(
      createMailjetMailer({ ...options, fetch: fakeFetch(timeout) }).send(message),
    ).rejects.toMatchObject({ reason: 'timeout' });
    await expect(
      createMailjetMailer({ ...options, fetch: fakeFetch(new TypeError('fetch failed')) }).send(
        message,
      ),
    ).rejects.toMatchObject({ reason: 'network' });
  });

  it('coupe une requête trop lente', async () => {
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const mailer = createMailjetMailer({ ...options, fetch: hanging, timeoutMs: 20 });
    await expect(mailer.send(message)).rejects.toMatchObject({ reason: 'timeout' });
  });
});

describe('dry run', () => {
  it('n’envoie rien et ne journalise que la longueur', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await createDryRunMailer(logger).send(message);
    expect(logger.info).toHaveBeenCalledTimes(1);
    const line = String(logger.info.mock.calls[0]![0]);
    expect(line).toContain('message accepté (dry run)');
    expect(line).toContain(String(message.message.length));
    expect(line).not.toContain('camille');
    expect(line).not.toContain('Bonjour');
  });
});
