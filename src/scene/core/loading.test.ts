import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOAD,
  introProgress,
  LOAD_STEPS,
  LOAD_TIMEOUT_MS,
  LOAD_WEIGHTS,
  loadProgress,
  loadTimeout,
  BUSY_GAP_MS,
  IDLE_BEAT_MS,
  idleWait,
} from './loading';

describe('l’avancement du chargement', () => {
  it('pèse des étapes dont la somme fait 1', () => {
    const total = LOAD_STEPS.reduce((sum, step) => sum + LOAD_WEIGHTS[step], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('part de 0 et finit à 1', () => {
    expect(loadProgress(EMPTY_LOAD)).toBe(0);
    expect(loadProgress({ code: 1, assets: 1, shaders: 1, frame: 1 })).toBe(1);
  });

  it('borne chaque étape entre 0 et 1', () => {
    expect(loadProgress({ code: 3, assets: -1, shaders: 0, frame: 0 })).toBeCloseTo(
      LOAD_WEIGHTS.code,
    );
  });

  it('avance dans l’ordre réel : le code, puis les textures, puis la première image', () => {
    const code = loadProgress({ ...EMPTY_LOAD, code: 1 });
    const assets = loadProgress({ ...EMPTY_LOAD, code: 1, assets: 1 });
    const shaders = loadProgress({ code: 1, assets: 1, shaders: 1, frame: 0 });
    expect(code).toBeGreaterThan(0);
    expect(assets).toBeGreaterThan(code);
    expect(shaders).toBeGreaterThan(assets);
    expect(shaders).toBeLessThan(1);
  });

  it('montre 1 dès que la scène est prête, sinon l’avancement au centième', () => {
    expect(introProgress(EMPTY_LOAD, true)).toBe(1);
    const value = introProgress({ ...EMPTY_LOAD, code: 1, assets: 0.5 }, false);
    expect(value).toBe(
      Math.floor(loadProgress({ ...EMPTY_LOAD, code: 1, assets: 0.5 }) * 100) / 100,
    );
  });
});

describe('le délai avant la version express', () => {
  it('vaut LOAD_TIMEOUT_MS par défaut', () => {
    expect(loadTimeout('')).toBe(LOAD_TIMEOUT_MS);
    expect(loadTimeout('?t=11000&fige')).toBe(LOAD_TIMEOUT_MS);
  });

  it('se règle par ?attente, en millisecondes', () => {
    expect(loadTimeout('?attente=1500')).toBe(1500);
  });

  it('ne renonce jamais avec ?attente=0', () => {
    expect(loadTimeout('?attente=0')).toBe(Infinity);
  });

  it('ignore une valeur invalide', () => {
    expect(loadTimeout('?attente=abc')).toBe(LOAD_TIMEOUT_MS);
    expect(loadTimeout('?attente=-5')).toBe(LOAD_TIMEOUT_MS);
    expect(loadTimeout('?attente=')).toBe(LOAD_TIMEOUT_MS);
  });
});

describe('l’attente qui compte', () => {
  it('cumule les battements de la page qui attend', () => {
    let waited = 0;
    for (let i = 0; i < 8; i++) waited = idleWait(waited, IDLE_BEAT_MS, false);
    expect(waited).toBe(8 * IDLE_BEAT_MS);
  });

  it('ne compte pas le temps où la page travaille (longue tâche)', () => {
    expect(idleWait(500, BUSY_GAP_MS, false)).toBe(500);
    expect(idleWait(500, 9_000, false)).toBe(500);
  });

  it('ne compte pas le temps onglet caché', () => {
    expect(idleWait(500, IDLE_BEAT_MS, true)).toBe(500);
  });

  it('ignore un écart nul, négatif ou invalide', () => {
    expect(idleWait(500, 0, false)).toBe(500);
    expect(idleWait(500, -20, false)).toBe(500);
    expect(idleWait(500, Number.NaN, false)).toBe(500);
  });
});
