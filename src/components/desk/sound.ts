import type { SoundCue, SoundPlayer } from '@/scene/core/sound';

// La synthèse des sons du bureau en WebAudio (partie « fiches »), d'après
// le prototype (Snd) : aucun fichier audio. L'AudioContext ne se crée qu'au
// premier setEnabled(true), appelé par le clic sur « Son » (toggleSound du
// store) ; tant que le son est coupé, play ne fait rien.
//
// SQUELETTE du socle : il retient seulement s'il est ouvert, sans
// AudioContext ni son. La partie « fiches » écrit la synthèse ici, sous ce
// nom et avec ce type.
export function createWebAudioSound(): SoundPlayer {
  let enabled = false;
  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = on;
      return enabled;
    },
    play(cue: SoundCue, strength?: number) {
      if (!enabled) return;
      void cue;
      void strength;
    },
    dispose() {
      enabled = false;
    },
  };
}
