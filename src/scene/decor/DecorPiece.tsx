'use client';

import type { ReactNode } from 'react';
import { usePortrait } from '../core/portrait';
import { decorPieceTransform, type DecorPieceId } from './layout';

// Un morceau du décor posé à sa place du format (le bureau resserré du
// téléphone en portrait, PORTRAIT_DECOR) : ses enfants, dessinés à leur
// place en paysage, tournent autour de son ancre et suivent l'ancre. En
// paysage, la transformation est l'identité. Un morceau caché en portrait
// n'est pas rendu du tout (ni dessiné, ni touché par le pointeur).
export function DecorPiece({ id, children }: { id: DecorPieceId; children: ReactNode }) {
  const portrait = usePortrait();
  const { position, ry, offset, hidden } = decorPieceTransform(id, portrait);
  if (hidden) return null;
  return (
    <group name={`piece-${id}`} position={position} rotation={[0, ry, 0]}>
      <group position={offset}>{children}</group>
    </group>
  );
}
