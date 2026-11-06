import { describe, expect, it } from 'vitest';
import { DESK, MOODS, WIN } from '../core/constants';
import { MOOD_IDS } from '../core/ids';
import { moodValues } from '../core/moodValues';
import {
  PATCH_INDEX,
  PATCH_Y,
  SHAFT_FOOT_Y,
  SHAFT_INDEX,
  projectWindow,
  writePatch,
  writeShaft,
} from './windowLight';

describe('la lumière de la fenêtre', () => {
  it('pose la tache sur le plateau, devant le mur, dans le sens du soleil', () => {
    for (const mood of MOOD_IDS) {
      const { dir } = moodValues(mood);
      const positions = new Float32Array(12);
      writePatch(dir, positions);
      for (let i = 0; i < 4; i++) {
        expect(positions[i * 3 + 1]).toBeCloseTo(PATCH_Y);
        // Devant le mur, vers le visiteur (le soleil entre par le fond).
        expect(positions[i * 3 + 2]).toBeGreaterThan(WIN.z);
        expect(positions[i * 3 + 2]).toBeLessThan(DESK.z1 + 3);
      }
      // Le bas de la vitre éclaire près du mur, le haut plus loin.
      expect(positions[2]).toBeLessThan(positions[11]!);
      // Le soleil vient de la gauche : la tache glisse vers la droite.
      if (MOODS[mood].dir[0] > 0) expect(positions[0]).toBeGreaterThan(WIN.x0);
    }
  });

  it('relie la vitre à la tache par les rais', () => {
    const { dir } = moodValues('afternoon');
    const positions = new Float32Array(24);
    writeShaft(dir, positions);
    const foot = projectWindow(dir, new Float32Array(8));
    for (let i = 0; i < 4; i++) {
      expect(positions[i * 3 + 1]).toBeGreaterThan(WIN.y0);
      expect(positions[(4 + i) * 3]).toBeCloseTo(foot[i * 2]!);
      expect(positions[(4 + i) * 3 + 1]).toBeCloseTo(SHAFT_FOOT_Y);
    }
  });

  it('a des triangles valides', () => {
    expect(Math.max(...PATCH_INDEX)).toBe(3);
    expect(Math.max(...SHAFT_INDEX)).toBe(7);
    expect(SHAFT_INDEX).toHaveLength(24);
  });
});
