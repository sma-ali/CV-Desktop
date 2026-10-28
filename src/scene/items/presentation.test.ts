import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HELD_MAX_DISTANCE, ITEM_POSES, MONITOR, POSTIT_ON_MONITOR } from '../core/constants';
import {
  createPresentState,
  glowLevel,
  heldPose,
  postitRestPose,
  RATES,
  stepPresentation,
  stepToward,
} from './presentation';

describe('stepToward', () => {
  it('avance sans dépasser la cible', () => {
    expect(stepToward(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(stepToward(0.9, 1, 0.3)).toBe(1);
    expect(stepToward(1, 0, 0.4)).toBeCloseTo(0.6);
    expect(stepToward(0.1, 0, 0.4)).toBe(0);
  });
});

describe('stepPresentation', () => {
  it('soulève à la vitesse du prototype, puis ouvre ou retourne à mi-chemin', () => {
    const state = createPresentState();
    stepPresentation(state, true, false, 0.1, false);
    expect(state.p).toBeCloseTo(0.1 * RATES.lift);
    expect(state.f).toBe(0);
    for (let i = 0; i < 5; i++) stepPresentation(state, true, false, 0.1, false);
    expect(state.p).toBeGreaterThan(0.55);
    expect(state.f).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) stepPresentation(state, true, false, 0.1, false);
    expect(state).toMatchObject({ p: 1, f: 1, hover: 0 });
  });

  it('repose plus vite qu’il ne soulève', () => {
    const state = { p: 1, f: 1, hover: 0 };
    stepPresentation(state, false, false, 0.1, false);
    expect(state.p).toBeCloseTo(1 - 0.1 * RATES.putBack);
    expect(state.f).toBeCloseTo(1 - 0.1 * RATES.flip);
  });

  it('ne survole pas un objet tenu', () => {
    const state = createPresentState();
    for (let i = 0; i < 30; i++) stepPresentation(state, false, true, 0.1, false);
    expect(state.hover).toBe(1);
    stepPresentation(state, true, true, 0.1, false);
    expect(state.hover).toBeLessThan(1);
  });

  it('saute à la fin en mouvement réduit, sans animation', () => {
    const state = createPresentState();
    stepPresentation(state, true, false, 0.016, true);
    expect(state).toMatchObject({ p: 1, f: 1 });
    stepPresentation(state, false, true, 0.016, true);
    expect(state).toMatchObject({ p: 0, f: 0, hover: 1 });
  });

  it('fait luire l’objet tenu ou survolé', () => {
    expect(glowLevel({ p: 0, f: 0, hover: 0 })).toBe(0);
    expect(glowLevel({ p: 1, f: 1, hover: 0 })).toBeCloseTo(0.16);
    expect(glowLevel({ p: 0, f: 0, hover: 1 }, 0.1)).toBeCloseTo(0.24);
  });
});

describe('heldPose', () => {
  const camera = new PerspectiveCamera(29, 1440 / 900, 0.1, 90);
  camera.position.set(0.1, 12, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const input = { t: 0, pointerX: 0, pointerY: 0 };

  it('tient le livre devant la caméra, à sa taille, sans dépasser la distance maximale', () => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = heldPose(camera, ITEM_POSES.book, false, 0, 1, input, position, quaternion);
    const distance = position.distanceTo(camera.position);
    expect(distance).toBeLessThanOrEqual(HELD_MAX_DISTANCE + 1e-6);
    expect(scale).toBeLessThanOrEqual(1);
    // L'objet est devant la caméra : dans son champ, du bon côté.
    const local = position.clone().applyMatrix4(camera.matrixWorldInverse);
    expect(local.z).toBeLessThan(0);
    const ndc = position.clone().project(camera);
    expect(ndc.x).toBeCloseTo(-0.3, 1);
  });

  it('rapetisse un objet trop grand pour la distance maximale', () => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = heldPose(
      camera,
      { hold: { w: 20, h: 20 }, mode: 'turn' },
      false,
      0,
      0,
      input,
      position,
      quaternion,
    );
    expect(scale).toBeLessThan(1);
    expect(position.distanceTo(camera.position)).toBeCloseTo(HELD_MAX_DISTANCE);
  });
});

describe('postitRestPose', () => {
  it('colle le post-it en bas à droite du cadre de l’écran', () => {
    const { position } = postitRestPose();
    const [mx, , mz] = MONITOR.position;
    expect(position.x).toBeCloseTo(mx + POSTIT_ON_MONITOR.position[0]);
    // Sous le centre de la dalle, au-dessus du bureau, devant l'écran.
    expect(position.y).toBeGreaterThan(0.8);
    expect(position.y).toBeLessThan(MONITOR.tiltY);
    expect(position.z).toBeGreaterThan(mz);
  });
});
