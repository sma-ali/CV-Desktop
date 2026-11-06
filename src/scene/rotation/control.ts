import type { SceneStore } from '../core/store';

// Ce que la fiche (Sheet, hors du canvas) envoie à la rotation libre
// (HeldRotation, dans le canvas) : les pas des flèches du clavier. Un par
// store, donc un par page, comme le moyeu des gestes. Sans three : la fiche
// est dans le premier chargement, la scène non.

/** Les touches qui tournent l'objet présenté : [axe y (lacet), axe x (tangage)] en pas. */
const ROTATE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Le pas d'une touche (null : ce n'est pas une flèche). */
export function rotateKey(key: string): readonly [number, number] | null {
  return Object.hasOwn(ROTATE_KEYS, key) ? (ROTATE_KEYS[key] ?? null) : null;
}

export class RotationInput {
  /** Pas en attente : lacet (axe vertical de la vue) et tangage (axe horizontal). */
  yaw = 0;
  pitch = 0;

  /** Une flèche : un pas de plus à jouer. */
  nudge(yaw: number, pitch: number): void {
    this.yaw += yaw;
    this.pitch += pitch;
  }

  /** Les pas en attente, rendus une fois (HeldRotation les prend à chaque image). */
  take(): { yaw: number; pitch: number } | null {
    if (this.yaw === 0 && this.pitch === 0) return null;
    const steps = { yaw: this.yaw, pitch: this.pitch };
    this.yaw = 0;
    this.pitch = 0;
    return steps;
  }
}

const inputs = new WeakMap<SceneStore, RotationInput>();

/** Les entrées de la rotation libre de ce store (créées au premier appel). */
export function rotationInput(store: SceneStore): RotationInput {
  let input = inputs.get(store);
  if (!input) {
    input = new RotationInput();
    inputs.set(store, input);
  }
  return input;
}
