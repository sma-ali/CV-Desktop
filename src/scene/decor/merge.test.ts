import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';
import { finishMaterial, mergeByFinish, mergeParts, preparePart } from './merge';

describe('la fusion des pièces du décor', () => {
  it('pose, peint et garde les attributs communs', () => {
    const geometry = preparePart({
      geometry: new BoxGeometry(1, 1, 1),
      color: 0xff0000,
      position: [2, 0, 0],
    });
    expect(geometry.index).toBeNull();
    expect(Object.keys(geometry.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.x).toBeCloseTo(1.5);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(2.5);
    // La couleur hexadécimale (sRGB) est stockée en linéaire, comme three le fait.
    const color = geometry.getAttribute('color');
    const linear = new Color(0xff0000);
    expect(color.getX(0)).toBeCloseTo(linear.r);
    expect(color.getY(0)).toBeCloseTo(linear.g);
  });

  it('accepte une échelle et une rotation', () => {
    const geometry = preparePart({
      geometry: new BoxGeometry(1, 2, 1),
      color: 0xffffff,
      rotation: [0, 0, Math.PI / 2],
      scale: [1, 1, 3],
    });
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.max.clone().sub(geometry.boundingBox!.min);
    expect(size.x).toBeCloseTo(2);
    expect(size.y).toBeCloseTo(1);
    expect(size.z).toBeCloseTo(3);
  });

  it('fusionne des formes différentes en une seule géométrie', () => {
    const merged = mergeParts([
      { geometry: new BoxGeometry(1, 1, 1), color: 0x112233 },
      { geometry: new CylinderGeometry(0.5, 0.5, 1, 8), color: 0x445566 },
    ]);
    const box = new BoxGeometry(1, 1, 1).toNonIndexed().getAttribute('position').count;
    const cylinder = new CylinderGeometry(0.5, 0.5, 1, 8)
      .toNonIndexed()
      .getAttribute('position').count;
    expect(merged.getAttribute('position').count).toBe(box + cylinder);
    expect(merged.getAttribute('color').count).toBe(box + cylinder);
  });

  it('regroupe les pièces par fini, un matériau partagé par fini', () => {
    const groups = mergeByFinish([
      { geometry: new BoxGeometry(1, 1, 1), color: 0x111111 },
      { geometry: new BoxGeometry(1, 1, 1), color: 0x222222, finish: 'brass' },
      { geometry: new BoxGeometry(1, 1, 1), color: 0x333333, finish: 'matte' },
    ]);
    expect(groups.map((group) => group.finish)).toEqual(['matte', 'brass']);
    expect(finishMaterial('brass')).toBe(finishMaterial('brass'));
    const brass = finishMaterial('brass') as MeshStandardMaterial;
    expect(brass.vertexColors).toBe(true);
    expect(brass.metalness).toBeGreaterThan(0.5);
    expect(finishMaterial('unlit')).toBeInstanceOf(MeshBasicMaterial);
  });
});
