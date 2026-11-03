import type { Vec3 } from '../core/constants';

// Le kimono de grappling plié et sa ceinture nouée, en données pures (sans
// three) : des pavés posés dans le repère du kimono (origine au centre de
// son pied, au ras du plateau, avant sa rotation). Kimono.tsx en fait des
// pièces fusionnées ; kimono.test.ts vérifie qu'elles tiennent dans la
// forme de collision et que la ceinture se lit vue de dessus.
//
// Vu de dessus : un rectangle bleu marine aux plis étagés (pantalon, veste,
// manches repliées), le col épais qui fait un V sur la moitié gauche, et la
// ceinture blanche qui fait le tour du paquet par le travers, nouée sur le
// dessus, ses deux pans en V vers le visiteur. Aucune marque, aucun écusson,
// aucune broderie.

/** Les couleurs, dans la palette du bureau (bleu nuit chaud, crème). */
export const KIMONO_COLORS = {
  /** Le pantalon plié, dessous : le plus sombre. */
  pants: 0x161d31,
  /** Le corps de la veste. */
  jacket: 0x1f2a46,
  /** Les manches repliées, dessus : un ton plus clair, pour lire le pli. */
  sleeves: 0x2a3758,
  /** Le col, épais et serré : plus sombre que la veste. */
  collar: 0x121828,
  /** Les coutures du col, ton sur ton clair. */
  stitch: 0x56648a,
  /** La ceinture blanche, crème sous la lampe. */
  belt: 0xd9d1bf,
  /** L'ombre du nœud. */
  beltShade: 0xb9b09c,
} as const;

/** Encombrement du paquet plié (sans la ceinture) : largeur (x), hauteur, profondeur (z). */
export const KIMONO_SIZE = { w: 1.5, h: 0.26, d: 1.02 } as const;

/** Où la ceinture traverse le paquet (x, repère du kimono) et sa largeur. */
export const BELT = { x: 0.3, width: 0.14, thickness: 0.022 } as const;

/** Une pièce du kimono : un pavé, sa taille, sa place et sa rotation (Euler XYZ). */
export interface KimonoBlock {
  name: string;
  size: Vec3;
  at: Vec3;
  rotation?: Vec3;
  color: number;
  /** satin pour le tissu épais (col, ceinture), mat pour le reste. */
  finish: 'matte' | 'satin';
}

const { w, h, d } = KIMONO_SIZE;
const C = KIMONO_COLORS;

// Trois couches étagées : chacune un peu en retrait de la précédente, pour
// que les plis se lisent sur les bords.
const PANTS_H = 0.09;
const JACKET_H = 0.1;
const SLEEVES_H = h - PANTS_H - JACKET_H;
const TOP = h;

/** Le col en V : deux bandes qui partent du fond et se rejoignent devant, à gauche de la ceinture. */
const COLLAR = {
  apexX: -0.32,
  apexZ: 0.34,
  spread: 0.34,
  backZ: -0.44,
  width: 0.12,
  height: 0.035,
};

function collarArm(side: -1 | 1): KimonoBlock[] {
  const fromX = COLLAR.apexX + side * COLLAR.spread;
  const dx = COLLAR.apexX - fromX;
  const dz = COLLAR.apexZ - COLLAR.backZ;
  const length = Math.hypot(dx, dz);
  // Rotation autour de y qui aligne la longueur (z local) sur la bande.
  const ry = Math.atan2(dx, dz);
  const cx = (fromX + COLLAR.apexX) / 2;
  const cz = (COLLAR.backZ + COLLAR.apexZ) / 2;
  const y = TOP + COLLAR.height / 2;
  // La couture court le long du bord intérieur du col.
  const inward = -side * (COLLAR.width / 2 - 0.018);
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  return [
    {
      name: `collar-${side < 0 ? 'left' : 'right'}`,
      size: [COLLAR.width, COLLAR.height, length],
      at: [cx, y, cz],
      rotation: [0, ry, 0],
      color: C.collar,
      finish: 'satin',
    },
    {
      name: `stitch-${side < 0 ? 'left' : 'right'}`,
      size: [0.012, 0.004, length * 0.92],
      at: [cx + inward * cos, TOP + COLLAR.height + 0.002, cz - inward * sin],
      rotation: [0, ry, 0],
      color: C.stitch,
      finish: 'matte',
    },
  ];
}

/** Les pans de la ceinture, du nœud vers l'avant, en V. */
function beltTail(side: -1 | 1): KimonoBlock {
  const length = 0.42;
  const ry = side * 0.42;
  const from: [number, number] = [BELT.x + side * 0.04, 0.06];
  return {
    name: `belt-tail-${side < 0 ? 'left' : 'right'}`,
    size: [BELT.width * 0.92, BELT.thickness, length],
    at: [
      from[0] + Math.sin(ry) * (length / 2),
      TOP + BELT.thickness * 1.5,
      from[1] + Math.cos(ry) * (length / 2),
    ],
    // Le pan descend un peu vers son bout.
    rotation: [0.06, ry, 0],
    color: C.belt,
    finish: 'satin',
  };
}

/** Toutes les pièces du kimono plié et de sa ceinture. */
export function kimonoBlocks(): KimonoBlock[] {
  const belt = BELT;
  const wrap = belt.thickness;
  return [
    // Le pantalon, dessous, le plus large.
    {
      name: 'pants',
      size: [w, PANTS_H, d],
      at: [0, PANTS_H / 2, 0],
      color: C.pants,
      finish: 'matte',
    },
    // La veste, un peu en retrait.
    {
      name: 'jacket',
      size: [w - 0.05, JACKET_H, d - 0.04],
      at: [-0.01, PANTS_H + JACKET_H / 2, -0.01],
      color: C.jacket,
      finish: 'matte',
    },
    // Les manches repliées, dessus.
    {
      name: 'sleeves',
      size: [w - 0.12, SLEEVES_H, d - 0.1],
      at: [0.02, PANTS_H + JACKET_H + SLEEVES_H / 2, -0.02],
      color: C.sleeves,
      finish: 'matte',
    },
    ...collarArm(-1),
    ...collarArm(1),
    // La ceinture fait le tour du paquet par le travers : dessus, devant, derrière.
    {
      name: 'belt-top',
      size: [belt.width, wrap, d - 0.06],
      at: [belt.x, TOP + wrap / 2, -0.02],
      color: C.belt,
      finish: 'satin',
    },
    {
      name: 'belt-front',
      size: [belt.width, h, wrap],
      at: [belt.x, h / 2, d / 2 + wrap / 2],
      color: C.belt,
      finish: 'satin',
    },
    {
      name: 'belt-back',
      size: [belt.width, h, wrap],
      at: [belt.x, h / 2, -d / 2 - wrap / 2],
      color: C.belt,
      finish: 'satin',
    },
    // Le nœud, sur le dessus, un peu vers l'avant, et ses deux pans en V.
    {
      name: 'belt-knot',
      size: [0.2, 0.06, 0.15],
      at: [belt.x, TOP + 0.03, 0.04],
      rotation: [0, 0.18, 0],
      color: C.belt,
      finish: 'satin',
    },
    {
      name: 'belt-knot-fold',
      size: [0.06, 0.065, 0.16],
      at: [belt.x + 0.01, TOP + 0.035, 0.04],
      rotation: [0, 0.18, 0],
      color: C.beltShade,
      finish: 'satin',
    },
    beltTail(-1),
    beltTail(1),
  ];
}

/** Hauteur du sommet du nœud, au-dessus du plateau. */
export const KIMONO_TOP = TOP + 0.065;
