import { NextResponse, type NextRequest } from 'next/server';
import { negotiateLocale } from '@/lib/accept-language';
import { deskPath } from '@/lib/site';

// La racine mène au bureau dans la langue du navigateur, en un seul saut. La
// redirection passe ici et non dans next.config.ts : les réponses du proxy
// portent les en-têtes de sécurité, celles des redirects de next.config non.
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = deskPath(negotiateLocale(request.headers.get('accept-language')));
  const response = NextResponse.redirect(url, 307);
  // La réponse dépend de Accept-Language : Vary le dit aux caches, et aucun
  // cache partagé ne doit la garder pour un autre visiteur.
  response.headers.set('Vary', 'Accept-Language');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

// La racine seulement : les pages, les fichiers et les images n'y passent pas.
export const config = {
  matcher: ['/'],
};
