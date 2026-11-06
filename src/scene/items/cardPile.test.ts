import { describe, expect, it } from 'vitest';
import { BODY_FOOTPRINTS } from '../core/bodies';
import { ITEM_POSES } from '../core/constants';
import { CARD_PILE, CARD_SIZE, pileCorners } from './cardPile';

// La pile sous la carte : tout ce qui se voit de dessus tient dans
// l'encombrement de la carte. Sans cela, un corps poussé contre la carte
// s'enfoncerait dans la pile.

describe('la pile sous la carte', () => {
  const { cx, cz, hw, hd } = BODY_FOOTPRINTS.card;

  it('tient dans l’encombrement de la carte', () => {
    for (const card of CARD_PILE) {
      for (const [x, z] of pileCorners(card)) {
        expect(Math.abs(x - cx)).toBeLessThanOrEqual(hw);
        expect(Math.abs(z - cz)).toBeLessThanOrEqual(hd);
      }
    }
    expect(CARD_SIZE.w / 2).toBeLessThanOrEqual(hw);
    expect(CARD_SIZE.d / 2).toBeLessThanOrEqual(hd);
  });

  it('porte la carte : son dessus est à la hauteur de repos de la carte', () => {
    const top = Math.max(...CARD_PILE.map((card) => card.position[1] + card.size[1] / 2));
    expect(top).toBeCloseTo(ITEM_POSES.card.y, 2);
  });

  it('ne déborde pas de plus de ce qu’il faut', () => {
    // Un encombrement trop large écarterait les voisins pour rien.
    const corners = CARD_PILE.flatMap(pileCorners);
    expect(hw - Math.max(...corners.map(([x]) => Math.abs(x - cx)))).toBeLessThan(0.03);
    expect(hd - Math.max(...corners.map(([, z]) => Math.abs(z - cz)))).toBeLessThan(0.03);
  });
});
