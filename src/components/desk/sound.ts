import type { SoundCue, SoundPlayer } from '@/scene/core/sound';

// La synthèse des sons du bureau en WebAudio :
// aucun fichier audio, tout part d'oscillateurs et d'un bruit calculé.
// Le son est ouvert par défaut (DeskShell appelle setSound(true) du store).
// Les navigateurs ne laissent sonner une page qu'après un geste du visiteur :
// l'AudioContext ne se crée qu'à son premier clic, toucher ou touche du
// clavier ; d'ici là, play ne fait rien.

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

/** Volume général quand le son est ouvert. */
const MASTER = 0.8;
/** Le souffle de la pièce, très bas, sous les autres sons. */
const ROOM = 0.035;

interface Synth {
  ctx: AudioContext;
  out: GainNode;
  noiseBuffer: AudioBuffer;
}

/** Un bruit rose approché sur deux secondes, partagé par tous les sons de souffle. */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = white * 0.5 + last * 3;
  }
  return buffer;
}

function createSynth(): Synth | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  const out = ctx.createGain();
  out.gain.value = MASTER;
  const compressor = ctx.createDynamicsCompressor();
  out.connect(compressor);
  compressor.connect(ctx.destination);
  const noiseBuffer = makeNoise(ctx);

  // Le souffle de la pièce, en boucle.
  const room = ctx.createBufferSource();
  room.buffer = noiseBuffer;
  room.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 320;
  const roomGain = ctx.createGain();
  roomGain.gain.value = ROOM;
  room.connect(lowpass);
  lowpass.connect(roomGain);
  roomGain.connect(out);
  room.start();

  return { ctx, out, noiseBuffer };
}

/** Un souffle filtré : durée, fréquence, facteur Q, volume, type de filtre, délai (s). */
function noise(
  synth: Synth,
  duration: number,
  frequency: number,
  q: number,
  gain: number,
  type: BiquadFilterType = 'bandpass',
  delay = 0,
): BiquadFilterNode {
  const { ctx, out, noiseBuffer } = synth;
  const t = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, t);
  envelope.gain.linearRampToValueAtTime(gain, t + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(out);
  source.start(t, Math.random());
  source.stop(t + duration + 0.05);
  return filter;
}

/** Une note : fréquence, durée, volume, forme, délai (s), fréquence d'arrivée (glissando). */
function tone(
  synth: Synth,
  frequency: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
  delay = 0,
  toFrequency?: number,
): void {
  const { ctx, out } = synth;
  const t = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, t);
  if (toFrequency) oscillator.frequency.exponentialRampToValueAtTime(toFrequency, t + duration);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, t);
  envelope.gain.linearRampToValueAtTime(gain, t + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  oscillator.connect(envelope);
  envelope.connect(out);
  oscillator.start(t);
  oscillator.stop(t + duration + 0.05);
}

/** Un souffle qui monte : l'objet qui se soulève ou se repose. */
function whoosh(synth: Synth, delay = 0): void {
  const filter = noise(synth, 0.45, 500, 0.8, 0.18, 'bandpass', delay);
  filter.frequency.exponentialRampToValueAtTime(2400, synth.ctx.currentTime + delay + 0.35);
}

/** Le papier qu'on retourne. */
function paper(synth: Synth, delay = 0): void {
  noise(synth, 0.22, 2600, 0.6, 0.12, 'bandpass', delay);
  noise(synth, 0.12, 4200, 1, 0.06, 'highpass', delay + 0.1);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Les onze sons du bureau. strength : de 0 à 1. */
const CUES: Record<SoundCue, (synth: Synth, strength: number) => void> = {
  pick: (s) => {
    whoosh(s);
    paper(s, 0.35);
  },
  putBack: (s) => whoosh(s),
  flip: (s) => paper(s),
  thud: (s, v) => {
    tone(s, 90, 0.18, 0.25 * v, 'sine', 0, 50);
    noise(s, 0.08, 400, 1, 0.15 * v, 'lowpass');
  },
  slide: (s) => {
    tone(s, 1200, 0.07, 0.08, 'sine');
    tone(s, 2400, 0.03, 0.03, 'triangle');
    noise(s, 0.16, 700, 0.7, 0.06, 'bandpass', 0.02);
  },
  lampOn: (s) => {
    tone(s, 110, 1.2, 0.06, 'sawtooth', 0, 100);
    tone(s, 55, 1.6, 0.08, 'sine');
  },
  switch: (s) => {
    noise(s, 0.05, 3200, 2, 0.5, 'highpass');
    tone(s, 1800, 0.03, 0.15, 'square');
    noise(s, 0.08, 900, 3, 0.25, 'bandpass', 0.07);
  },
  tick: (s, v) => {
    // La force choisit la hauteur : neuf notes, de la plus grave à la plus aiguë.
    const i = Math.round(v * 8);
    tone(s, 1200 + i * 90, 0.07, 0.08, 'sine');
    tone(s, 2400 + i * 120, 0.03, 0.03, 'triangle');
  },
  hum: (s) => {
    tone(s, 220, 1.4, 0.05, 'sine', 0, 180);
    tone(s, 330, 1.4, 0.03, 'sine', 0.05, 280);
  },
  blip: (s) => {
    tone(s, 880, 0.12, 0.1, 'sine');
    tone(s, 1320, 0.12, 0.06, 'sine', 0.08);
  },
};

/** Les gestes qui autorisent une page à jouer du son. */
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Le lecteur du bureau. Rien n'est créé avant que le son soit ouvert ET que
 * le visiteur ait agi sur la page : ni AudioContext, ni nœud, ni bruit.
 * Couper le son suspend le contexte.
 */
export function createWebAudioSound(): SoundPlayer {
  let synth: Synth | null = null;
  let enabled = false;
  let armed = false;

  const start = () => {
    synth ??= createSynth();
    if (!synth) return;
    synth.out.gain.value = MASTER;
    if (synth.ctx.state === 'suspended') void synth.ctx.resume().catch(() => undefined);
  };
  const onGesture = () => {
    disarm();
    if (enabled) start();
  };
  const disarm = () => {
    if (!armed) return;
    armed = false;
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, onGesture, true);
  };
  const arm = () => {
    if (armed || typeof window === 'undefined') return;
    armed = true;
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, onGesture, true);
  };

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      if (!on) {
        enabled = false;
        if (synth) {
          synth.out.gain.value = 0;
          void synth.ctx.suspend().catch(() => undefined);
        }
        return enabled;
      }
      enabled = true;
      // Le navigateur refuserait de jouer avant un geste : le contexte
      // n'est créé qu'au premier clic, toucher ou touche, puis reste.
      if (synth) start();
      else arm();
      return enabled;
    },
    play(cue, strength) {
      if (!enabled || !synth) return;
      try {
        // Sans force donnée, un petit clic reste grave et le reste plein.
        CUES[cue](synth, clamp01(strength ?? (cue === 'tick' ? 0 : 1)));
      } catch {
        // Un son raté ne doit jamais casser un geste.
      }
    },
    dispose() {
      enabled = false;
      disarm();
      if (synth) void synth.ctx.close().catch(() => undefined);
      synth = null;
    },
  };
}
