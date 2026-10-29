'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Vector3, type Camera, type Object3D } from 'three';
import { ITEM_POSES } from '../core/constants';
import { ITEM_IDS, type ItemId } from '../core/ids';
import type { SceneStore } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { ITEMS_PRIORITY } from './presentation';
import { spreadTags, type TagBox } from './tagSpread';
import type { PresentProgress } from './usePresentation';
import styles from './TagLayer.module.css';

// Les étiquettes accrochées aux objets du CV (TAG_FOR du prototype) : un
// repère (« 2020 ») et un mot, dans la langue de la page. Une couche HTML
// posée sur le canvas, construite à la main (comme le prototype) : pas de
// racine React par étiquette, une seule projection par image.
//
// Elles sont décoratives pour les lecteurs d'écran (aria-hidden, hors de la
// tabulation) : les puces du HUD portent la même information au clavier. Un
// clic présente l'objet ; il ne traverse pas jusqu'à la scène, où il
// reposerait aussitôt l'objet dessous.

/** Les objets qui portent une étiquette, et leur point d'accroche. */
export type TagAnchors = Map<ItemId, Object3D>;

export const TagAnchorsContext = createContext<TagAnchors | null>(null);

/** Le point d'accroche de l'étiquette d'un objet, dans le repère de l'objet. */
export function TagAnchor({ id }: { id: ItemId }) {
  const anchors = useContext(TagAnchorsContext);
  const ref = useRef<Object3D>(null);
  const anchor = ITEM_POSES[id].tag;
  useEffect(() => {
    const object = ref.current;
    if (!anchors || !object) return;
    anchors.set(id, object);
    return () => {
      anchors.delete(id);
    };
  }, [anchors, id]);
  return anchor ? <object3D ref={ref} position={[0, anchor.y, anchor.z]} /> : null;
}

/** Un objet étiqueté : sa pose a un point d'accroche, et le contenu une étiquette (scene.test.ts). */
type TaggedId = ItemId & keyof SceneTexts['content']['labels'];

const isTagged = (id: ItemId): id is TaggedId => ITEM_POSES[id].tag !== null;

/** Les objets étiquetés, dans l'ordre de ITEM_IDS : les nouveaux objets en ont une d'office. */
const TAGGED = ITEM_IDS.filter(isTagged);

interface TagElement {
  id: ItemId;
  element: HTMLDivElement;
  /** Place à l'écran (pixels), avant puis après l'écartement des voisines. */
  box: TagBox;
  measured: boolean;
  shown: boolean;
  transform: string;
}

const projected = new Vector3();

/** La couche des étiquettes : ses éléments DOM et leur dernier état, hors de React. */
class TagOverlay {
  private layer: HTMLDivElement | null = null;
  private tags: TagElement[] = [];

  mount(host: HTMLElement, labels: SceneTexts['content']['labels'], store: SceneStore): void {
    this.unmount();
    const layer = document.createElement('div');
    layer.className = styles.layer ?? '';
    layer.setAttribute('aria-hidden', 'true');
    const stop = (event: Event) => event.stopPropagation();
    this.tags = TAGGED.map((id): TagElement => {
      const label = labels[id];
      const element = document.createElement('div');
      element.className = styles.tag ?? '';
      element.dataset.item = id;
      element.dataset.shown = 'false';
      if (id === 'chest') element.dataset.live = 'true';
      const mark = document.createElement('b');
      mark.textContent = label.mark;
      const word = document.createElement('span');
      word.textContent = label.text;
      element.append(mark, word);
      element.addEventListener('pointerdown', stop);
      element.addEventListener('pointerup', stop);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        store.getState().present(id, 'tag');
      });
      element.addEventListener('pointerenter', () => store.getState().setHovered(id));
      element.addEventListener('pointerleave', () => {
        const scene = store.getState();
        if (scene.hovered === id) scene.setHovered(null);
      });
      layer.append(element);
      return {
        id,
        element,
        box: { x: 0, y: 0, w: 0, h: 0 },
        measured: false,
        shown: false,
        transform: '',
      };
    });
    host.append(layer);
    this.layer = layer;
  }

  unmount(): void {
    this.layer?.remove();
    this.layer = null;
    this.tags = [];
  }

  /** Mouvement réduit ou horloge gelée : le point vert ne pulse pas. */
  setStill(still: boolean): void {
    this.layer?.toggleAttribute('data-still', still);
  }

  /** Les étiquettes visibles de l'image, réutilisé d'une image à l'autre. */
  private readonly visibleBoxes: TagBox[] = [];
  private lastWidth = 0;
  private lastHeight = 0;

  /**
   * Place chaque étiquette sous son objet, écarte celles qui se chevauchent,
   * et ne touche au DOM que si quelque chose change.
   */
  update(
    camera: Camera,
    size: { width: number; height: number },
    visible: boolean,
    anchors: TagAnchors,
    progress: PresentProgress,
  ): void {
    const boxes = this.visibleBoxes;
    boxes.length = 0;
    // Le format change (téléphone tourné) : les étiquettes changent de taille.
    if (size.width !== this.lastWidth || size.height !== this.lastHeight) {
      this.lastWidth = size.width;
      this.lastHeight = size.height;
      for (const tag of this.tags) tag.measured = false;
    }
    for (const tag of this.tags) {
      const anchor = anchors.get(tag.id);
      let shown = false;
      if (anchor && visible && progress.get(tag.id) < 0.02) {
        anchor.getWorldPosition(projected).project(camera);
        shown = projected.z < 1;
        if (shown) {
          // Mesurée une fois, quand elle se montre.
          if (!tag.measured) {
            tag.box.w = tag.element.offsetWidth;
            tag.box.h = tag.element.offsetHeight;
            tag.measured = tag.box.w > 0;
          }
          tag.box.x = (projected.x * 0.5 + 0.5) * size.width;
          tag.box.y = (-projected.y * 0.5 + 0.5) * size.height;
          boxes.push(tag.box);
        }
      }
      if (shown !== tag.shown) {
        tag.shown = shown;
        tag.element.dataset.shown = shown ? 'true' : 'false';
      }
    }
    // Dans la fenêtre, et sans chevauchement (le bureau est petit sur téléphone).
    spreadTags(boxes, size.width);
    for (const tag of this.tags) {
      if (!tag.shown) continue;
      const transform = `translate(${Math.round(tag.box.x)}px, ${Math.round(tag.box.y)}px) translate(-50%, -100%)`;
      if (transform !== tag.transform) {
        tag.transform = transform;
        tag.element.style.transform = transform;
      }
    }
  }
}

export function TagLayer({ texts, progress }: { texts: SceneTexts; progress: PresentProgress }) {
  const store = useSceneStoreApi();
  const anchors = useContext(TagAnchorsContext);
  const gl = useThree((state) => state.gl);
  const still = useSceneStore((state) => state.settings.reducedMotion || state.settings.frozen);
  const [overlay] = useState(() => new TagOverlay());
  const { labels } = texts.content;

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    overlay.mount(host, labels, store);
    return () => overlay.unmount();
  }, [gl, labels, overlay, store]);

  useEffect(() => overlay.setStill(still), [overlay, still, labels]);

  useFrame(({ camera, size }) => {
    if (!anchors) return;
    const { hud, presented } = store.getState();
    overlay.update(camera, size, hud.tags && presented === null, anchors, progress);
  }, ITEMS_PRIORITY + 1);

  return null;
}
