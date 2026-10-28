import { rng } from '../core/rng';
import type { MoodId } from '../core/ids';

// Les textures peintes de la mise en scène (canvas 2D, sans three) : le ciel
// derrière la fenêtre, une par ambiance, et la tache des carreaux que la
// fenêtre pose sur le plateau.

/** Dégradé du ciel (haut, milieu, horizon), toits au loin et leurs fenêtres allumées. */
export const SKY_PALETTES = {
  morning: { gradient: ['#9fb8cf', '#f1d6a4', '#f7c27a'], roofs: '#7a7f8c', lit: '#f7d79a' },
  afternoon: { gradient: ['#6f9fcf', '#a9cbe6', '#dfe8ee'], roofs: '#7d8a99', lit: null },
  evening: { gradient: ['#2e3d63', '#b8576a', '#f0a35c'], roofs: '#2a2433', lit: '#f7d79a' },
  night: { gradient: ['#060a17', '#0f1b33', '#1d2a45'], roofs: '#0a0e18', lit: '#f4c46e' },
} as const satisfies Record<
  MoodId,
  { gradient: readonly [string, string, string]; roofs: string; lit: string | null }
>;

/** Part des fenêtres allumées dans les immeubles. */
export const LIT_WINDOWS: Record<MoodId, number> = {
  morning: 0.25,
  afternoon: 0,
  evening: 0.25,
  night: 0.5,
};

/** Le ciel d'une ambiance, sur un canvas carré. */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, mood: MoodId) {
  const palette = SKY_PALETTES[mood];
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, palette.gradient[0]);
  gradient.addColorStop(0.6, palette.gradient[1]);
  gradient.addColorStop(1, palette.gradient[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  const random = rng(88);

  if (mood === 'night') {
    // Étoiles et croissant de lune.
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.6})`;
      ctx.fillRect(random() * w, random() * h * 0.6, 1.5, 1.5);
    }
    ctx.fillStyle = '#e8eef7';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.22, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.gradient[1];
    ctx.beginPath();
    ctx.arc(w * 0.72 + 10, h * 0.22 - 6, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  if (mood === 'morning' || mood === 'evening') {
    // Le soleil bas, à gauche le matin, à droite le soir.
    const [x, y, r, inner, outer] =
      mood === 'morning'
        ? [w * 0.25, h * 0.78, 140, 'rgba(255,245,215,1)', 'rgba(255,220,150,0)']
        : [w * 0.8, h * 0.85, 180, 'rgba(255,210,140,1)', 'rgba(255,140,80,0)'];
    const sun = ctx.createRadialGradient(x, y, 4, x, y, r);
    sun.addColorStop(0, inner);
    sun.addColorStop(1, outer);
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }

  // Les toits de la ville au loin.
  ctx.fillStyle = palette.roofs;
  let x = 0;
  while (x < w) {
    const bw = 30 + random() * 70;
    const bh = 60 + random() * 120;
    ctx.fillRect(x, h - bh, bw, bh);
    if (random() < 0.4) ctx.fillRect(x + bw * 0.3, h - bh - 18, 10, 18);
    if (palette.lit) {
      for (let k = 0; k < 6; k++) {
        if (random() < LIT_WINDOWS[mood]) {
          ctx.fillStyle = palette.lit;
          ctx.fillRect(x + 5 + random() * (bw - 12), h - bh + 10 + random() * (bh - 20), 5, 7);
          ctx.fillStyle = palette.roofs;
        }
      }
    }
    x += bw + 2;
  }
}

/**
 * Les carreaux de la fenêtre en lumière : blanc au centre, croisillon noir
 * (rien n'y passe en mélange additif), bords haut et bas adoucis.
 */
export function drawPanes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.75);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,255,255,.55)');
  ctx.fillStyle = glow;
  ctx.fillRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = '#000';
  ctx.fillRect(w / 2 - 7, 0, 14, h);
  ctx.fillRect(0, h / 2 - 6, w, 12);
  ctx.globalCompositeOperation = 'destination-out';
  const edges = ctx.createLinearGradient(0, 0, 0, h);
  edges.addColorStop(0, 'rgba(0,0,0,.6)');
  edges.addColorStop(0.15, 'rgba(0,0,0,0)');
  edges.addColorStop(0.85, 'rgba(0,0,0,0)');
  edges.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = edges;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}
