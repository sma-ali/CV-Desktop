'use client';

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { createContext, useContext, useMemo, useRef } from 'react';
import {
  Euler,
  Quaternion,
  Vector3,
  type Group,
  type Material,
  type PerspectiveCamera,
} from 'three';
import { ease, easeOut, lerp } from '../core/arrival';
import { ITEM_POSES } from '../core/constants';
import { isBodyId, type ItemId } from '../core/ids';
import type { FrameState } from '../core/store';
import { useSceneStoreApi } from '../core/store-context';
import {
  createPresentState,
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
// curseur main), clic (présenter ou reposer), présentation devant la caméra
// et pose de l'étiquette (TagLayer). Chaque objet appelle ce hook et pose `ref` et `handlers` sur
// son groupe racine.
//
// Étape 4 (partie « gestes ») : un objet glissable (BODY_IDS) repose à sa
// place du plateau, store.desk[id], que les gestes déplacent ; son
// soulèvement, son inclinaison et son écrasement en viennent aussi. Le geste
// de présentation suit store.flipped.

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

/** Avant cet instant de l'arrivée, un clic sur un objet ne fait rien (comme le prototype). */
const CLICK_AFTER = 1.2;

/** Un matériau qui luit au survol et pendant la présentation. */
type Glowing = Material & { emissiveIntensity: number };

export interface PresentationOptions {
  id: ItemId;
  /**
   * Pose de repos sur le bureau. Pour un objet glissable, seule sa hauteur
   * (rest.position.y) compte : x, z et la rotation viennent de store.desk.
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
const restEuler = new Euler();
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
  const pose = ITEM_POSES[id];

  useFrame((three) => {
    const group = ref.current;
    const scene = store.getState();
    const { frame, settings } = scene;
    const reduced = settings.reducedMotion;
    // Horloge gelée (?fige, captures et tests) : la présentation se pose
    // aussitôt dans son état final, comme en mouvement réduit, au lieu de
    // dépendre du nombre d'images que la machine arrive à dessiner.
    const current = stepPresentation(
      state.current,
      scene.presented === id,
      scene.hovered === id,
      frame.dt,
      reduced || scene.clock.frozen,
      scene.flipped,
    );
    progress?.set(id, current.p);

    if (group && lift) {
      // Un objet glissable repose à sa place du plateau (store.desk), qui
      // suit le format (le coffret change de place en portrait).
      const body = isBodyId(id) ? scene.desk[id] : null;
      let squash = 1;
      if (body) {
        restPosition.set(body.x, rest.position.y + body.lift, body.z);
        restQuaternion.setFromEuler(restEuler.set(body.tiltX, body.ry, body.tiltZ));
        squash = 1 + Math.sin(body.squash * Math.PI) * 0.06;
      } else {
        restPosition.copy(rest.position);
        restQuaternion.copy(rest.quaternion);
      }
      restPosition.y += current.hover * HOVER_LIFT;
      if (current.p <= 0) {
        group.position.copy(restPosition);
        group.quaternion.copy(restQuaternion);
        group.scale.set(squash, 1 / squash, squash);
      } else {
        // Mouvement réduit : ni balancement ni suivi du pointeur.
        input.t = reduced ? 0 : frame.t;
        input.pointerX = reduced ? 0 : three.pointer.x;
        input.pointerY = reduced ? 0 : three.pointer.y;
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
        const k = ease(current.p);
        group.position.lerpVectors(restPosition, heldPosition, k);
        group.position.y += Math.sin(Math.PI * k) * 1.2 * arc;
        group.quaternion
          .copy(restQuaternion)
          .slerp(heldQuaternion, easeOut(Math.min(1, current.p * 1.15)));
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
        if (scene.presented === id) {
          scene.markUser();
          scene.putBack();
        } else {
          scene.present(id, 'click');
        }
      },
      onPointerOver(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        // Au doigt, pas de survol : le toucher présente directement.
        if (event.pointerType === 'touch') return;
        store.getState().setHovered(id);
        setCursor('pointer');
      },
      onPointerOut() {
        const scene = store.getState();
        if (scene.hovered === id) scene.setHovered(null);
        setCursor('');
      },
    };
  }, [get, id, store]);

  return { ref, handlers };
}
