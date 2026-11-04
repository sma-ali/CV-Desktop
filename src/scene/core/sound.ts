// Le son du bureau, vu par ceux qui le déclenchent (étape 4). Les gestes, les
// objets et le store appellent play(cue) sans rien savoir de la synthèse :
// tant que le son est coupé, play ne fait rien. La synthèse WebAudio vit
// dans src/components/desk/sound.ts ; la page l'ouvre par défaut (DeskShell),
// et elle ne sonne qu'après le premier geste du visiteur. Aucun fichier audio.

/**
 * Les sons du prototype (Snd) : prise et repose d'un objet, papier quand on
 * le retourne, choc quand il rebondit ou en heurte un autre (strength : la
 * force, 0 à 1), départ d'un glisser, lampe et son interrupteur, petits
 * clics du décor, coffret qui tremble, ronronnement de l'écran, bip du son.
 */
export type SoundCue =
  'pick' | 'putBack' | 'flip' | 'thud' | 'slide' | 'lampOn' | 'switch' | 'tick' | 'hum' | 'blip';

export interface SoundPlayer {
  /** Le son est-il ouvert ? */
  readonly enabled: boolean;
  /**
   * Ouvre ou coupe le son. Le premier appel avec true crée l'AudioContext :
   * seulement depuis un geste du visiteur (clic sur « Son »). Renvoie l'état
   * obtenu (false si le navigateur n'a pas WebAudio).
   */
  setEnabled(on: boolean): boolean;
  /** Joue un son ; ne fait rien tant que le son est coupé. */
  play(cue: SoundCue, strength?: number): void;
  /** Ferme l'AudioContext (démontage de la page). */
  dispose(): void;
}

/** Un lecteur muet : il retient seulement s'il est ouvert. Défaut du store et des tests. */
export function createSilentSound(): SoundPlayer & { readonly played: SoundCue[] } {
  let enabled = false;
  const played: SoundCue[] = [];
  return {
    get enabled() {
      return enabled;
    },
    played,
    setEnabled(on) {
      enabled = on;
      return enabled;
    },
    play(cue) {
      if (enabled) played.push(cue);
    },
    dispose() {
      enabled = false;
    },
  };
}
