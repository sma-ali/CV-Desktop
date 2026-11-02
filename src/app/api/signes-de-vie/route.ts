import { getLifeSigns, LIFE_SIGNS_CACHE_CONTROL } from '@/lib/life-signs/source';

// Les signes de vie du coffret, en JSON : ceux du JSON public (validés, liste
// blanche) ou les données d'exemple (sample à true) si la lecture échoue.
// Jamais d'erreur 500, jamais d'en-tête CORS : seul le site les lit. Les
// autres méthodes reçoivent un 405 de Next ; HEAD et OPTIONS sont gérés.

export async function GET(): Promise<Response> {
  const signs = await getLifeSigns();
  return Response.json(signs, { headers: { 'Cache-Control': LIFE_SIGNS_CACHE_CONTROL } });
}

export async function HEAD(): Promise<Response> {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
