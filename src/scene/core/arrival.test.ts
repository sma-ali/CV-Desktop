import { describe, expect, it } from 'vitest';
import {
  arrivalPhase,
  cameraProgress,
  deckLedOn,
  extraLineChars,
  hudFlags,
  keyboardLedLevel,
  lampLevel,
  screenLevel,
  typedChars,
  windowLevel,
} from './arrival';
import { ARRIVAL, SETTLE } from './constants';

describe("l'arrivée", () => {
  it('passe par ses phases dans l’ordre', () => {
    expect([0, ARRIVAL.lampOn + 0.1, ARRIVAL.screenOn + 0.1, 7, SETTLE].map(arrivalPhase)).toEqual([
      'dark',
      'lamp',
      'screen',
      'window',
      'settled',
    ]);
  });

  it('allume la lampe avec deux scintillements', () => {
    const at = ARRIVAL.lampOn;
    expect(lampLevel(at - 0.01)).toBe(0);
    expect(lampLevel(at + 0.03)).toBe(1);
    expect(lampLevel(at + 0.1)).toBe(0.15);
    expect(lampLevel(at + 0.15)).toBe(1.1);
    expect(lampLevel(at + 0.25)).toBe(0.45);
    expect(lampLevel(at + 1)).toBe(1);
    expect(lampLevel(5, at, false)).toBe(0);
  });

  it("réveille l'écran, la LED du clavier puis tape le code", () => {
    expect(screenLevel(ARRIVAL.screenOn - 0.1)).toBe(0);
    expect(screenLevel(ARRIVAL.screenFull)).toBe(1);
    expect(keyboardLedLevel(ARRIVAL.keyboardLedOn)).toBe(0);
    expect(keyboardLedLevel(ARRIVAL.keyboardLedFull)).toBe(1);
    expect(typedChars(ARRIVAL.typingStart)).toBe(0);
    expect(typedChars(ARRIVAL.typingStart + 1)).toBe(ARRIVAL.typingRate);
  });

  it('tape la ligne finale, la garde, puis l’efface', () => {
    const start = ARRIVAL.extraLineStart;
    expect(extraLineChars(start - 1, 30)).toBe(0);
    expect(extraLineChars(start + 1.5, 30)).toBe(15);
    expect(extraLineChars(start + 5, 30)).toBe(30);
    expect(extraLineChars(start + 9, 30)).toBe(0);
    expect(extraLineChars(start + ARRIVAL.extraLineLoop + 5, 30)).toBe(30);
  });

  it('allume les LED du pavé une à une', () => {
    expect(deckLedOn(ARRIVAL.deckLedsStart, 0)).toBe(true);
    expect(deckLedOn(ARRIVAL.deckLedsStart, 1)).toBe(false);
  });

  it('laisse entrer la fenêtre et monte la caméra', () => {
    expect(windowLevel(ARRIVAL.windowStart)).toBe(0);
    expect(windowLevel(ARRIVAL.windowEnd)).toBe(1);
    expect(cameraProgress(0)).toBe(0);
    expect(cameraProgress(ARRIVAL.cameraEnd)).toBe(1);
  });

  it('montre le carton, puis le HUD, les étiquettes et l’indication', () => {
    expect(hudFlags(0)).toEqual({
      carton: false,
      brand: false,
      chips: false,
      tags: false,
      hint: false,
    });
    expect(hudFlags(ARRIVAL.cartonIn).carton).toBe(true);
    expect(hudFlags(SETTLE)).toEqual({
      carton: false,
      brand: true,
      chips: true,
      tags: true,
      hint: true,
    });
  });
});
