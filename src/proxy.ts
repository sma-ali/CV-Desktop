import { NextResponse, type NextRequest } from 'next/server';
import { negotiateLocale } from '@/lib/accept-language';

// La racine envoie vers la langue du navigateur (/fr ou /en). La réponse
// dépend de l'en-tête Accept-Language : Vary le dit aux caches.
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${negotiateLocale(request.headers.get('accept-language'))}`;
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Vary', 'Accept-Language');
  return response;
}

// Uniquement la racine : les pages, les fichiers et les images n'y passent pas.
export const config = {
  matcher: '/',
};
