// Les polices des textures peintes. Leurs vrais noms de famille viennent de
// next/font (variables CSS posées sur <html> par le layout) : on les lit au
// lieu d'écrire « Fraunces » en dur, que next/font renomme. Les textures se
// redessinent quand les polices sont chargées (version incrémentée).

export interface SceneFonts {
  /** Fraunces : titres, chiffres. */
  serif: string;
  /** IBM Plex Mono : code, étiquettes. */
  mono: string;
  /** Caveat : écriture à la main (post-it, notes). */
  hand: string;
}

const VARIABLES = {
  serif: ['--font-fraunces', "'Iowan Old Style', Georgia, serif"],
  mono: ['--font-plex-mono', 'Menlo, Consolas, monospace'],
  hand: ['--font-caveat', "'Segoe Print', 'Bradley Hand', cursive"],
} as const;

/** Les graisses et styles que les textures emploient : chacun est chargé avant de redessiner. */
const FACES = [
  ['serif', '400'],
  ['serif', 'italic 400'],
  ['serif', '600'],
  ['serif', '700'],
  ['mono', '400'],
  ['mono', '500'],
  ['mono', '600'],
  ['hand', '500'],
  ['hand', '700'],
] as const;

export function readSceneFonts(): SceneFonts {
  const style = getComputedStyle(document.documentElement);
  const family = (key: keyof SceneFonts) => {
    const [variable, fallback] = VARIABLES[key];
    const value = style.getPropertyValue(variable).trim();
    return value ? `${value}, ${fallback}` : fallback;
  };
  return { serif: family('serif'), mono: family('mono'), hand: family('hand') };
}

let version = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Charge toutes les polices des textures (une seule fois) ; la version change à la fin. */
export function loadSceneFonts(): Promise<void> {
  if (loading) return loading;
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const fonts = readSceneFonts();
  loading = Promise.all(
    FACES.map(([key, face]) => document.fonts.load(`${face} 32px ${fonts[key]}`).catch(() => [])),
  ).then(() => {
    version += 1;
    listeners.forEach((listener) => listener());
  });
  return loading;
}

export function subscribeSceneFonts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sceneFontsVersion(): number {
  return version;
}
