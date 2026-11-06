'use client';

import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useCanvasTexture } from '../core/textures';
import { MANGA, MANGA_SIZE, mangaStack } from './layout';
import { paintSpineAtlas, SPINE_ATLAS, SPINE_ROW_PAGES, SPINE_ROW_PLAIN, spineRowV } from './paint';

// La pile de mangas (inventés : ni titre, ni marque) : un seul maillage,
// les dos peints dans un atlas.

function mangaGeometry(): BufferGeometry {
  const { w, h, d } = MANGA_SIZE;
  const [plainLow, plainHigh] = spineRowV(SPINE_ROW_PLAIN);
  const plainV = (plainLow + plainHigh) / 2;
  const [pagesLow, pagesHigh] = spineRowV(SPINE_ROW_PAGES);
  const white = new Color(0xffffff);
  const books = mangaStack().map((book, i) => {
    const geometry = new BoxGeometry(w, h, d).toNonIndexed();
    const uv = geometry.getAttribute('uv');
    const colors = new Float32Array(uv.count * 3);
    const cover = new Color(book.cover);
    const [spineLow, spineHigh] = spineRowV(i);
    for (let j = 0; j < uv.count; j++) {
      // Faces : +x, -x, +y, -y, +z (le dos, vers le visiteur), -z.
      const face = Math.floor(j / 6);
      let color = white;
      if (face === 4) uv.setY(j, spineLow + uv.getY(j) * (spineHigh - spineLow));
      else if (face === 2 || face === 3) {
        uv.setXY(j, 0.5, plainV);
        color = cover;
      } else uv.setY(j, pagesLow + uv.getY(j) * (pagesHigh - pagesLow));
      colors[j * 3] = color.r;
      colors[j * 3 + 1] = color.g;
      colors[j * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.rotateY(book.ry);
    geometry.translate(book.x, book.y, 0);
    return geometry;
  });
  const merged = mergeGeometries(books);
  books.forEach((geometry) => geometry.dispose());
  return merged;
}

export function MangaStack() {
  const atlas = useCanvasTexture({
    width: SPINE_ATLAS.width,
    height: SPINE_ATLAS.rowHeight * SPINE_ATLAS.rows,
    draw: paintSpineAtlas,
  });
  const geometry = useMemo(() => mangaGeometry(), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.7 }),
    [atlas],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return (
    <mesh
      name="decor-manga"
      geometry={geometry}
      material={material}
      position={MANGA.position}
      rotation={[0, MANGA.ry, 0]}
      castShadow
      receiveShadow
    />
  );
}
