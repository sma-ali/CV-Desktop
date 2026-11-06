'use client';

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { createContext, useContext, useMemo, useRef } from 'react';
import { Quaternion, Vector3, type Group, type Material, type PerspectiveCamera } from 'three';
import { ease, easeOut, lerp } from '../core/math';
import { ITEM_POSES } from '../core/constants';
import { isBodyId, type ItemId } from '../core/ids';
import type { FrameState } from '../core/store';
import { useSceneStoreApi } from '../core/store-context';
import { gestureHub } from '../gestures/hub';
import { claimBody, claimHeld, GESTURES_AFTER } from '../gestures/pointer';
import {
  createPresentState,
  followSpin,
  glowLevel,
  heldPose,
  HOVER_LIFT,
  ITEMS_PRIORITY,
  stepPresentation,
  type PresentInput,
  type PresentState,
  type RestPose,
} from './presentation';

// Le comportement commun des objets du CV : survol (léger relèvement, lueur,
// curseur main), clic (présenter, puis retourner l'objet tenu), présentation
// devant la caméra et pose de l'étiquette (TagLayer). Chaque objet appelle ce
// hook et pose `ref` et `handlers` sur son groupe racine.
//
// Un objet qui est un corps (BODY_IDS) repose à sa pose du
// plateau, store.desk[id] (position et orientation complètes, écrites par le
// moteur physique : il peut être renversé, ou tombé). Un appui le désigne
// au glisser (claimBody) ; un glisser n'arrive jamais jusqu'au clic
// (Gestures avale le clic qui le termine). Le geste de présentation suit
// store.flipped ; tenu, l'objet suit un peu le pointeur (lissé par les
// gestes) et prend la rotation libre du visiteur (store.heldSpin).

/** Avancement de la présentation de chaque objet, lu par CvItems pour frame.presentLevel. */
export class PresentProgress {
  private readonly values = new Map<ItemId, number>();

  set(id: ItemId, value: number): void {
    this.values.set(id, value);
  }

  get(id: ItemId): number {
    return this.values.get(id) ?? 0;
  }

  /** L'avancement de l'objet le plus soulevé (0 si aucun). */
  max(): number {
    let level = 0;
    for (const value of this.values.values()) level = Math.max(level, value);
    return level;
  }
}

export const ProgressContext = createContext<PresentProgress | null>(null);

/** Hauteur (unités du bureau) du sommet de l'arc que décrit un objet soulevé, avant le facteur arc. */
const ARC_HEIGHT = 1.2;

/** L'objet finit de tourner un peu avant d'arriver (à 1 / TURN_LEAD de son trajet). */
const TURN_LEAD = 1.15;

/** Avant cet instant de l'arrivée, un clic sur un objet ne fait rien. */
const CLICK_AFTER = GESTURES_AFTER;

/** Un matériau qui luit au survol et pendant la présentation. */
type Glowing = Material & { emissiveIntensity: number };

export interface PresentationOptions {
  id: ItemId;
  /**
   * Pose de repos sur le bureau. Pour un corps (BODY_IDS), elle ne sert pas :
   * la pose vient de store.desk.
   */
  rest: RestPose;
  /** false : l'objet ne se soulève pas (l'écran, que la caméra vient regarder). */
  lift?: boolean;
  /** Hauteur de l'arc du soulèvement (1 ; 0.4 pour un objet collé). */
  arc?: number;
  /** Décale le balancement d'un objet à l'autre. */
  seed?: number;
  /** Matériaux dont la lueur suit le survol et la présentation. */
  glow?: readonly Glowing[];
  /** Lueur au repos. */
  glowBase?: number;
  /** Animations propres à l'objet (ouvrir, allumer), à chaque image. */
  animate?: (state: PresentState, frame: FrameState) => void;
}

/** Règle la lueur des matériaux (hors du hook : un matériau three se modifie en place). */
function setGlow(materials: readonly Glowing[], level: number): void {
  for (const material of materials) material.emissiveIntensity = level;
}

const restPosition = new Vector3();
const restQuaternion = new Quaternion();
const heldPosition = new Vector3();
const heldQuaternion = new Quaternion();
const input: PresentInput = { t: 0, pointerX: 0, pointerY: 0 };

export function usePresentation({
  id,
  rest,
  lift = true,
  arc = 1,
  seed = 0,
  glow,
  glowBase = 0,
  animate,
}: PresentationOptions) {
  const store = useSceneStoreApi();
  const progress = useContext(ProgressContext);
  const get = useThree((state) => state.get);
  const ref = useRef<Group>(null);
  const state = useRef<PresentState>(createPresentState());
  // La rotation libre de cet objet, gardée pendant son retour (followSpin).
  const spin = useMemo(() => new Quaternion(), []);
  const pose = ITEM_POSES[id];

  useFrame((three) => {
    const group = ref.current;
    const scene = store.getState();
    const { frame, settings } = scene;
    const reduced = settings.reducedMotion;
    const hub = gestureHub(store);
    // Horloge gelée (?fige, captures et tests) : la présentation se pose
    // aussitôt dans son état final, comme en mouvement réduit, au lieu de
    // dépendre du nombre d'images que la machine arrive à dessiner.
    const current = stepPresentation(
      state.current,
      scene.presented === id,
      // Pendant un glisser, rien ne se relève au survol (le corps glissé
      // passe sous le pointeur et sous ses voisins).
      scene.hovered === id && scene.dragging === null,
      frame.dt,
      reduced || scene.clock.frozen,
      scene.flipped,
    );
    followSpin(
      spin,
      scene.heldSpin,
      scene.presented === id,
      current.p,
      frame.dt,
      reduced || scene.clock.frozen,
    );
    progress?.set(id, current.p);
    hub.progress.set(id, current.p);

    if (group && lift) {
      // Un corps repose à sa pose du plateau (store.desk), qui suit le
      // format tant que personne ne l'a déplacé.
      const body = isBodyId(id) ? scene.desk[id] : null;
      group.visible = !body?.waiting;
      if (body) {
        restPosition.set(body.x, body.y, body.z);
        restQuaternion.set(body.qx, body.qy, body.qz, body.qw);
      } else {
        restPosition.copy(rest.position);
        restQuaternion.copy(rest.quaternion);
      }
      restPosition.y += current.hover * HOVER_LIFT;
      if (current.p <= 0) {
        group.position.copy(restPosition);
        group.quaternion.copy(restQuaternion);
        group.scale.setScalar(1);
      } else {
        // Mouvement réduit : ni balancement ni suivi du pointeur.
        input.t = reduced ? 0 : frame.t;
        input.pointerX = reduced ? 0 : hub.pointer.x;
        input.pointerY = reduced ? 0 : hub.pointer.y;
        const scale = heldPose(
          three.camera as PerspectiveCamera,
          pose,
          frame.portrait,
          current.f,
          seed,
          input,
          heldPosition,
          heldQuaternion,
        );
        // La rotation libre du visiteur, par-dessus la pose tenue.
        if (spin.w !== 1) heldQuaternion.premultiply(spin);
        const k = ease(current.p);
        group.position.lerpVectors(restPosition, heldPosition, k);
        group.position.y += Math.sin(Math.PI * k) * ARC_HEIGHT * arc;
        group.quaternion
          .copy(restQuaternion)
          .slerp(heldQuaternion, easeOut(Math.min(1, current.p * TURN_LEAD)));
        group.scale.setScalar(lerp(1, scale, k));
      }
    }

    if (glow) setGlow(glow, glowLevel(current, glowBase));
    animate?.(current, frame);
  }, ITEMS_PRIORITY);

  const handlers = useMemo(() => {
    const setCursor = (cursor: string) => {
      get().gl.domElement.style.cursor = cursor;
    };
    return {
      onClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        const scene = store.getState();
        if (!scene.settings.reducedMotion && scene.frame.t < CLICK_AFTER) return;
        if (scene.presented !== id) {
          scene.present(id, 'click');
        } else if (id === 'monitor') {
          // L'écran ne se retourne pas : un clic quitte le gros plan.
          scene.markUser();
          scene.putBack();
        } else {
          // Un clic sur l'objet tenu le retourne, un autre le remet à l'endroit.
          scene.toggleFlip();
        }
      },
      onPointerDown(event: ThreeEvent<PointerEvent>) {
        const scene = store.getState();
        // L'objet présenté : l'appui lui est réservé (rotation libre).
        if (scene.presented === id && id !== 'monitor') {
          claimHeld(store, event);
          return;
        }
        // Seul un corps posé sur le plateau glisse (pas l'objet tenu, ni celui qui revient).
        if (isBodyId(id) && scene.presented !== id && state.current.p < 0.05) {
          claimBody(store, event, id);
        }
      },
      onPointerOver(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        // Au doigt, pas de survol : le toucher présente directement.
        if (event.pointerType === 'touch') return;
        const scene = store.getState();
        scene.setHovered(id);
        if (scene.dragging === null) setCursor('pointer');
      },
      onPointerOut() {
        const scene = store.getState();
        if (scene.hovered === id) scene.setHovered(null);
        if (scene.dragging === null) setCursor('');
      },
    };
  }, [get, id, store]);

  return { ref, handlers };
}
