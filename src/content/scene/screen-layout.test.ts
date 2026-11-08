import { describe, expect, it } from 'vitest';
import { ARRIVAL } from '@/scene/core/constants';
import {
  closingBand,
  codeLength,
  linkAt,
  linkSpan,
  screenLayout,
  SCREEN_TEXTURE,
  tokenize,
} from '@/scene/items/screen';
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

describe('bande repeinte après la frappe', () => {
  it('couvre la dernière ligne du code et la ligne finale, sans la barre d’état', () => {
    for (const { code, closing } of [sceneFr.screen, sceneEn.screen]) {
      const { width, height } = SCREEN_TEXTURE;
      const { fontSize, lineHeight, top } = screenLayout([...code, closing], width, height);
      const band = closingBand(code, closing);
      const baseline = (index: number) => top + index * lineHeight + fontSize * 0.92;
      // Le curseur en fin de code (ligne n - 1) et sous la ligne finale (ligne n).
      expect(band.top).toBeLessThanOrEqual(baseline(code.length - 1) - fontSize * 0.86);
      expect(band.top + band.height).toBeGreaterThanOrEqual(
        baseline(code.length) + fontSize * 0.25,
      );
      // La barre d'état (60 px) reste hors de la bande.
      expect(band.top + band.height).toBeLessThanOrEqual(height - 60);
      expect(Number.isInteger(band.top) && Number.isInteger(band.height)).toBe(true);
      // Bien moins lourde à renvoyer que toute la texture.
      expect(band.height).toBeLessThan(height / 4);
    }
  });
});

describe('le lien vers le portable', () => {
  it('est cliquable sur « voirPortable() », et seulement là', () => {
    for (const screen of [sceneFr.screen, sceneEn.screen]) {
      const { width, height } = SCREEN_TEXTURE;
      const lines = [...screen.code, screen.closing];
      const { fontSize, lineHeight, top, gutter } = screenLayout(lines, width, height);
      const index = screen.code.findIndex((line) => line.includes(`${screen.words.pointer}()`));
      expect(index).toBeGreaterThan(0);
      const span = linkSpan(screen.code[index]!, screen.words.pointer)!;
      const y = top + (index + 0.5) * lineHeight;
      const middle = 26 + gutter + ((span[0] + span[1]) / 2) * fontSize * 0.6;
      const v = 1 - y / height;
      expect(linkAt(screen, middle / width, v)).toBe(true);
      // La ligne du dessous, et le début de la ligne : rien.
      expect(linkAt(screen, middle / width, 1 - (y + lineHeight) / height)).toBe(false);
      expect(linkAt(screen, (26 + gutter) / width, v)).toBe(false);
    }
  });
});
