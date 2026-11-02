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

/** Durée de vie du JSON public dans le cache de Next, en secondes. */
export const LIFE_SIGNS_REVALIDATE_S = 600;
/**
 * L'en-tête de cache de /api/signes-de-vie : le CDN garde la réponse 10
 * minutes, puis la sert encore un jour le temps de la renouveler.
 */
export const LIFE_SIGNS_CACHE_CONTROL = `public, max-age=0, s-maxage=${LIFE_SIGNS_REVALIDATE_S}, stale-while-revalidate=86400`;
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
  | 'invalid_format';

export type LifeSignsRead =
  { ok: true; signs: LifeSigns } | { ok: false; reason: LifeSignsFailure; detail?: string };

export interface LifeSignsSourceOptions {
  /** L'adresse du JSON public ; par défaut LIFE_SIGNS_URL (src/lib/env/server.ts). */
  url?: string;
  /** Pour les tests ; par défaut le fetch global (patché par Next pour le cache). */
  fetch?: typeof fetch;
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
      // Cache de Next : une lecture toutes les 10 minutes au plus, partagée
      // par la page et la route.
      next: { revalidate: LIFE_SIGNS_REVALIDATE_S },
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

// Sans adresse (en local, en CI), on ne le dit qu'une fois par processus.
let missingUrlLogged = false;

/**
 * Les signes de vie à montrer : le JSON public, ou les données d'exemple
 * mesurées à l'instant now (ms) si la lecture échoue.
 */
export async function getLifeSigns(
  now: number = Date.now(),
  options: LifeSignsSourceOptions = {},
): Promise<LifeSigns> {
  const result = await readLifeSigns(now, options);
  if (result.ok) return result.signs;
  const log = options.log ?? ((message: string) => console.warn(message));
  if (result.reason !== 'missing_url' || options.log || !missingUrlLogged) {
    if (result.reason === 'missing_url' && !options.log) missingUrlLogged = true;
    const detail = result.detail ? ` (${result.detail})` : '';
    log(`signes de vie : données d'exemple, cause ${result.reason}${detail}`);
  }
  return sampleLifeSigns(now);
}
