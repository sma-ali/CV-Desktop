import { defaultLocale, locales, type Locale } from '@/content/locales';

// Au-delà, l'en-tête est tronqué : un navigateur n'envoie jamais autant.
const MAX_HEADER_LENGTH = 1024;
const MAX_ENTRIES = 32;

const RANGE = /^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/i;
const QUALITY = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;

type Entry = { range: string; quality: number; position: number };

// Lit « fr-FR,fr;q=0.9,en;q=0.8 » en une liste de langues pondérées.
// Une entrée illisible est ignorée, pas tout l'en-tête.
function parse(header: string): Entry[] {
  return header
    .slice(0, MAX_HEADER_LENGTH)
    .split(',')
    .slice(0, MAX_ENTRIES)
    .flatMap((part, position): Entry[] => {
      const [rawRange = '', ...params] = part.split(';').map((piece) => piece.trim());
      if (!RANGE.test(rawRange)) return [];
      let quality = 1;
      for (const param of params) {
        const match = QUALITY.exec(param);
        if (!match?.[1]) return [];
        quality = Number(match[1]);
      }
      return [{ range: rawRange.toLowerCase(), quality, position }];
    });
}

// Choisit la langue du site d'après l'en-tête Accept-Language du navigateur.
// Une variante régionale vaut sa langue (en-GB donne en), le joker * vaut la
// langue par défaut, et un en-tête absent ou illisible aussi.
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const entries = parse(header);
  const wildcard = entries.find((entry) => entry.range === '*');

  const candidates = locales.map((locale, order) => {
    const matches = entries.filter((entry) => entry.range.split('-')[0] === locale);
    // Une langue nommée explicitement prend sa propre qualité, même nulle ;
    // sinon le joker s'applique, après toute langue nommée.
    const best = matches.reduce<Entry | undefined>(
      (current, entry) => (!current || entry.quality > current.quality ? entry : current),
      undefined,
    );
    const quality = best?.quality ?? wildcard?.quality ?? 0;
    const position = best?.position ?? Number.POSITIVE_INFINITY;
    return { locale, quality, position, order };
  });

  const [chosen] = candidates
    .filter((candidate) => candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.position - b.position || a.order - b.order);
  return chosen?.locale ?? defaultLocale;
}
