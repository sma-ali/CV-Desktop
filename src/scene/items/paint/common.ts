import type { SceneFonts } from '../../core/fonts';

// Les textures peintes des objets du CV (couvertures, pages, badge, post-it,
// carte, portable, plaque du coffret, bocal de Netherbrain, baie du
// Homelab), un fichier par objet. Les mises en page gardent les coordonnées
// du prototype ; les textures plus fines sont dessinées à l'échelle
// (ctx.scale). Tous les mots viennent de SceneContent : faits du CV, ou
// décor qui n'affirme rien. Ici : le type Painter et les outils communs.

export type Ctx = CanvasRenderingContext2D;
export type Painter = (ctx: Ctx, width: number, height: number, fonts: SceneFonts) => void;

/** Coupe un texte en lignes qui tiennent dans maxWidth, avec la police déjà réglée. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Dessine à l'échelle : les coordonnées restent celles du prototype. */
export function scaled(
  base: number,
  paint: (ctx: Ctx, w: number, h: number, fonts: SceneFonts) => void,
) {
  return (ctx: Ctx, width: number, height: number, fonts: SceneFonts) => {
    const k = width / base;
    ctx.scale(k, k);
    paint(ctx, width / k, height / k, fonts);
  };
}

/** Un code-barres décoratif, toujours le même. */
export function barcode(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.fillStyle = color;
  const bars = Math.floor(width / 7.6);
  for (let i = 0; i < bars; i++) ctx.fillRect(x + i * 7.6, y, ((i * 7) % 5) + 2, height);
}

/** Une coche manuscrite. */
export function checkMark(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.44, y);
  ctx.lineTo(x - size * 0.1, y + size * 0.34);
  ctx.lineTo(x + size * 0.52, y - size * 0.38);
  ctx.stroke();
}
