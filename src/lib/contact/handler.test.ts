import { describe, expect, it, vi } from 'vitest';
import { handleContactPost, isAllowedOrigin, methodNotAllowed, type ContactDeps } from './handler';
import { MailerError, type Mailer } from './mailer';
import { createMemoryRateLimiter } from './rate-limit';
import { MAX_BODY_BYTES } from './rules';

const URL_ = 'http://localhost:3000/api/contact';

const valid = {
  name: 'Camille Martin',
  email: 'camille@exemple.fr',
  message: 'Bonjour, une question sur votre parcours.',
  locale: 'fr',
  typingMs: 12_000,
};

function setup(overrides: Partial<ContactDeps> & { mailer?: Mailer } = {}) {
  const send = vi.fn<Mailer['send']>(async () => {});
  const mailer = overrides.mailer ?? { send };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const deps: ContactDeps = {
    limiter: overrides.limiter ?? createMemoryRateLimiter(),
    resolveMailer: overrides.resolveMailer ?? (() => ({ ok: true, mailer })),
    now: overrides.now ?? (() => 1_000_000),
    logger,
  };
  return { deps, send, logger };
}

function post(
  body: string | object,
  headers: Record<string, string> = {},
  type = 'application/json',
): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': type,
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const form = (values: Record<string, string>) => new URLSearchParams(values).toString();
const FORM = 'application/x-www-form-urlencoded';

/** Tout ce que le journal a reçu, en une chaîne. */
function logged(logger: ReturnType<typeof setup>['logger']): string {
  return [logger.info, logger.warn, logger.error]
    .flatMap((fn) => fn.mock.calls.map((call) => String(call[0])))
    .join('\n');
}

describe('POST /api/contact en JSON', () => {
  it('envoie un message valide et répond { ok: true }', async () => {
    const { deps, send } = setup();
    const response = await handleContactPost(post(valid), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(send).toHaveBeenCalledWith({
      name: 'Camille Martin',
      email: 'camille@exemple.fr',
      message: 'Bonjour, une question sur votre parcours.',
      locale: 'fr',
    });
  });

  it('refuse un champ invalide avec un code par champ', async () => {
    const { deps, send } = setup();
    const response = await handleContactPost(
      post({ ...valid, email: 'camille', message: 'x' }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'validation',
      fields: { email: 'invalid', message: 'too_short' },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('refuse un JSON illisible ou qui n’est pas un objet', async () => {
    const { deps } = setup();
    for (const body of ['{pas du json', '[1, 2]', 'null']) {
      const response = await handleContactPost(post(body), deps);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: 'validation' });
    }
  });

  it('refuse un autre type de contenu (415)', async () => {
    const { deps } = setup();
    for (const type of ['text/plain', 'multipart/form-data; boundary=x']) {
      const response = await handleContactPost(post('x', {}, type), deps);
      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ ok: false, error: 'unsupported' });
    }
    // Le paramètre charset ne gêne pas.
    const response = await handleContactPost(
      post(valid, {}, 'application/json; charset=utf-8'),
      deps,
    );
    expect(response.status).toBe(200);
  });

  it('refuse un corps trop gros (413), annoncé ou non', async () => {
    const { deps, send } = setup();
    const big = { ...valid, message: 'a'.repeat(MAX_BODY_BYTES) };
    const response = await handleContactPost(post(big), deps);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: 'too_large' });

    // Sans Content-Length : le flux est coupé au-delà de la limite.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 20; i++) controller.enqueue(new Uint8Array(1024).fill(97));
        controller.close();
      },
    });
    const chunked = new Request(URL_, {
      method: 'POST',
      headers: { host: 'localhost:3000', 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await handleContactPost(chunked, deps)).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuse une origine étrangère (403), sans en-tête CORS', async () => {
    const { deps, send } = setup();
    const response = await handleContactPost(
      post(valid, { origin: 'https://exemple.invalid' }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'origin' });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('fait comme si de rien n’était quand le piège est rempli', async () => {
    const { deps, send, logger } = setup();
    const response = await handleContactPost(
      post({ ...valid, website: 'https://spam.example' }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(send).not.toHaveBeenCalled();
    expect(logged(logger)).toContain('piège');
    // Même un envoi par ailleurs invalide : on ne renseigne pas le robot.
    const invalid = await handleContactPost(post({ website: 'x' }), deps);
    expect(await invalid.json()).toEqual({ ok: true });
  });

  it('fait comme si de rien n’était quand la saisie est trop rapide', async () => {
    const { deps, send } = setup();
    const response = await handleContactPost(post({ ...valid, typingMs: 2999 }), deps);
    expect(await response.json()).toEqual({ ok: true });
    expect(send).not.toHaveBeenCalled();
    await handleContactPost(post({ ...valid, typingMs: 3000 }), deps);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('répond 429 avec Retry-After au-delà de 5 envois par IP', async () => {
    const { deps, send } = setup();
    for (let i = 0; i < 5; i++) {
      expect((await handleContactPost(post(valid), deps)).status).toBe(200);
    }
    const response = await handleContactPost(post(valid), deps);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('600');
    expect(await response.json()).toEqual({ ok: false, error: 'rate_limited' });
    expect(send).toHaveBeenCalledTimes(5);
    // Une autre IP passe encore.
    const other = await handleContactPost(post(valid, { 'x-forwarded-for': '198.51.100.2' }), deps);
    expect(other.status).toBe(200);
  });

  it('ne compte pas les envois refusés par la validation', async () => {
    const { deps } = setup({
      limiter: createMemoryRateLimiter({ perKey: { max: 1, windowMs: 60_000 } }),
    });
    for (let i = 0; i < 3; i++) await handleContactPost(post({ ...valid, email: 'x' }), deps);
    expect((await handleContactPost(post(valid), deps)).status).toBe(200);
  });

  it('répond 503 quand l’envoi n’est pas configuré, en nommant les variables', async () => {
    const { deps, logger } = setup({
      resolveMailer: () => ({ ok: false, problems: ['CONTACT_TO', 'MAILJET_API_KEY'] }),
    });
    const response = await handleContactPost(post(valid), deps);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'unavailable' });
    expect(logged(logger)).toContain('CONTACT_TO, MAILJET_API_KEY');
  });

  it('répond 502 quand Mailjet refuse, sans rien du visiteur dans le journal', async () => {
    const mailer: Mailer = {
      send: async () => {
        throw new MailerError('rejected', 401, ['mj-0015']);
      },
    };
    const { deps, logger } = setup({ mailer });
    const response = await handleContactPost(post(valid), deps);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: 'send_failed' });
    const journal = logged(logger);
    expect(journal).toContain('mj-0015');
    expect(journal).not.toContain('camille');
    expect(journal).not.toContain('Bonjour');
  });
});

describe('POST /api/contact sans JavaScript (formulaire HTML)', () => {
  const fields = {
    name: 'Camille',
    email: 'camille@exemple.fr',
    message: 'Bonjour, une question.',
  };

  it('redirige (303) vers la version express avec l’état envoyé', async () => {
    const { deps, send } = setup();
    const response = await handleContactPost(
      post(form({ ...fields, locale: 'en', from: 'express' }), {}, FORM),
      deps,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/en/express?contact=envoye#contact-envoye');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('revient au bureau quand le formulaire en vient', async () => {
    const { deps } = setup();
    const response = await handleContactPost(
      post(form({ ...fields, locale: 'fr', from: 'desk' }), {}, FORM),
      deps,
    );
    expect(response.headers.get('location')).toBe('/fr?contact=envoye#contact-envoye');
  });

  it('ramène les retours à la ligne \\r\\n du navigateur à \\n', async () => {
    const { deps, send } = setup();
    await handleContactPost(
      post(form({ ...fields, message: 'Ligne 1\r\nLigne 2 et la suite', locale: 'fr' }), {}, FORM),
      deps,
    );
    expect(send.mock.calls[0]![0].message).toBe('Ligne 1\nLigne 2 et la suite');
  });

  it('redirige avec le code de l’erreur', async () => {
    const { deps } = setup({ resolveMailer: () => ({ ok: false, problems: ['CONTACT_TO'] }) });
    const invalid = await handleContactPost(
      post(form({ ...fields, email: 'x', locale: 'fr' }), {}, FORM),
      deps,
    );
    expect(invalid.status).toBe(303);
    expect(invalid.headers.get('location')).toBe(
      '/fr/express?contact=erreur-validation#contact-erreur-validation',
    );
    const unavailable = await handleContactPost(
      post(form({ ...fields, locale: 'fr' }), {}, FORM),
      deps,
    );
    expect(unavailable.headers.get('location')).toContain('contact=erreur-unavailable');
  });

  it('redirige un corps trop gros vers la version express française', async () => {
    const { deps } = setup();
    const response = await handleContactPost(
      post(form({ ...fields, message: 'a'.repeat(MAX_BODY_BYTES), locale: 'en' }), {}, FORM),
      deps,
    );
    expect(response.headers.get('location')).toBe(
      '/fr/express?contact=erreur-too_large#contact-erreur-too_large',
    );
  });

  it('garde Retry-After sur la redirection d’un envoi limité', async () => {
    const { deps } = setup({
      limiter: createMemoryRateLimiter({ perKey: { max: 1, windowMs: 60_000 } }),
    });
    await handleContactPost(post(form({ ...fields, locale: 'fr' }), {}, FORM), deps);
    const response = await handleContactPost(
      post(form({ ...fields, locale: 'fr' }), {}, FORM),
      deps,
    );
    expect(response.headers.get('location')).toContain('erreur-rate_limited');
    expect(response.headers.get('retry-after')).toBe('60');
  });

  it('accepte un formulaire sans durée de saisie (pas de JavaScript)', async () => {
    const { deps, send } = setup();
    await handleContactPost(post(form({ ...fields, locale: 'fr', website: '' }), {}, FORM), deps);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('origine', () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it('accepte le site, l’hôte de la requête et l’absence d’Origin', () => {
    expect(isAllowedOrigin(headers({ origin: 'https://alismaani.fr', host: 'x.vercel.app' }))).toBe(
      true,
    );
    expect(
      isAllowedOrigin(headers({ origin: 'https://cv-x.vercel.app', host: 'cv-x.vercel.app' })),
    ).toBe(true);
    expect(isAllowedOrigin(headers({ host: 'alismaani.fr' }))).toBe(true);
  });

  it('refuse toute autre origine, « null » compris', () => {
    for (const origin of [
      'https://exemple.invalid',
      'null',
      'http://alismaani.fr',
      'https://alismaani.fr.evil.test',
    ]) {
      expect(isAllowedOrigin(headers({ origin, host: 'alismaani.fr' })), origin).toBe(false);
    }
  });
});

describe('autres méthodes', () => {
  it('répondent 405 avec Allow: POST', async () => {
    const response = methodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await response.json()).toEqual({ ok: false, error: 'unsupported' });
  });
});
