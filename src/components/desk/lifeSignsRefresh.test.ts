import { describe, expect, it, vi } from 'vitest';
import { sampleLifeSigns, type LifeSigns } from '@/lib/life-signs';
import {
  createLifeSignsRefresher,
  isStale,
  LIFE_SIGNS_ENDPOINT,
  LIFE_SIGNS_RETRY_MS,
  LIFE_SIGNS_STALE_MS,
  toLifeSigns,
} from './lifeSignsRefresh';

// Le navigateur redemande les signes de vie à l'ouverture du coffret quand
// leur mesure a plus de 10 minutes ; en cas d'échec, il garde ce qu'il a.

const NOW = Date.UTC(2026, 10, 2, 12, 0);
const MINUTE = 60_000;

const real = (measuredMinutesAgo: number, now = NOW): LifeSigns => ({
  ...sampleLifeSigns(now - measuredMinutesAgo * MINUTE),
  running: 6,
  sample: false,
});

function setup(initial: LifeSigns | null, reply: () => Promise<Response>) {
  let now = NOW;
  const fetchMock = vi.fn<typeof fetch>(reply);
  const refresher = createLifeSignsRefresher(initial, { fetch: fetchMock, now: () => now });
  return { refresher, fetchMock, advance: (ms: number) => (now += ms) };
}

describe('la forme des signes de vie reçus', () => {
  it('garde seulement les champs connus', () => {
    const signs = real(1);
    expect(toLifeSigns({ ...signs, extra: 'non' })).toEqual(signs);
  });

  it('refuse une forme fausse', () => {
    const signs = real(1);
    expect(toLifeSigns(null)).toBeNull();
    expect(toLifeSigns('texte')).toBeNull();
    expect(toLifeSigns({ ...signs, running: -1 })).toBeNull();
    expect(toLifeSigns({ ...signs, activity: [1, 'deux'] })).toBeNull();
    expect(toLifeSigns({ ...signs, measuredAt: 'hier' })).toBeNull();
    expect(toLifeSigns({ ...signs, sample: undefined })).toBeNull();
  });
});

describe('l’âge de la mesure', () => {
  it('compte à partir de 10 minutes', () => {
    expect(LIFE_SIGNS_STALE_MS).toBe(10 * MINUTE);
    expect(isStale(real(9), NOW)).toBe(false);
    expect(isStale(real(10), NOW)).toBe(true);
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale({ ...real(1), measuredAt: '' }, NOW)).toBe(true);
  });
});

describe('le rafraîchissement à l’ouverture du coffret', () => {
  it('ne demande rien quand la mesure est récente', async () => {
    const { refresher, fetchMock } = setup(real(3), async () => Response.json(real(0)));
    expect(await refresher.refresh()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redemande une mesure vieille et rend la nouvelle', async () => {
    const fresh = real(0);
    const { refresher, fetchMock } = setup(real(15), async () => Response.json(fresh));
    expect(await refresher.refresh()).toEqual(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(LIFE_SIGNS_ENDPOINT);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    // La nouvelle mesure est récente : pas de seconde requête.
    expect(await refresher.refresh()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('garde ce qu’il a sur une erreur, un réseau coupé ou une forme fausse', async () => {
    for (const reply of [
      async () => new Response('oups', { status: 500 }),
      () => Promise.reject(new TypeError('réseau')),
      async () => Response.json({ running: 'trois' }),
      async () => new Response('pas du json'),
    ]) {
      const { refresher } = setup(real(30), reply);
      expect(await refresher.refresh()).toBeNull();
    }
  });

  it('ne réessaie pas avant une minute', async () => {
    const { refresher, fetchMock, advance } = setup(
      real(30),
      async () => new Response('', { status: 503 }),
    );
    await refresher.refresh();
    advance(LIFE_SIGNS_RETRY_MS - 1);
    await refresher.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(1);
    await refresher.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ne lance pas deux requêtes à la fois', async () => {
    let release: (response: Response) => void = () => undefined;
    const { refresher, fetchMock } = setup(
      real(30),
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const first = refresher.refresh();
    expect(await refresher.refresh()).toBeNull();
    release(Response.json(real(0)));
    expect(await first).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('préfère de vraies données un peu vieilles à l’exemple', async () => {
    const { refresher } = setup(real(30), async () => Response.json(sampleLifeSigns(NOW)));
    expect(await refresher.refresh()).toBeNull();
  });

  it('remplace l’exemple vieilli par de vraies données', async () => {
    const fresh = real(0);
    const { refresher } = setup(sampleLifeSigns(NOW - 60 * MINUTE), async () =>
      Response.json(fresh),
    );
    expect(await refresher.refresh()).toEqual(fresh);
  });
});
