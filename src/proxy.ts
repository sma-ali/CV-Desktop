import { NextResponse, type NextRequest } from 'next/server';
import { isLocale } from '@/content/locales';
import { negotiateLocale } from '@/lib/accept-language';
import { expressPath } from '@/lib/site';

// En attendant le bureau en 3D, la racine, /fr et /en mènent tout droit à la
// version express, en un seul saut. La redirection passe ici et non dans
// next.config.ts : les réponses du proxy portent les en-têtes de sécurité,
// celles des redirects de next.config non. À l'étape 3, /fr et /en
// deviennent le bureau et la racine visera /<langue>.
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const segment = url.pathname.slice(1);

  if (isLocale(segment)) {
    url.pathname = expressPath(segment);
    return NextResponse.redirect(url, 307);
  }

  // La racine suit la langue du navigateur : la réponse dépend de
  // Accept-Language, Vary le dit aux caches, et aucun cache partagé ne doit
  // la garder pour un autre visiteur.
  url.pathname = expressPath(negotiateLocale(request.headers.get('accept-language')));
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Vary', 'Accept-Language');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

// La racine, /fr et /en seulement : les pages, les fichiers et les images n'y
// passent pas.
export const config = {
  matcher: ['/', '/fr', '/en'],
};
