import { grainy, roundRect } from '../core/canvas2d';
import type { SceneFonts } from '../core/fonts';
import { rng } from '../core/rng';
import { MANGA, spineSpec } from './layout';

// Les textures du décor, peintes en code (bois de
// noyer, feutre, enduit du mur, dos des mangas, point doux de la vapeur).
// Fonctions de dessin pures : elles prennent un contexte 2D et sa taille,
// et se dessinent à n'importe quelle résolution (s : échelle d'un canvas de
// référence de 1024 px de large pour le bois).

/** Le plateau en noyer : quatre lames, veinage, nœuds, joints sombres. */
export function paintWood(c: CanvasRenderingContext2D, w: number, h: number): void {
  const s = w / 1024;
  c.fillStyle = '#5f3c25';
  c.fillRect(0, 0, w, h);
  const random = rng(11);
  const planks = 4;
  const tints = [
    'rgba(40,20,8,.10)',
    'rgba(130,85,48,.10)',
    'rgba(40,20,8,.05)',
    'rgba(130,85,48,.06)',
  ];
  for (let p = 0; p < planks; p++) {
    c.fillStyle = tints[p % tints.length] ?? 'transparent';
    c.fillRect(0, (p * h) / planks, w, h / planks);
  }
  // Le veinage : des ondes fines, sombres surtout, quelques-unes claires.
  for (let i = 0; i < 300; i++) {
    const y = random() * h;
    const amp = (1.5 + random() * 6) * s;
    const freq = (0.003 + random() * 0.009) / s;
    const phase = random() * 6;
    c.strokeStyle =
      random() < 0.62
        ? `rgba(32,16,6,${0.07 + random() * 0.17})`
        : `rgba(160,108,64,${0.05 + random() * 0.11})`;
    c.lineWidth = (0.6 + random() * 1.8) * s;
    c.beginPath();
    for (let x = 0; x <= w; x += 16 * s) {
      const yy =
        y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.3 + phase * 2) * amp * 0.3;
      if (x) c.lineTo(x, yy);
      else c.moveTo(x, yy);
    }
    c.stroke();
  }
  // Les nœuds.
  for (let k = 0; k < 6; k++) {
    const x = random() * w;
    const y = ((Math.floor(random() * planks) + 0.5) * h) / planks + (random() - 0.5) * 40 * s;
    c.strokeStyle = 'rgba(36,18,7,.13)';
    c.lineWidth = 1.2 * s;
    for (let j = 9; j > 0; j--) {
      c.beginPath();
      c.ellipse(x, y, j * 7 * s, j * 2.2 * s, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  // Les joints entre les lames, avec un fil de lumière sur l'arête.
  c.fillStyle = 'rgba(18,8,3,.6)';
  for (let p = 1; p < planks; p++) c.fillRect(0, (p * h) / planks - 1.5 * s, w, 3 * s);
  c.fillStyle = 'rgba(255,220,170,.07)';
  for (let p = 1; p < planks; p++) c.fillRect(0, (p * h) / planks + 1.5 * s, w, 1.5 * s);
  grainy(c, w, h, 5, Math.round(9000 * s * s), 0.06);
}

/** Le tapis de feutre vert, et sa couture en pointillés. */
export function paintFelt(c: CanvasRenderingContext2D, w: number, h: number): void {
  const s = w / 512;
  c.fillStyle = '#2f4a40';
  c.fillRect(0, 0, w, h);
  grainy(c, w, h, 9, Math.round(14000 * s * s), 0.09);
  c.strokeStyle = 'rgba(230,215,180,.35)';
  c.setLineDash([7 * s, 6 * s]);
  c.lineWidth = 2 * s;
  roundRect(c, 10 * s, 10 * s, w - 20 * s, h - 20 * s, 10 * s);
  c.stroke();
  c.setLineDash([]);
}

/** L'enduit du mur : un fond clair grainé, teinté par l'ambiance (couleur du matériau). */
export function paintWall(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = '#e6d8c4';
  c.fillRect(0, 0, w, h);
  grainy(c, w, h, 21, Math.round((16000 * w * h) / (512 * 512)), 0.07);
}

/**
 * Atlas des dos de mangas : une rangée par tome (de haut en bas), puis une
 * rangée de tranches de pages, puis une rangée blanche (faces unies).
 */
export const SPINE_ATLAS = { width: 256, rowHeight: 40, rows: MANGA.count + 2 } as const;
export const SPINE_ROW_PAGES = MANGA.count;
export const SPINE_ROW_PLAIN = MANGA.count + 1;

/** Bas et haut (en v, de 0 à 1) d'une rangée de l'atlas, la rangée 0 étant en haut du canvas. */
export function spineRowV(row: number): [number, number] {
  const n = SPINE_ATLAS.rows;
  return [1 - (row + 1) / n, 1 - row / n];
}

export function paintSpineAtlas(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  fonts: SceneFonts,
): void {
  const rowH = h / SPINE_ATLAS.rows;
  const k = w / SPINE_ATLAS.width;
  for (let i = 0; i < MANGA.count; i++) {
    const spec = spineSpec(100 + i);
    const y0 = i * rowH;
    c.fillStyle = spec.back;
    c.fillRect(0, y0, w, rowH);
    c.fillStyle = spec.band;
    c.fillRect(0, y0, 46 * k, rowH);
    // Un « titre » abstrait : trois pavés clairs, jamais de vrai texte.
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (const block of spec.blocks)
      c.fillRect(block.x * k, y0 + rowH * 0.3, block.w * k, rowH * 0.4);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.arc(w - 26 * k, y0 + rowH / 2, 10 * k, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f3e9d4';
    c.font = `700 ${Math.round(18 * k)}px ${fonts.serif}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(spec.volume), w - 26 * k, y0 + rowH / 2 + 1);
  }
  // Les tranches des pages : un papier crème strié.
  const pagesY = SPINE_ROW_PAGES * rowH;
  c.fillStyle = '#ece2cc';
  c.fillRect(0, pagesY, w, rowH);
  const random = rng(77);
  for (let y = 2; y < rowH - 2; y += 2) {
    c.fillStyle = `rgba(120,95,60,${0.08 + random() * 0.12})`;
    c.fillRect(0, pagesY + y, w, 1);
  }
  c.fillStyle = '#ffffff';
  c.fillRect(0, SPINE_ROW_PLAIN * rowH, w, rowH);
}

/** Un point doux et rond (vapeur de la tasse). */
export function paintSoftDot(c: CanvasRenderingContext2D, w: number, h: number): void {
  const r = Math.min(w, h) / 2;
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
