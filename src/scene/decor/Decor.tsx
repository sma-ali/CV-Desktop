'use client';

import { Box } from '../core/geometry';
import { DESK, DESK_THICKNESS, WALL_Z } from '../core/constants';
import { standardMaterial } from '../core/materials';

// PROVISOIRE : le plateau et le mur, en aplats, pour que les autres parties
// aient un rendu correct. La partie « décor » remplace ce fichier (plateau
// en bois peint, mur et fenêtre, lampe, clavier, tapis, matériel de stream,
// plante, mangas, figurines, tasse, manette...).
export function Decor() {
  const width = DESK.x1 - DESK.x0;
  const depth = DESK.z1 - DESK.z0;
  return (
    <group>
      <Box
        size={[width, DESK_THICKNESS, depth]}
        position={[0, -DESK_THICKNESS / 2, (DESK.z0 + DESK.z1) / 2]}
        material={standardMaterial(0x5f3c25, { roughness: 0.62 })}
      />
      <Box
        size={[32, 17.4, 0.1]}
        position={[0, 5.3, WALL_Z - 0.05]}
        material={standardMaterial(0xb09478, { roughness: 0.95 })}
        castShadow={false}
      />
    </group>
  );
}
