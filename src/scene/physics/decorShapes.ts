import { LAMP, type Vec3 } from '../core/constants';
import type { DecorBodyId } from '../core/ids';
import { KIMONO, KIMONO_FOOTPRINT, MANGA, MANGA_SIZE, MANGA_TOP } from '../decor/layout';
import { box, type BodySpec } from './shapes';

// Les formes de collision du décor : une boîte, un cylindre ou
// quelques gélules par morceau, dans le repère du corps. L'origine d'un
// morceau est son ancre (DECOR_ANCHORS) au ras du plateau ; la tasse et la
// manette ont la leur (elles sont dessinées dans leur propre repère). Les
// tailles viennent de decor/layout.ts : à recaler si un morceau change.

/** Un point de la lampe, dans le repère de son pied. */
const lampLocal = ([x, y, z]: Vec3): Vec3 => [x - LAMP.base[0], y, z - LAMP.base[2]];

export const DECOR_BODY_SPECS: Readonly<Record<DecorBodyId, BodySpec>> = {
  mug: {
    shapes: [
      { kind: 'cylinder', radius: 0.3, halfHeight: 0.3, at: [0, 0.3, 0] },
      box([0.08, 0.14, 0.04], [0.36, 0.32, 0]),
    ],
    density: 1.1,
  },
  pad: { shapes: [box([0.68, 0.16, 0.38], [0, 0.16, 0.08])], density: 0.7 },
  keyboard: { shapes: [box([2.1, 0.11, 0.75], [0, 0.11, -0.06])], density: 0.9 },
  mouse: { shapes: [box([0.22, 0.12, 0.32])], density: 0.6 },
  // Un pied lourd, un bras et une tête légers : la lampe tient debout tant
  // qu'on ne la pousse pas fort, et se couche si on la renverse.
  lamp: {
    shapes: [
      { kind: 'cylinder', radius: 0.45, halfHeight: 0.07, at: [0, 0.07, 0], density: 40 },
      { kind: 'capsule', from: [0, 0.16, 0], to: lampLocal(LAMP.elbow), radius: 0.07 },
      { kind: 'capsule', from: lampLocal(LAMP.elbow), to: lampLocal(LAMP.head), radius: 0.07 },
      { kind: 'ball', radius: 0.4, at: lampLocal(LAMP.head) },
    ],
    density: 0.3,
  },
  plant: {
    shapes: [
      { kind: 'cylinder', radius: 0.35, halfHeight: 0.27, at: [0, 0.27, 0] },
      { kind: 'ball', radius: 0.45, at: [0, 1.0, 0] },
    ],
    density: 0.8,
  },
  manga: {
    shapes: [
      box(
        [MANGA_SIZE.w / 2, MANGA_TOP / 2, MANGA_SIZE.d / 2],
        [0, MANGA_TOP / 2, 0],
        [0, MANGA.ry, 0],
      ),
      // Le robot debout sur la pile.
      box([0.17, 0.24, 0.14], [0.05, MANGA_TOP + 0.24, 0]),
    ],
    density: 0.9,
  },
  fox: { shapes: [box([0.2, 0.22, 0.2])], density: 0.6 },
  wanderer: { shapes: [box([0.18, 0.3, 0.18])], density: 0.6 },
  rope: { shapes: [box([0.55, 0.06, 0.46])], density: 0.5 },
  wraps: { shapes: [box([0.38, 0.17, 0.38])], density: 0.5 },
  // Le paquet plié, ceinture comprise (le nœud dépasse à peine).
  kimono: {
    shapes: [
      box(
        [KIMONO_FOOTPRINT.hw, KIMONO_FOOTPRINT.height / 2, KIMONO_FOOTPRINT.hd],
        [0, KIMONO_FOOTPRINT.height / 2, 0],
        [0, KIMONO.ry, 0],
      ),
    ],
    density: 0.5,
  },
};
