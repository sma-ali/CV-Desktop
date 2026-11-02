import { z } from 'zod';
import { DEFAULT_PER_KEY } from '@/lib/contact/rate-limit';
import { ensureSharedKeys } from './shared-keys';

// Variables d'environnement du serveur, lues et validées ici seulement.
// Le paquet server-only n'est pas installé : cette garde fait le même
// travail, un import depuis le navigateur échoue tout de suite.
if (typeof window !== 'undefined') {
  throw new Error('src/lib/env/server.ts ne doit jamais être importé dans le navigateur.');
}

type Env = Record<string, string | undefined>;

/** Une variable vide vaut une variable absente. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const contactEnvSchema = z.object({
  CONTACT_TO: optional(z.email()),
  CONTACT_FROM: optional(z.email()),
  MAILJET_API_KEY: optional(z.string().trim().min(1)),
  MAILJET_API_SECRET: optional(z.string().trim().min(1)),
  /** 1 : rien n'est envoyé, le message accepté est seulement journalisé. */
  CONTACT_DRY_RUN: optional(z.enum(['0', '1'])),
  /** Envois permis par IP et par 10 minutes (5 par défaut ; les E2E le relèvent). */
  CONTACT_RATE_LIMIT_MAX: optional(z.coerce.number().int().min(1).max(100_000)),
});

export type ContactConfig =
  | { mode: 'dry-run' }
  | { mode: 'mailjet'; to: string; from: string; apiKey: string; apiSecret: string }
  /** Variables absentes ou invalides : leurs noms seulement, jamais leurs valeurs. */
  | { mode: 'unavailable'; problems: string[] };

const MAILJET_KEYS = [
  'CONTACT_TO',
  'CONTACT_FROM',
  'MAILJET_API_KEY',
  'MAILJET_API_SECRET',
] as const;

/** La configuration de l'envoi, d'après env (process.env par défaut). */
export function readContactConfig(env: Env = loadedEnv()): ContactConfig {
  const pick = Object.fromEntries(
    [...MAILJET_KEYS, 'CONTACT_DRY_RUN'].map((name) => [name, env[name]]),
  );
  const parsed = contactEnvSchema.omit({ CONTACT_RATE_LIMIT_MAX: true }).safeParse(pick);
  if (!parsed.success) {
    const problems = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    // Un dry run demandé reste un dry run, même si une autre variable est fausse.
    if (env.CONTACT_DRY_RUN === '1') return { mode: 'dry-run' };
    return { mode: 'unavailable', problems };
  }
  const values = parsed.data;
  if (values.CONTACT_DRY_RUN === '1') return { mode: 'dry-run' };
  const missing = MAILJET_KEYS.filter((name) => values[name] === undefined);
  if (missing.length > 0) return { mode: 'unavailable', problems: missing };
  return {
    mode: 'mailjet',
    to: values.CONTACT_TO!,
    from: values.CONTACT_FROM!,
    apiKey: values.MAILJET_API_KEY!,
    apiSecret: values.MAILJET_API_SECRET!,
  };
}

/** Le maximum d'envois par IP et par fenêtre ; une valeur invalide garde le défaut. */
export function readRateLimitMax(env: Env = loadedEnv()): number {
  const parsed = contactEnvSchema.shape.CONTACT_RATE_LIMIT_MAX.safeParse(
    env.CONTACT_RATE_LIMIT_MAX,
  );
  return (parsed.success ? parsed.data : undefined) ?? DEFAULT_PER_KEY.max;
}

/** process.env, complété une fois par le dossier des clés communes (hors Vercel). */
function loadedEnv(): Env {
  ensureSharedKeys();
  return process.env;
}
