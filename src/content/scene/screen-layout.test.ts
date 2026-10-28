import { describe, expect, it } from 'vitest';
import { ARRIVAL } from '@/scene/core/constants';
import { codeLength, screenLayout, SCREEN_TEXTURE, tokenize } from '@/scene/items/screen';
import { sceneEn } from './en';
import { sceneFr } from './fr';

// Le code de l'écran, tel que la scène le peint : rien ne se perd à la
// coloration, et tout tient sur l'écran, en plus gros que dans le prototype.

describe('code de l’écran', () => {
  it('ne perd aucun caractère du code de l’écran', () => {
    for (const line of [...sceneFr.screen.code, ...sceneEn.screen.code]) {
      expect(
        tokenize(line)
          .map(([text]) => text)
          .join(''),
      ).toBe(line);
    }
  });

  it('finit de se taper avant la ligne finale', () => {
    // frame.typingEnd, que le clavier du décor suit.
    for (const screen of [sceneFr.screen, sceneEn.screen]) {
      const end = ARRIVAL.typingStart + codeLength(screen.code) / ARRIVAL.typingRate;
      expect(end).toBeLessThan(ARRIVAL.extraLineStart);
    }
  });
});

describe('screenLayout', () => {
  it('écrit le code bien plus gros que le prototype (23 px sur 1024)', () => {
    for (const screen of [sceneFr.screen, sceneEn.screen]) {
      const { width, height } = SCREEN_TEXTURE;
      const layout = screenLayout([...screen.code, screen.closing], width, height);
      // Part de la largeur de la texture occupée par la hauteur d'un caractère.
      expect(layout.fontSize / width).toBeGreaterThan((23 / 1024) * 1.25);
      // Tout tient : en hauteur...
      expect(layout.top + (screen.code.length + 1) * layout.lineHeight).toBeLessThanOrEqual(
        height - 60,
      );
      // ... et en largeur (chasse fixe : 0.6 de la taille par caractère).
      const longest = Math.max(...[...screen.code, screen.closing].map((line) => line.length));
      expect(26 + layout.gutter + longest * 0.6 * layout.fontSize).toBeLessThanOrEqual(width);
    }
  });
});
