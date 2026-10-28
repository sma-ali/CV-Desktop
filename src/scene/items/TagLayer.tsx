'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Vector3, type Camera, type Object3D } from 'three';
import { ITEM_POSES } from '../core/constants';
import type { ItemId } from '../core/ids';
import type { SceneStore } from '../core/store';
import { useSceneStore, useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { ITEMS_PRIORITY } from './presentation';
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

const TAGGED = ['book', 'postit', 'laptop', 'card', 'chest'] as const satisfies ItemId[];

interface TagElement {
  id: ItemId;
  element: HTMLDivElement;
  width: number;
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
      const element = document.createElement('div');
      element.className = styles.tag ?? '';
      element.dataset.item = id;
      element.dataset.shown = 'false';
      if (id === 'chest') element.dataset.live = 'true';
      const mark = document.createElement('b');
      mark.textContent = labels[id].mark;
      const word = document.createElement('span');
      word.textContent = labels[id].text;
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
      return { id, element, width: 0, shown: false, transform: '' };
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

  /** Place chaque étiquette sous son objet ; ne touche au DOM que si quelque chose change. */
  update(
    camera: Camera,
    size: { width: number; height: number },
    visible: boolean,
    anchors: TagAnchors,
    progress: PresentProgress,
  ): void {
    for (const tag of this.tags) {
      const anchor = anchors.get(tag.id);
      let shown = false;
      if (anchor && visible && progress.get(tag.id) < 0.02) {
        anchor.getWorldPosition(projected).project(camera);
        shown = projected.z < 1;
        if (shown) {
          // Mesurée une fois, quand elle se montre : l'étiquette ne sort pas de la fenêtre.
          if (!tag.width) tag.width = tag.element.offsetWidth;
          const half = tag.width / 2 + 6;
          const x = Math.min(
            Math.max((projected.x * 0.5 + 0.5) * size.width, half),
            size.width - half,
          );
          const y = (-projected.y * 0.5 + 0.5) * size.height;
          const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
          if (transform !== tag.transform) {
            tag.transform = transform;
            tag.element.style.transform = transform;
          }
        }
      }
      if (shown !== tag.shown) {
        tag.shown = shown;
        tag.element.dataset.shown = shown ? 'true' : 'false';
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
