import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// Tout vient du site lui-même. Next.js injecte des scripts en ligne pour
// l'hydratation, d'où 'unsafe-inline' tant qu'on n'utilise pas de nonce
// (un nonce forcerait le rendu dynamique de chaque page).
// 'unsafe-eval' ne sert qu'au rechargement à chaud en développement.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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
  // Pas d'AGENTS.md généré par `next dev` dans le dépôt.
  agentRules: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    // Le français est la langue par défaut. Le choix selon la langue du
    // navigateur viendra avec la version express.
    return [{ source: '/', destination: '/fr', permanent: false }];
  },
};

export default nextConfig;
