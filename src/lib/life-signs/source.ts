import { unstable_cache } from 'next/cache';
import { readLifeSignsUrl } from '@/lib/env/server';
import { sampleLifeSigns } from './sample';
import { parsePublicLifeSigns } from './schema';
import type { LifeSigns } from './types';

// Le point d'entrée des signes de vie côté serveur, partagé par la page du
// bureau et /api/signes-de-vie. Il lit le JSON public dont l'adresse est dans
// LIFE_SIGNS_URL (variable serveur, jamais envoyée au navigateur), le valide
// (schema.ts) et ne garde que les champs connus. Au moindre échec, il
// retombe sur les données d'exemple, signalées comme telles : jamais
// d'erreur vers le visiteur. Le journal dit la cause, jamais l'adresse.

// La variable vient du module d'environnement du serveur (src/lib/env), dont
// la garde empêche aussi ce module d'entrer dans le navigateur.
//
// Le cache : la lecture elle-même passe hors du cache de fetch de Next
// (cache: 'no-store'), qui lirait tout le corps avant notre borne de taille,
// retirerait le délai pendant un renouvellement en arrière-plan et citerait
// l'adresse dans ses messages. C'est le résultat validé, quelques centaines
// d'octets, qui est gardé 10 minutes (unstable_cache). Un échec n'est jamais
// gardé : la lecture suivante réessaie.

/** Durée de vie des signes de vie validés dans le cache de Next, en secondes. */
export const LIFE_SIGNS_REVALIDATE_S = 600;
/**
 * L'en-tête de cache de /api/signes-de-vie : le CDN garde la réponse 10
 * minutes, puis la sert encore un jour le temps de la renouveler.
 */
export const LIFE_SIGNS_CACHE_CONTROL = `public, max-age=0, s-maxage=${LIFE_SIGNS_REVALIDATE_S}, stale-while-revalidate=86400`;
/**
 * L'en-tête des données d'exemple servies après un échec : 30 secondes au
 * CDN seulement, pour qu'une panne passagère de la source ne reste pas
 * affichée 10 minutes.
 */
export const LIFE_SIGNS_FALLBACK_CACHE_CONTROL = 'public, max-age=0, s-maxage=30';
/** Délai maximal de la lecture, en millisecondes. */
export const LIFE_SIGNS_TIMEOUT_MS = 3000;
/** Taille maximale lue, en octets (le JSON attendu en fait quelques centaines). */
export const LIFE_SIGNS_MAX_BYTES = 32 * 1024;

/** Pourquoi la lecture a échoué (codes du journal). */
export type LifeSignsFailure =
  | 'missing_url'
  | 'invalid_url'
  | 'http_error'
  | 'timeout'
  | 'network'
  | 'too_large'
  | 'invalid_json'
  | 'invalid_format'
  /** Le cache de Next a échoué (rien à voir avec la source). */
  | 'cache';

export type LifeSignsRead =
  { ok: true; signs: LifeSigns } | { ok: false; reason: LifeSignsFailure; detail?: string };

export interface LifeSignsSourceOptions {
  /** L'adresse du JSON public ; par défaut LIFE_SIGNS_URL (src/lib/env/server.ts). */
  url?: string;
  /** Pour les tests ; par défaut le fetch global. */
  fetch?: typeof fetch;
  /**
   * Passer par le cache de Next (par défaut). false : lecture directe, pour
   * les tests qui passent leur fetch ou leur adresse.
   */
  cache?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  /** Où écrire la cause d'un repli ; par défaut console.warn. */
  log?: (message: string) => void;
}

class TooLarge extends Error {}

/** Le corps de la réponse, sans jamais lire plus de max octets. */
async function readBounded(response: Response, max: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw new TooLarge();
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

/** Lit et valide le JSON public, sans repli : la cause de l'échec, sinon les signes de vie. */
export async function readLifeSigns(
  now: number = Date.now(),
  options: LifeSignsSourceOptions = {},
): Promise<LifeSignsRead> {
  const raw = 'url' in options ? options.url : readLifeSignsUrl();
  if (!raw?.trim()) return { ok: false, reason: 'missing_url' };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'https:')
    return { ok: false, reason: 'invalid_url', detail: 'https seulement' };

  const doFetch = options.fetch ?? fetch;
  const maxBytes = options.maxBytes ?? LIFE_SIGNS_MAX_BYTES;
  let text: string;
  try {
    const response = await doFetch(url, {
      headers: { Accept: 'application/json' },
      // Une redirection pourrait mener hors de https : on la refuse.
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? LIFE_SIGNS_TIMEOUT_MS),
      // Hors du cache de fetch de Next : c'est le résultat validé qui est
      // gardé (voir plus haut).
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, reason: 'http_error', detail: String(response.status) };
    }
    text = await readBounded(response, maxBytes);
  } catch (error) {
    if (error instanceof TooLarge) return { ok: false, reason: 'too_large' };
    return { ok: false, reason: isTimeout(error) ? 'timeout' : 'network' };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  const parsed = parsePublicLifeSigns(data, now);
  if (!parsed.ok) return { ok: false, reason: 'invalid_format', detail: parsed.issues.join(', ') };
  return { ok: true, signs: parsed.signs };
}

/** Un échec de lecture, levé dans le cache pour qu'il ne soit jamais gardé. */
class LifeSignsReadFailure extends Error {
  constructor(readonly failure: Extract<LifeSignsRead, { ok: false }>) {
    // Le message peut finir dans le journal de Next : la cause, jamais l'adresse.
    super(`signes de vie : lecture échouée, cause ${failure.reason}`);
    this.name = 'LifeSignsReadFailure';
  }
}

/**
 * La lecture par le cache de Next, partagée par la page et la route : une
 * lecture du JSON public toutes les 10 minutes au plus. La clé ne contient
 * pas l'adresse.
 */
const readCachedLifeSigns = unstable_cache(
  async (): Promise<LifeSigns> => {
    const result = await readLifeSigns(Date.now());
    if (!result.ok) throw new LifeSignsReadFailure(result);
    return result.signs;
  },
  ['life-signs'],
  { revalidate: LIFE_SIGNS_REVALIDATE_S },
);

async function read(now: number, options: LifeSignsSourceOptions): Promise<LifeSignsRead> {
  if (options.cache === false) return readLifeSigns(now, options);
  try {
    return { ok: true, signs: await readCachedLifeSigns() };
  } catch (error) {
    if (error instanceof LifeSignsReadFailure) return error.failure;
    return { ok: false, reason: 'cache' };
  }
}

// Sans adresse (en local, en CI), on ne le dit qu'une fois par processus.
let missingUrlLogged = false;

/**
 * Les signes de vie à montrer : le JSON public, ou les données d'exemple
 * mesurées à l'instant now (ms) si la lecture échoue (sample à true).
 */
export async function getLifeSigns(
  now: number = Date.now(),
  options: LifeSignsSourceOptions = {},
): Promise<LifeSigns> {
  const result = await read(now, options);
  if (result.ok) return result.signs;
  const log = options.log ?? ((message: string) => console.warn(message));
  if (result.reason !== 'missing_url' || options.log || !missingUrlLogged) {
    if (result.reason === 'missing_url' && !options.log) missingUrlLogged = true;
    const detail = result.detail ? ` (${result.detail})` : '';
    log(`signes de vie : données d'exemple, cause ${result.reason}${detail}`);
  }
  return sampleLifeSigns(now);
}
