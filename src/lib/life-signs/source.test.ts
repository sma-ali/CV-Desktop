import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleLifeSigns } from './sample';
import { LIFE_SIGNS_FUTURE_MARGIN_MS, parsePublicLifeSigns } from './schema';
import {
  getLifeSigns,
  LIFE_SIGNS_MAX_BYTES,
  LIFE_SIGNS_REVALIDATE_S,
  readLifeSigns,
  type LifeSignsSourceOptions,
} from './source';

// Le cache de Next n'existe pas hors du serveur : unstable_cache est
// remplacé par un cache en mémoire qui, comme le vrai, garde un résultat et
// jamais une erreur. Ses réglages sont gardés pour les vérifier.
const nextCache = vi.hoisted(() => ({
  calls: [] as { keyParts: string[] | undefined; options: unknown }[],
  stored: new Map<string, unknown>(),
}));
vi.mock('next/cache', () => ({
  unstable_cache: <T>(
    fn: () => Promise<T>,
    keyParts?: string[],
    options?: { revalidate?: number },
  ) => {
    nextCache.calls.push({ keyParts, options });
    const key = (keyParts ?? []).join(',');
    return async () => {
      if (nextCache.stored.has(key)) return nextCache.stored.get(key) as T;
      const value = await fn();
      nextCache.stored.set(key, value);
      return value;
    };
  },
}));

// La lecture du JSON public des signes de vie : fetch simulé, jamais de
// réseau. Chaque cause d'échec retombe sur les données d'exemple, et le
// journal la dit sans jamais citer l'adresse.

const NOW = Date.UTC(2026, 10, 2, 12, 0);
const MINUTE = 60_000;
const URL_ = 'https://example.test/signes/vie.json';
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * MINUTE).toISOString();

const valid = {
  running: 4,
  lastActivityAt: iso(30),
  since: iso(60 * 24 * 90),
  activity: [1, 0, 2, 3, 0, 0, 5, 4, 2, 1, 0, 6, 3, 2],
  measuredAt: iso(5),
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function setup(response: Response | (() => Promise<Response>)) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    typeof response === 'function' ? response() : response,
  );
  const log = vi.fn<(message: string) => void>();
  const options: LifeSignsSourceOptions = { url: URL_, fetch: fetchMock, log, cache: false };
  return { fetchMock, log, options };
}

describe('la lecture du JSON public', () => {
  it('rend les vrais signes de vie, sans la mention d’exemple', async () => {
    const { options, log } = setup(jsonResponse(valid));
    expect(await getLifeSigns(NOW, options)).toEqual({ ...valid, sample: false });
    expect(log).not.toHaveBeenCalled();
  });

  it('lit hors du cache de fetch de Next, avec un délai et sans redirection', async () => {
    const { options, fetchMock } = setup(jsonResponse(valid));
    await getLifeSigns(NOW, options);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe(URL_);
    // Le cache de fetch lirait tout le corps avant la borne de taille.
    expect(init?.cache).toBe('no-store');
    expect(init?.next).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.redirect).toBe('error');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('ne laisse sortir que les champs connus', async () => {
    const extra = {
      ...valid,
      sample: true,
      projects: ['secret'],
      host: 'machine.interne',
      nested: { token: 'x' },
    };
    const { options } = setup(jsonResponse(extra));
    const signs = await getLifeSigns(NOW, options);
    expect(Object.keys(signs).sort()).toEqual(
      ['activity', 'lastActivityAt', 'measuredAt', 'running', 'sample', 'since'].sort(),
    );
    expect(signs.sample).toBe(false);
    expect(JSON.stringify(signs)).not.toMatch(/secret|machine|token/);
  });

  it('ramène les dates en UTC', async () => {
    const { options } = setup(jsonResponse({ ...valid, measuredAt: '2026-11-02T12:55:00+01:00' }));
    const signs = await getLifeSigns(NOW, options);
    expect(signs.measuredAt).toBe('2026-11-02T11:55:00.000Z');
  });

  it('lit l’adresse dans LIFE_SIGNS_URL par défaut', async () => {
    vi.stubEnv('LIFE_SIGNS_URL', URL_);
    try {
      const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(valid));
      const result = await readLifeSigns(NOW, { fetch: fetchMock, cache: false });
      expect(result.ok).toBe(true);
      expect(String(fetchMock.mock.calls[0]![0])).toBe(URL_);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('le repli sur les données d’exemple', () => {
  const cases: {
    name: string;
    reason: string;
    url?: string;
    response?: Response | (() => Promise<Response>);
  }[] = [
    { name: 'sans adresse', reason: 'missing_url', url: '' },
    { name: 'avec une adresse illisible', reason: 'invalid_url', url: 'pas une adresse' },
    { name: 'avec une adresse en http', reason: 'invalid_url', url: 'http://example.test/v.json' },
    {
      name: 'sur une erreur HTTP',
      reason: 'http_error',
      response: jsonResponse({ error: 'x' }, { status: 503 }),
    },
    {
      name: 'sur une erreur réseau',
      reason: 'network',
      response: () => Promise.reject(new TypeError('fetch failed')),
    },
    {
      name: 'sur un JSON illisible',
      reason: 'invalid_json',
      response: jsonResponse('{"running": 3,'),
    },
    {
      name: 'sur un corps annoncé trop gros',
      reason: 'too_large',
      response: jsonResponse(valid, {
        headers: { 'Content-Length': String(LIFE_SIGNS_MAX_BYTES + 1) },
      }),
    },
    {
      name: 'sur un corps trop gros sans taille annoncée',
      reason: 'too_large',
      response: jsonResponse({ ...valid, padding: 'x'.repeat(LIFE_SIGNS_MAX_BYTES) }),
    },
    {
      name: 'sur un format faux',
      reason: 'invalid_format',
      response: jsonResponse({ ...valid, running: -1 }),
    },
  ];

  for (const { name, reason, url, response } of cases) {
    it(name, async () => {
      const { options, log, fetchMock } = setup(response ?? jsonResponse(valid));
      if (url !== undefined) options.url = url;
      expect(await getLifeSigns(NOW, options)).toEqual(sampleLifeSigns(NOW));
      expect(log).toHaveBeenCalledTimes(1);
      const message = log.mock.calls[0]![0];
      expect(message).toContain(reason);
      expect(message).not.toContain('example.test');
      if (url !== undefined) expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('sur un délai dépassé', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const log = vi.fn<(message: string) => void>();
    const signs = await getLifeSigns(NOW, {
      url: URL_,
      fetch: fetchMock,
      log,
      timeoutMs: 20,
      cache: false,
    });
    expect(signs).toEqual(sampleLifeSigns(NOW));
    expect(log.mock.calls[0]![0]).toContain('timeout');
  });

  it('dit quels champs sont faux, jamais leurs valeurs', async () => {
    const { options, log } = setup(jsonResponse({ ...valid, running: 'secret' }));
    await getLifeSigns(NOW, options);
    const message = log.mock.calls[0]![0];
    expect(message).toContain('running');
    expect(message).not.toContain('secret');
  });
});

describe('le cache des signes de vie validés', () => {
  afterEach(() => {
    nextCache.stored.clear();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function source(responses: (() => Response)[]) {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.stubEnv('LIFE_SIGNS_URL', URL_);
    const fetchMock = vi.fn<typeof fetch>(async () => {
      const next = responses.shift();
      if (!next) throw new TypeError('fetch failed');
      return next();
    });
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.fn<(message: string) => void>();
    return { fetchMock, log };
  }

  it('garde le résultat validé 10 minutes, sous une clé sans l’adresse', async () => {
    const { fetchMock, log } = source([() => jsonResponse(valid), () => jsonResponse(valid)]);
    expect(await getLifeSigns(NOW, { log })).toEqual({ ...valid, sample: false });
    expect(await getLifeSigns(NOW, { log })).toEqual({ ...valid, sample: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nextCache.calls).toHaveLength(1);
    const { keyParts, options } = nextCache.calls[0]!;
    expect(options).toEqual({ revalidate: LIFE_SIGNS_REVALIDATE_S });
    expect(LIFE_SIGNS_REVALIDATE_S).toBe(600);
    expect(JSON.stringify(keyParts)).not.toContain('example.test');
    expect(log).not.toHaveBeenCalled();
  });

  it('ne garde jamais un échec : la lecture suivante réessaie', async () => {
    const { fetchMock, log } = source([
      () => jsonResponse({ error: 'x' }, { status: 503 }),
      () => jsonResponse(valid),
    ]);
    expect(await getLifeSigns(NOW, { log })).toEqual(sampleLifeSigns(NOW));
    expect(log.mock.calls[0]![0]).toContain('http_error');
    expect(log.mock.calls[0]![0]).not.toContain('example.test');
    expect(await getLifeSigns(NOW, { log })).toEqual({ ...valid, sample: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('borne la lecture même par le cache : un gros fichier n’est pas gardé', async () => {
    const big = () => jsonResponse({ ...valid, padding: 'x'.repeat(LIFE_SIGNS_MAX_BYTES) });
    const { log } = source([big]);
    expect(await getLifeSigns(NOW, { log })).toEqual(sampleLifeSigns(NOW));
    expect(log.mock.calls[0]![0]).toContain('too_large');
    expect(nextCache.stored.size).toBe(0);
  });
});

describe('le schéma du JSON public', () => {
  const parse = (data: unknown) => parsePublicLifeSigns(data, NOW);
  const issues = (data: unknown) => {
    const result = parse(data);
    return result.ok ? [] : result.issues;
  };

  it('accepte le format attendu', () => {
    expect(parse(valid)).toEqual({ ok: true, signs: { ...valid, sample: false } });
  });

  it('refuse des nombres négatifs, décimaux ou absents', () => {
    expect(issues({ ...valid, running: -1 })).toEqual(['running']);
    expect(issues({ ...valid, running: 1.5 })).toEqual(['running']);
    expect(issues({ ...valid, activity: [...valid.activity.slice(1), -2] })).toEqual([
      'activity.13',
    ]);
    const withoutRunning: Partial<typeof valid> = { ...valid };
    delete withoutRunning.running;
    expect(issues(withoutRunning)).toEqual(['running']);
  });

  it('veut exactement 14 jours d’activité', () => {
    expect(issues({ ...valid, activity: valid.activity.slice(1) })).toEqual(['activity']);
    expect(issues({ ...valid, activity: [...valid.activity, 1] })).toEqual(['activity']);
  });

  it('veut des instants ISO 8601 avec fuseau', () => {
    expect(issues({ ...valid, since: '2026-08-01' })).toEqual(['since']);
    expect(issues({ ...valid, since: '2026-08-01T10:00:00' })).toEqual(['since']);
    expect(issues({ ...valid, measuredAt: 'hier' })).toEqual(['measuredAt']);
  });

  it('veut des dates dans l’ordre', () => {
    expect(issues({ ...valid, since: iso(10) })).toEqual(['since']);
    expect(issues({ ...valid, lastActivityAt: iso(1) })).toEqual(['lastActivityAt']);
  });

  it('tolère une mesure un peu dans le futur, pas au delà de la marge', () => {
    const soon = new Date(NOW + LIFE_SIGNS_FUTURE_MARGIN_MS - MINUTE).toISOString();
    const late = new Date(NOW + LIFE_SIGNS_FUTURE_MARGIN_MS + MINUTE).toISOString();
    expect(parse({ ...valid, measuredAt: soon }).ok).toBe(true);
    expect(issues({ ...valid, measuredAt: late })).toEqual(['measuredAt']);
  });

  it('refuse ce qui n’est pas un objet', () => {
    expect(issues(null)).toEqual(['(racine)']);
    expect(issues([valid])).toEqual(['(racine)']);
  });
});
