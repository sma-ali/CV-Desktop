import { rng } from './rng';

// Petits outils de dessin pour les textures peintes en code (canvas 2D).

/** Grain de papier ou de bois : n petits points clairs et sombres, d'opacité au plus alpha. */
export function grainy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  count: number,
  alpha: number,
): void {
  const random = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle =
      random() < 0.5
        ? `rgba(60,35,15,${random() * alpha})`
        : `rgba(255,250,235,${random() * alpha})`;
    const size = 1 + random() * 2;
    ctx.fillRect(random() * width, random() * height, size, size);
  }
}

/** Trace (sans remplir) un rectangle aux coins arrondis. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Choisit la plus grande taille (au plus size, au moins 8 px) pour que text
 * tienne dans maxWidth, et la règle sur ctx. Renvoie la taille retenue.
 */
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: string | number,
  family: string,
): number {
  let current = size;
  do {
    ctx.font = `${weight} ${current}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    current -= 1;
  } while (current > 8);
  return current;
}
