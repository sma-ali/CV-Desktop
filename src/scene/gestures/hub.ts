import type { BodyId, ItemId } from '../core/ids';
import type { SceneStore } from '../core/store';
import type { PhysicsControl } from '../core/physicsControl';

// Ce que partagent les gestes (Gestures, posé à côté des objets dans
// Scene.tsx), les objets qu'on prend (usePresentation, DecorPiece), le
// moteur physique (chargé à part), la rotation et le rangement : l'appui en
// cours, le pointeur lissé que l'objet tenu suit, l'avancement de la
// présentation de chaque objet (un objet qui quitte le plateau sort du
// monde physique), et le monde physique lui-même une fois prêt. Un par
// store, donc un par page : rien en global.

/** Seuil du glisser (pixels) : en deçà, un appui reste un clic. */
export const DRAG_THRESHOLD = 7;

/** Un appui du pointeur sur le canvas, jusqu'au relâchement. */
export interface Press {
  pointerId: number;
  pointerType: string;
  /** Point d'appui, en pixels de la fenêtre. */
  x: number;
  y: number;
  /** Le corps sous le pointeur à l'appui (null : rien qui glisse). */
  body: BodyId | null;
  /**
   * L'appui a commencé sur l'objet présenté (au-delà du seuil,
   * il le fait tourner ; en deçà, c'est un clic qui le retourne).
   */
  held: boolean;
  /** Plus grande distance parcourue depuis l'appui, en pixels. */
  travel: number;
}

export class GestureHub {
  press: Press | null = null;
  /** Le monde physique, une fois chargé (null avant, ou en échec). */
  physics: PhysicsControl | null = null;
  /** Dernière position du pointeur dans la fenêtre (pixels) : le glisser la vise à chaque image. */
  readonly client = { x: 0, y: 0 };
  /**
   * Le pointeur lissé, de -1 à 1 (x vers la droite, y vers le haut), que
   * l'objet tenu suit un peu ; target est la dernière position de la souris
   * (0 au doigt : un tap ne fait pas pencher l'objet).
   */
  readonly pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  /** Avancement de la présentation de chaque objet (écrit par usePresentation). */
  readonly progress = new Map<ItemId, number>();
  /** Le prochain clic sur le canvas vient d'un glisser : personne ne doit le voir. */
  swallowClick = false;

  /**
   * Un appui commence (écouteur du canvas, puis l'objet sous le pointeur
   * pour le même événement). Un nouvel appui remplace l'ancien, sauf
   * pendant le glisser d'un autre doigt.
   */
  down(pointerId: number, pointerType: string, x: number, y: number, dragging = false): void {
    const press = this.press;
    if (
      press &&
      press.pointerId === pointerId &&
      press.x === x &&
      press.y === y &&
      press.travel === 0
    ) {
      return;
    }
    if (press && press.pointerId !== pointerId && dragging) return;
    this.swallowClick = false;
    this.client.x = x;
    this.client.y = y;
    this.press = { pointerId, pointerType, x, y, body: null, held: false, travel: 0 };
  }

  /** Un corps est-il en train de glisser ? */
  get dragging(): boolean {
    return (this.physics?.grabbed ?? null) !== null;
  }

  /** L'appui est sur un corps qui glisse (gestionnaire onPointerDown de l'objet). */
  claim(pointerId: number, pointerType: string, x: number, y: number, body: BodyId): void {
    this.down(pointerId, pointerType, x, y, this.dragging);
    if (this.press?.pointerId === pointerId) this.press.body = body;
  }

  /** L'appui est sur l'objet présenté (gestionnaire onPointerDown de usePresentation). */
  claimHeld(pointerId: number, pointerType: string, x: number, y: number): void {
    this.down(pointerId, pointerType, x, y, this.dragging);
    if (this.press?.pointerId === pointerId) this.press.held = true;
  }

  reset(): void {
    this.press = null;
    this.swallowClick = false;
  }
}

const hubs = new WeakMap<SceneStore, GestureHub>();

/** Le moyeu des gestes de ce store (créé au premier appel). */
export function gestureHub(store: SceneStore): GestureHub {
  let hub = hubs.get(store);
  if (!hub) {
    hub = new GestureHub();
    hubs.set(store, hub);
  }
  return hub;
}
