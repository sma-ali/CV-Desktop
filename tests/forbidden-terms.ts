import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Les noms propres des chaînes ne doivent jamais être écrits dans ce dépôt
// public : ils vivent dans un fichier local ignoré par git, une expression
// par ligne. Sans ce fichier (CI), seuls les termes génériques sont vérifiés.
const LOCAL_FILE = join(process.cwd(), 'tests', 'mots-interdits.local.txt');

function localTerms(): string[] {
  if (!existsSync(LOCAL_FILE)) return [];
  return readFileSync(LOCAL_FILE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** Construit l'expression des mots interdits : termes génériques + liste locale. */
export function forbiddenPattern(generic: string[]): RegExp {
  return new RegExp([...generic, ...localTerms()].join('|'), 'i');
}
