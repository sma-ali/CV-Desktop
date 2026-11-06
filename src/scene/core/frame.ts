import {
  ambientLevel,
  cameraProgress,
  keyboardLedLevel,
  lampFlash,
  lampLevel,
  screenLevel,
  typedChars,
  windowLevel,
} from './arrival';
import { syncDeskBodies } from './bodies';
import { dropOffset, DROP_END, DROP_ORDER, landingsBetween } from './drop';
import type { FrameState, SceneState } from './store';

// Le calcul de chaque image, avant tous les autres useFrame (ClockDriver) :
// les niveaux de l'arrivée d'après l'horloge, la place d'origine des corps
// du format, et la chute de l'arrivée. Sans React : testé dans store.test.ts.

/** Recalcule les niveaux de l'arrivée dans frame, d'après l'horloge. */
export function updateFrame(state: SceneState, portrait: boolean): FrameState {
  const { clock, frame, lamp, settings } = state;
  const t = clock.t;
  const prev = frame.t;
  frame.t = t;
  frame.dt = clock.dt;
  frame.lamp = lampLevel(t, lamp.switchedAt, lamp.on);
  frame.lampFlash = settings.reducedMotion ? 0 : lampFlash(t, lamp.switchedAt, lamp.on);
  frame.screen = screenLevel(t);
  frame.keyboardLed = keyboardLedLevel(t);
  frame.typed = typedChars(t);
  frame.window = windowLevel(t);
  frame.ambient = ambientLevel(t);
  frame.camera = settings.reducedMotion ? 1 : cameraProgress(t);
  frame.portrait = portrait;
  syncDeskBodies(state.desk, portrait);
  applyDrop(state, prev, t);
  return frame;
}

/**
 * La chute de l'arrivée (core/drop.ts) : tant qu'elle dure, chaque corps
 * que rien n'a touché est posé au-dessus de sa place, ou caché s'il n'est pas
 * encore parti. Un petit choc sonne à chaque atterrissage.
 */
function applyDrop(state: SceneState, prev: number, t: number): void {
  const { desk } = state;
  const active = t < DROP_END && !state.settings.reducedMotion;
  for (let i = 0; i < DROP_ORDER.length; i++) {
    const id = DROP_ORDER[i];
    if (id === undefined) continue;
    const body = desk[id];
    if (!active || body.moved) {
      body.waiting = false;
      continue;
    }
    const drop = dropOffset(t, i);
    body.waiting = drop === null;
    if (!drop || (drop.dy === 0 && drop.tilt === 0)) continue;
    body.y += drop.dy;
    // Penché pendant la chute : cap d'origine, puis bascule autour de x
    // (un sens sur deux), quaternion cap × bascule.
    const half = ((i % 2 === 0 ? 1 : -1) * drop.tilt) / 2;
    const sx = Math.sin(half);
    const cx = Math.cos(half);
    const sy = body.qy;
    const cy = body.qw;
    body.qx = cy * sx;
    body.qy = sy * cx;
    body.qz = -sy * sx;
    body.qw = cy * cx;
  }
  if (active && t > prev) {
    for (const i of landingsBetween(prev, t))
      state.sound.play('thud', i === DROP_ORDER.length - 1 ? 0.5 : 0.3);
  }
}
