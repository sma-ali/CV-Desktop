import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD } from './route';

// La route des signes de vie, sans serveur : fetch global simulé, adresse du
// JSON public posée par variable d'environnement.

const NOW = Date.UTC(2026, 10, 2, 12, 0);
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const publicJson = {
  running: 2,
  lastActivityAt: iso(45),
  since: iso(60 * 24 * 30),
  activity: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3],
  measuredAt: iso(2),
  secret: 'ne sort pas',
};

describe('/api/signes-de-vie', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renvoie le JSON public filtré, en cache public, sans CORS', async () => {
    vi.stubEnv('LIFE_SIGNS_URL', 'https://example.test/vie.json');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(publicJson)),
    );
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const cache = response.headers.get('cache-control') ?? '';
    expect(cache).toContain('public');
    expect(cache).toContain('s-maxage=600');
    expect(cache).toContain('stale-while-revalidate');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    const expected: Partial<typeof publicJson> = { ...publicJson };
    delete expected.secret;
    expect(await response.json()).toEqual({ ...expected, sample: false });
  });

  it('retombe sur l’exemple, toujours en 200, quand la source échoue', async () => {
    vi.stubEnv('LIFE_SIGNS_URL', 'https://example.test/vie.json');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oups', { status: 500 })),
    );
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sample: boolean; measuredAt: string };
    expect(body.sample).toBe(true);
    expect(body.measuredAt).toBe(new Date(NOW).toISOString());
  });

  it('répond à HEAD avec les mêmes en-têtes, sans corps', async () => {
    vi.stubEnv('LIFE_SIGNS_URL', '');
    const response = await HEAD();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=600');
    expect(await response.text()).toBe('');
  });
});
