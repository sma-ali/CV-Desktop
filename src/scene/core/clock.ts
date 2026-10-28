// L'horloge de la scène : T, en secondes depuis le début de l'arrivée.
// Objet mutable, lu à chaque image ; jamais dans un état React.

export interface Clock {
  /** Secondes depuis le début de l'arrivée. */
  readonly t: number;
  /** Durée de la dernière image (secondes, bornée à 0.1). */
  readonly dt: number;
  /** Horloge gelée par ?fige : t ne bouge plus, dt continue. */
  readonly frozen: boolean;
  /** Avance l'horloge ; now en secondes (performance.now() / 1000). */
  tick(now: number): void;
  /** Repart de startAt (Rejouer), dégelée. */
  restart(now: number, startAt?: number): void;
  /** Suspend le temps (onglet caché) puis le reprend là où il était. */
  pause(now: number): void;
  resume(now: number): void;
}

export const MAX_DT = 0.1;

export function createClock({ startAt = 0, frozen = false } = {}): Clock {
  let origin: number | null = null;
  let last: number | null = null;
  let pausedAt: number | null = null;
  let start = startAt;
  const state = { t: startAt, dt: 0, frozen };

  return {
    get t() {
      return state.t;
    },
    get dt() {
      return state.dt;
    },
    get frozen() {
      return state.frozen;
    },
    tick(now) {
      if (pausedAt !== null) return;
      if (origin === null) origin = now - start;
      state.dt = last === null ? 1 / 60 : Math.min(MAX_DT, Math.max(0, now - last));
      last = now;
      state.t = state.frozen ? start : now - origin;
    },
    restart(now, startAt = 0) {
      start = startAt;
      origin = now - startAt;
      last = null;
      pausedAt = null;
      state.frozen = false;
      state.t = startAt;
    },
    pause(now) {
      if (pausedAt === null) pausedAt = now;
    },
    resume(now) {
      if (pausedAt === null) return;
      if (origin !== null) origin += now - pausedAt;
      pausedAt = null;
      last = null;
    },
  };
}
