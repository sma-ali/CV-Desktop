import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Les clés communes à plusieurs projets vivent hors du dépôt, dans
// ~/.config/cles/*.env (un fichier par service). Next charge d'abord le .env
// du projet ; ce module complète ensuite process.env avec ce dossier, sans
// jamais écraser une variable déjà posée. CLES_DIR remplace le dossier (les
// tests le fixent à /nonexistent, pour ne jamais lire de vraies clés).
//
// Seules les variables connues du site sont reprises : les autres clés du
// dossier n'entrent pas dans le processus. Rien de tout cela ne tourne sur
// Vercel (VERCEL défini), où les variables viennent du projet. Aucune valeur
// n'est jamais affichée ni journalisée. Les commentaires turbopackIgnore
// empêchent le build de tracer tout le projet dans les fonctions serveur à
// cause de ces lectures, qui visent un dossier hors du dépôt.

/** Les variables que ce dossier peut fournir au site. */
const SHARED_KEY_NAMES = [
  'CONTACT_TO',
  'CONTACT_FROM',
  'MAILJET_API_KEY',
  'MAILJET_API_SECRET',
  'LIFE_SIGNS_URL',
] as const;

type Env = Record<string, string | undefined>;

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

/** Lit un fichier .env simple : NOM=valeur, guillemets et commentaires permis. */
export function parseEnvFile(source: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const match = LINE.exec(line);
    if (!match) continue;
    const [, name, rawValue = ''] = match;
    let value = rawValue;
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2] ?? '';
    else value = value.replace(/\s+#.*$/, '');
    values.set(name!, value);
  }
  return values;
}

export interface LoadSharedKeysOptions {
  env?: Env;
  /** Le dossier à lire ; par défaut CLES_DIR, sinon ~/.config/cles. */
  dir?: string;
  names?: readonly string[];
}

/**
 * Complète env avec les variables connues trouvées dans le dossier des clés.
 * Rend les noms des variables ajoutées (jamais leurs valeurs).
 */
export function loadSharedKeys(options: LoadSharedKeysOptions = {}): string[] {
  const env = options.env ?? process.env;
  if (env.VERCEL) return [];
  const dir = options.dir ?? (env.CLES_DIR || join(homedir(), '.config', 'cles'));
  const names = new Set(options.names ?? SHARED_KEY_NAMES);

  let files: string[];
  try {
    files = readdirSync(/*turbopackIgnore: true*/ dir)
      .filter((file) => file.endsWith('.env'))
      .sort();
  } catch {
    return []; // pas de dossier : rien à ajouter
  }

  const added: string[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(join(/*turbopackIgnore: true*/ dir, file), 'utf8');
    } catch {
      continue;
    }
    for (const [name, value] of parseEnvFile(source)) {
      if (!names.has(name) || env[name] !== undefined) continue;
      env[name] = value;
      added.push(name);
    }
  }
  return added;
}

let loaded = false;

/** Charge le dossier des clés une seule fois par processus. */
export function ensureSharedKeys(): void {
  if (loaded) return;
  loaded = true;
  loadSharedKeys();
}
