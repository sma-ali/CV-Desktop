import { describe, expect, it } from 'vitest';
import { createDeskBodies, homePose, isMoved } from '../core/bodies';
import { BODY_IDS } from '../core/ids';
import { bodyDisorder, DISORDER, disorderScore, offerShown, tiltOf } from './disorder';

// Le score de désordre : 0 au repos, des points par corps déplacé loin,
// renversé ou tombé, et le seuil du bouton avec son hystérésis.

/** Un bureau où le corps id est posé en (dx, dz) de sa place, penché de tilt radians. */
function shifted(
  id: (typeof BODY_IDS)[number],
  dx: number,
  dz: number,
  tilt = 0,
  portrait = false,
) {
  const desk = createDeskBodies(portrait);
  const body = desk[id];
  body.x += dx;
  body.z += dz;
  // Penché autour de x (le cap reste celui de la place d'origine si tilt = 0).
  const home = homePose(id, portrait);
  const cy = Math.cos(home.ry / 2);
  const sy = Math.sin(home.ry / 2);
  const cx = Math.cos(tilt / 2);
  const sx = Math.sin(tilt / 2);
  body.qx = sx * cy;
  body.qy = cx * sy;
  body.qz = -sx * sy;
  body.qw = cx * cy;
  body.moved = isMoved(body, home);
  return desk;
}

describe('le score de désordre', () => {
  it('vaut 0 pour un bureau rangé, dans les deux formats', () => {
    expect(disorderScore(createDeskBodies(false), false)).toBe(0);
    expect(disorderScore(createDeskBodies(true), true)).toBe(0);
  });

  it('ne compte pas un objet à peine poussé', () => {
    const desk = shifted('book', DISORDER.near * 0.9, 0);
    expect(desk.book.moved).toBe(true);
    expect(bodyDisorder('book', desk.book, false)).toBe(0);
  });

  it('compte un objet déplacé au prorata de la distance, jusqu’à far', () => {
    const half = shifted('book', (DISORDER.near + DISORDER.far) / 2, 0);
    expect(bodyDisorder('book', half.book, false)).toBeCloseTo(DISORDER.moved / 2, 5);
    const far = shifted('book', DISORDER.far * 3, 0);
    expect(bodyDisorder('book', far.book, false)).toBeCloseTo(DISORDER.moved, 5);
  });

  it('compte un objet renversé, et plus encore un objet tombé', () => {
    const tipped = shifted('mug', 0, 0, Math.PI / 2);
    expect(tiltOf(tipped.mug)).toBeCloseTo(Math.PI / 2, 5);
    expect(bodyDisorder('mug', tipped.mug, false)).toBeCloseTo(DISORDER.tipped, 5);
    const fallen = shifted('mug', 6, 0);
    fallen.mug.fallen = true;
    expect(bodyDisorder('mug', fallen.mug, false)).toBe(DISORDER.fallen);
  });

  it('ignore un corps caché par le format', () => {
    const desk = shifted('book', 5, 0);
    desk.book.hidden = true;
    expect(disorderScore(desk, false)).toBe(0);
  });

  it('propose le rangement quand la moitié du bureau est par terre ou renversée, pas avant', () => {
    const desk = createDeskBodies(false);
    // Trois objets poussés loin : pas encore.
    for (const id of ['book', 'laptop', 'card'] as const) {
      desk[id].x += 4;
      desk[id].moved = true;
    }
    expect(offerShown(disorderScore(desk, false), false)).toBe(false);
    // Plus trois par terre : oui.
    for (const id of ['mug', 'lamp', 'manga'] as const) {
      desk[id].moved = true;
      desk[id].fallen = true;
    }
    expect(offerShown(disorderScore(desk, false), false)).toBe(true);
    expect(disorderScore(desk, false)).toBeLessThanOrEqual(1);
  });

  it('ne fait pas clignoter le bouton au seuil (hystérésis)', () => {
    const between = (DISORDER.offer + DISORDER.withdraw) / 2;
    expect(offerShown(between, false)).toBe(false);
    expect(offerShown(between, true)).toBe(true);
    expect(offerShown(DISORDER.withdraw - 0.01, true)).toBe(false);
  });

  it('plafonne à 1', () => {
    const desk = createDeskBodies(false);
    for (const id of BODY_IDS) {
      desk[id].moved = true;
      desk[id].fallen = true;
    }
    expect(disorderScore(desk, false)).toBe(1);
  });
});
