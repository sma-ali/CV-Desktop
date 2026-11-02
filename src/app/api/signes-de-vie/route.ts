import {
  getLifeSigns,
  LIFE_SIGNS_CACHE_CONTROL,
  LIFE_SIGNS_FALLBACK_CACHE_CONTROL,
} from '@/lib/life-signs/source';

// Les signes de vie du coffret, en JSON : ceux du JSON public (validés, liste
// blanche) ou les données d'exemple (sample à true) si la lecture échoue.
// Jamais d'erreur 500, jamais d'en-tête CORS : seul le site les lit. Les
// autres méthodes reçoivent un 405 de Next ; HEAD et OPTIONS sont gérés.
// Les données d'exemple ne restent que 30 s au CDN : la source revenue, les
// vraies reprennent vite leur place.

export async function GET(): Promise<Response> {
  const signs = await getLifeSigns();
  const cacheControl = signs.sample ? LIFE_SIGNS_FALLBACK_CACHE_CONTROL : LIFE_SIGNS_CACHE_CONTROL;
  return Response.json(signs, { headers: { 'Cache-Control': cacheControl } });
}

export async function HEAD(): Promise<Response> {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
