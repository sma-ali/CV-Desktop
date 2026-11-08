import { describe, expect, it } from 'vitest';
import { pinchFactor, wheelFactor, ZOOM, zoomDesk, zoomHeld } from './zoomLevels';

const bounds = { x0: -6, x1: 6, z0: -3, z1: 3 };
const center = { x: 0, z: 0 };
const rest = { zoom: 1, x: 0, z: 0 };

describe('le zoom du visiteur', () => {
  it('rapproche à la molette vers le haut, recule vers le bas', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
  });

  it('garde l’objet tenu dans ses limites', () => {
    expect(zoomHeld(1, 100)).toBe(ZOOM.held.max);
    expect(zoomHeld(1, 0.01)).toBe(ZOOM.held.min);
    expect(zoomHeld(1, 1.5)).toBe(1.5);
  });

  it('ne recule jamais au-delà de la vue de repos, qui reste centrée', () => {
    const out = zoomDesk(rest, 0.5, { x: 5, z: 2 }, center, bounds);
    expect(out).toEqual(rest);
  });

  it('se rapproche du point visé, sans quitter le plateau', () => {
    const near = zoomDesk(rest, 2, { x: 4, z: 1 }, center, bounds);
    expect(near.zoom).toBe(2);
    // Le point visé reste sous le pointeur : la cible fait la moitié du chemin.
    expect(near.x).toBeCloseTo(2);
    expect(near.z).toBeCloseTo(0.5);
    const far = zoomDesk(rest, ZOOM.desk.max, { x: 100, z: 100 }, center, bounds);
    expect(far.x).toBeLessThanOrEqual(6);
    expect(far.z).toBeLessThanOrEqual(3);
  });

  it('revient au centre en reculant jusqu’au repos', () => {
    const near = zoomDesk(rest, 2, { x: 4, z: 1 }, center, bounds);
    const back = zoomDesk(near, 0.1, null, center, bounds);
    expect(back).toEqual({ zoom: 1, x: 0, z: 0 });
  });

  it('suit l’écart des deux doigts', () => {
    expect(pinchFactor(100, 150)).toBe(1.5);
    expect(pinchFactor(0, 150)).toBe(1);
  });
});
