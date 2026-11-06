import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Le dossier de ce fichier est la racine du projet, même dans un worktree
// imbriqué (.claude/worktrees/<nom>) : sans cela, Turbopack et le traçage des
// fichiers remontent au package-lock.json du dépôt parent.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development';

// Tout vient du site lui-même. Next.js injecte des scripts en ligne pour
// l'hydratation, d'où 'unsafe-inline' tant qu'on n'utilise pas de nonce
// (un nonce forcerait le rendu dynamique de chaque page).
// 'unsafe-eval' ne sert qu'au rechargement à chaud en développement.
// 'wasm-unsafe-eval' permet de compiler du WebAssembly, et rien d'autre (ni
// eval, ni new Function) : le moteur physique du bureau (Rapier)
// est un module WebAssembly embarqué dans son fichier JavaScript, servi par
// le site lui-même.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // Pas d'AGENTS.md généré par `next dev` dans le dépôt.
  agentRules: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
