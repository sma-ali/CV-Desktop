import { describe, expect, it } from 'vitest';
import {
  ambientLevel,
  keyboardLedLevel,
  lampFlash,
  lampLevel,
  screenLevel,
  windowLevel,
} from '../core/arrival';
import { ARRIVAL, MOODS, SETTLE } from '../core/constants';
import { MOOD_IDS, type MoodId } from '../core/ids';
import { moodOfHour } from '../core/mood';
import {
  bloomStrength,
  coneOpacity,
  dimLevel,
  dustOpacity,
  fadeLevel,
  hemiIntensity,
  skyLevel,
  spotIntensity,
  sunIntensity,
} from './lighting';
import { LIT_WINDOWS, SKY_PALETTES } from './paint';

/** Les niveaux de la mise en scène à l'instant t, pour une ambiance. */
function levels(t: number, mood: MoodId, reduced = false) {
  const m = MOODS[mood];
  const lamp = lampLevel(t);
  const flash = reduced ? 0 : lampFlash(t);
  const window = windowLevel(t);
  return {
    hemi: hemiIntensity(ambientLevel(t), m.hemi),
    sun: sunIntensity(window, m.sun),
    spot: spotIntensity(lamp, flash, window, m.lamp),
    cone: coneOpacity(lamp, flash, window, mood),
    fade: fadeLevel(t, lamp, window, reduced),
    bloom: bloomStrength(lamp, flash, window),
    dust: dustOpacity(lamp, window, m.dust),
    sky: skyLevel(window),
    screen: screenLevel(t),
    led: keyboardLedLevel(t),
  };
}

describe('la séquence d’arrivée', () => {
  it('commence dans le noir', () => {
    const start = levels(0.5, 'afternoon');
    expect(start.spot).toBe(0);
    expect(start.sun).toBe(0);
    expect(start.cone).toBe(0);
    expect(start.screen).toBe(0);
    expect(start.led).toBe(0);
    expect(start.fade).toBeLessThan(0.05);
    expect(start.hemi).toBeLessThan(levels(SETTLE, 'afternoon').hemi * 0.05);
  });

  it('allume la lampe avec un vacillement, puis un éclat qui retombe', () => {
    const on = ARRIVAL.lampOn;
    const flicker = [0.03, 0.1, 0.16].map((s) => levels(on + s, 'afternoon').spot);
    expect(flicker[1]).toBeLessThan(flicker[0]!);
    expect(flicker[2]).toBeGreaterThan(flicker[1]!);
    expect(lampLevel(on + 0.24)).toBeLessThan(lampLevel(on + 0.16));
    const boom = levels(on + 0.4, 'afternoon');
    const later = levels(on + 3, 'afternoon');
    expect(boom.bloom).toBeGreaterThan(later.bloom);
    expect(boom.fade).toBeGreaterThan(0.9);
  });

  it('réveille l’écran et la LED du clavier, puis la fenêtre', () => {
    expect(levels(ARRIVAL.screenFull + 0.01, 'afternoon').screen).toBe(1);
    expect(levels(ARRIVAL.keyboardLedFull, 'afternoon').led).toBe(1);
    expect(levels(ARRIVAL.windowStart, 'afternoon').sun).toBe(0);
    expect(levels(ARRIVAL.windowEnd, 'afternoon').sun).toBeGreaterThan(0);
  });

  it('pousse la lampe tant que la fenêtre n’éclaire pas, puis la calme', () => {
    expect(levels(4, 'afternoon').spot).toBeGreaterThan(levels(SETTLE, 'afternoon').spot);
    expect(levels(4, 'afternoon').cone).toBeGreaterThan(levels(SETTLE, 'afternoon').cone);
  });

  it('est posée à SETTLE : plus rien ne monte', () => {
    const settled = levels(SETTLE, 'evening');
    const later = levels(SETTLE + 30, 'evening');
    for (const key of ['hemi', 'sun', 'spot', 'cone', 'fade', 'bloom', 'sky'] as const) {
      expect(later[key]).toBeCloseTo(settled[key], 6);
    }
    expect(settled.fade).toBe(1);
    expect(settled.sky).toBe(1);
  });

  it('en mouvement réduit, l’image est pleine et sans éclat', () => {
    const reduced = levels(SETTLE + 0.6, 'night', true);
    expect(reduced.fade).toBe(1);
    expect(fadeLevel(0, 0, 0, true)).toBe(1);
  });
});

describe('les ambiances selon l’heure', () => {
  const at = (hour: number) => levels(SETTLE + 1, moodOfHour(hour));

  it('donne une ambiance à chaque heure, avec son ciel', () => {
    for (let hour = 0; hour < 24; hour++) {
      const mood = moodOfHour(hour);
      expect(MOOD_IDS).toContain(mood);
      expect(SKY_PALETTES[mood].gradient).toHaveLength(3);
    }
    expect(moodOfHour(8)).toBe('morning');
    expect(moodOfHour(14)).toBe('afternoon');
    expect(moodOfHour(19)).toBe('evening');
    expect(moodOfHour(23)).toBe('night');
  });

  it('la nuit, la lampe veille : plus forte, et le soleil faible', () => {
    expect(at(23).spot).toBeGreaterThan(at(14).spot);
    expect(at(23).sun).toBeLessThan(at(14).sun);
    expect(at(23).hemi).toBeLessThan(at(14).hemi);
    expect(at(23).dust).toBeGreaterThan(at(14).dust);
    expect(LIT_WINDOWS.night).toBeGreaterThan(LIT_WINDOWS.evening);
    expect(LIT_WINDOWS.afternoon).toBe(0);
  });

  it('le cône reste discret en plein après-midi', () => {
    expect(at(14).cone).toBeLessThan(at(8).cone);
  });

  it('assombrit autour de l’objet présenté, jamais au-delà de 0.62', () => {
    expect(dimLevel(0, 0)).toBe(0);
    expect(dimLevel(1, 0)).toBeCloseTo(0.62);
    expect(dimLevel(0.2, 1)).toBeCloseTo(0.62);
  });
});
