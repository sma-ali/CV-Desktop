import { sampleLifeSigns } from './sample';
import type { LifeSigns } from './types';

// Le point d'entrée des signes de vie côté serveur. Étape 4 : les données
// d'exemple. Étape 5 : /api/signes-de-vie et cette fonction liront le JSON
// public (avec cache), et retomberont sur l'exemple en cas d'échec. La page
// passe le résultat au navigateur en props (DeskShell, puis le store).
export async function getLifeSigns(now: number = Date.now()): Promise<LifeSigns> {
  return sampleLifeSigns(now);
}
