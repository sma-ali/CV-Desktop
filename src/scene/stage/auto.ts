import { AUTO_SEQ, AUTO_START, AUTO_TIMING, IDLE_DELAY } from '../core/constants';
import type { ItemId } from '../core/ids';
import type { PresentSource } from '../core/store';

// La visite automatique (updateAuto() du prototype), en machine à états pure
// et testée. Le composant AutoTour la fait avancer à chaque image et traduit
// ses ordres en actions du store.

export interface AutoTourState {
  /** La visite est en cours. */
  on: boolean;
  /** Prochain objet de AUTO_SEQ. */
  index: number;
  /** wait : entre deux objets ; hold : un objet est présenté. */
  step: 'wait' | 'hold';
  /** T du prochain changement. */
  next: number;
}

export interface AutoTourInput {
  t: number;
  /** settings.autoAllowed : ni ?auto=0, ni mouvement réduit. */
  allowed: boolean;
  lastUserAt: number;
  presented: ItemId | null;
  presentedBy: PresentSource | null;
}

export type AutoTourCommand =
  { type: 'start' } | { type: 'stop' } | { type: 'present'; item: ItemId } | { type: 'putBack' };

export function createAutoTour(): AutoTourState {
  return { on: false, index: 0, step: 'wait', next: AUTO_START };
}

/** Remet la visite au début (Rejouer). */
export function resetAutoTour(state: AutoTourState): AutoTourState {
  state.on = false;
  state.index = 0;
  state.step = 'wait';
  state.next = AUTO_START;
  return state;
}

/** Durée de présentation d'un objet. */
export function holdDuration(item: ItemId): number {
  if (item === 'book') return AUTO_TIMING.hold.book;
  if (item === 'chest') return AUTO_TIMING.hold.chest;
  return AUTO_TIMING.hold.default;
}

/**
 * La visite doit-elle tourner ? Après AUTO_START, quand le visiteur n'a rien
 * fait depuis IDLE_DELAY secondes et ne tient rien lui-même.
 */
export function autoWanted(input: AutoTourInput): boolean {
  const { t, allowed, lastUserAt, presented, presentedBy } = input;
  const idle = t - lastUserAt > IDLE_DELAY;
  const userHolds = presented !== null && presentedBy !== 'auto';
  return allowed && t >= AUTO_START && idle && !userHolds;
}

/**
 * Avance la visite d'une image. Modifie state et renvoie l'ordre à donner au
 * store, ou null. Au plus un ordre par image : la visite démarre, puis
 * présente son premier objet AUTO_TIMING.resume secondes plus tard.
 */
export function stepAutoTour(state: AutoTourState, input: AutoTourInput): AutoTourCommand | null {
  const { t } = input;
  const wanted = autoWanted(input);
  if (wanted && !state.on) {
    state.on = true;
    state.step = 'wait';
    state.next = Math.max(t + AUTO_TIMING.resume, AUTO_START);
    return { type: 'start' };
  }
  if (!wanted && state.on) {
    state.on = false;
    // AutoTour repose alors l'objet de la visite s'il est encore présenté
    // (markUser le fait déjà quand c'est une action du visiteur).
    return { type: 'stop' };
  }
  if (!state.on || t < state.next) return null;

  if (state.step === 'wait') {
    const item = AUTO_SEQ[state.index % AUTO_SEQ.length] ?? AUTO_SEQ[0];
    state.step = 'hold';
    state.next = t + holdDuration(item);
    return { type: 'present', item };
  }
  state.step = 'wait';
  state.index = (state.index + 1) % AUTO_SEQ.length;
  state.next = t + (state.index === 0 ? AUTO_TIMING.loopPause : AUTO_TIMING.gap);
  return { type: 'putBack' };
}
