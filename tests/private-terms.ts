import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Des termes privés ne doivent jamais apparaître dans ce que le site affiche.
// Ils ne sont pas écrits dans ce dépôt public : ils viennent d'un fichier
// local ignoré par git (une expression par ligne) et, en CI, de la variable
// PRIVATE_TERMS (même format). Sans l'un ni l'autre, seuls les termes
// génériques passés par le test sont vérifiés.
const LOCAL_FILE = join(process.cwd(), 'tests', 'private-terms.local.txt');

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

function privateTerms(): string[] {
  const local = existsSync(LOCAL_FILE) ? lines(readFileSync(LOCAL_FILE, 'utf8')) : [];
  return [...local, ...lines(process.env.PRIVATE_TERMS ?? '')];
}

/** L'expression des termes interdits : termes génériques + termes privés. */
export function forbiddenPattern(generic: string[]): RegExp {
  return new RegExp([...generic, ...privateTerms()].join('|'), 'i');
}
