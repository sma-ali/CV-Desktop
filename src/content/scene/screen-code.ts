import type { Content } from '../schema';

// Le fichier TypeScript affiché sur l'écran du bureau, généré depuis le
// contenu du CV : le parcours (périodes, organisations, intitulés exacts),
// puis un objet `ali` (titre, compétences tirées du CV, localisation,
// disponibilité). Fonction pure : le résultat est recopié dans fr.ts et en.ts
// (screen.code), et scene.test.ts vérifie qu'il est à jour.
//
// Le code reste court pour être lisible de loin : 15 lignes, 50 caractères
// au plus (le prototype en avait 16, de 50 caractères, et tombait à 8 px).

/** Largeur visée des lignes ; un tableau trop long passe à la ligne. */
export const SCREEN_CODE_WIDTH = 50;

/** Ce que le générateur lit du contenu. */
export type ScreenFacts = Pick<Content, 'profile' | 'experiences' | 'skills'>;

/** Le vocabulaire du code, dans la langue de la page. */
export interface ScreenWords {
  /** Nom du tableau du parcours (« parcours »). */
  list: string;
  /** Nom de la fonction qui décrit un poste (« poste »). */
  entry: string;
  /** Nom de l'objet final (« ali »). */
  object: string;
  title: string;
  stack: string;
  location: string;
  available: string;
  /** Les compétences montrées : chacune doit figurer dans le CV. */
  stackItems: readonly string[];
}

/** Une chaîne TypeScript entre apostrophes. */
export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Un tableau de chaînes, sur une ligne s'il tient, sinon un élément par ligne. */
function arrayProperty(key: string, values: readonly string[], width: number): string[] {
  const items = values.map(quote);
  const inline = `  ${key}: [${items.join(', ')}],`;
  if (inline.length <= width) return [inline];
  // Les éléments sont rangés au plus serré, en retrait de quatre espaces.
  const lines = [`  ${key}: [`];
  let current = '';
  for (const item of items) {
    const next = current ? `${current} ${item},` : `    ${item},`;
    if (current && next.length > width) {
      lines.push(current);
      current = `    ${item},`;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  lines.push('  ],');
  return lines;
}

/** Les lignes du fichier affiché, sans la ligne finale. */
export function buildScreenCode(
  facts: ScreenFacts,
  words: ScreenWords,
  width = SCREEN_CODE_WIDTH,
): string[] {
  const known = new Set(facts.skills.flatMap((group) => group.items));
  for (const skill of words.stackItems) {
    if (!known.has(skill)) throw new Error(`compétence absente du CV : ${skill}`);
  }

  // Le parcours se lit dans l'ordre : du premier poste au dernier.
  const career = [...facts.experiences].sort((a, b) =>
    a.period.start.localeCompare(b.period.start),
  );

  const { profile } = facts;
  return [
    `export const ${words.list} = [`,
    ...career.flatMap(({ period, organization, role }) => [
      `  ${words.entry}(${[period.start, period.end, organization].map(quote).join(', ')},`,
      `    ${quote(role)}),`,
    ]),
    '];',
    `export const ${words.object} = {`,
    `  ${words.title}: ${quote(profile.headline)},`,
    ...arrayProperty(words.stack, words.stackItems, width),
    `  ${words.location}: ${quote(profile.location)},`,
    // La disponibilité est un texte validé du CV : sa présence vaut true.
    `  ${words.available}: ${profile.availability ? 'true' : 'false'},`,
    '} as const;',
  ];
}
