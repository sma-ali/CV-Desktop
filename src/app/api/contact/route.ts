import { handleContactPost, methodNotAllowed, type MailerResolution } from '@/lib/contact/handler';
import { createDryRunMailer, createMailjetMailer, type Mailer } from '@/lib/contact/mailer';
import {
  createMemoryRateLimiter,
  defaultWindows,
  type RateLimiter,
} from '@/lib/contact/rate-limit';
import { readContactConfig, readRateLimitMax } from '@/lib/env/server';

// POST /api/contact : le formulaire de contact (JSON depuis le navigateur,
// x-www-form-urlencoded sans JavaScript). Le traitement est dans
// src/lib/contact/handler.ts ; ici, seulement ses outils.

const logger = console;

// Une limite par instance du serveur (voir rate-limit.ts) : créée au premier
// envoi, puis gardée tant que l'instance vit.
let limiter: RateLimiter | null = null;
function getLimiter(): RateLimiter {
  // Les plafonds suivent un maximum par IP relevé (tests de bout en bout).
  limiter ??= createMemoryRateLimiter(defaultWindows(readRateLimitMax()));
  return limiter;
}

function resolveMailer(): MailerResolution {
  const config = readContactConfig();
  if (config.mode === 'unavailable') return { ok: false, problems: config.problems };
  const mailer: Mailer =
    config.mode === 'dry-run'
      ? createDryRunMailer(logger)
      : createMailjetMailer({
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          to: config.to,
          from: config.from,
        });
  return { ok: true, mailer };
}

export async function POST(request: Request): Promise<Response> {
  return handleContactPost(request, {
    limiter: getLimiter(),
    resolveMailer,
    now: Date.now,
    logger,
  });
}

// Les autres méthodes : 405, avec Allow: POST.
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
