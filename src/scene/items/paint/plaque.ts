import type { SceneContent } from '@/content/scene/schema';
import { fitFont } from '../../core/canvas2d';
import { type Painter, scaled } from './common';

// La plaque du coffret scellé

export const PLAQUE_TEXTURE = { width: 768, height: 240 } as const;

export function paintPlaque(scene: SceneContent): Painter {
  const { kicker, title } = scene.chest;
  return scaled(512, (c, w, h, F) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f0d59c');
    g.addColorStop(0.5, '#d6a64c');
    g.addColorStop(1, '#a87a30');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,35,10,.6)';
    c.lineWidth = 3;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#3a2410';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    fitFont(c, kicker, w - 80, 26, 500, F.mono);
    c.fillText(kicker, w / 2, 64);
    fitFont(c, title, w - 80, 52, 700, F.serif);
    c.fillText(title, w / 2, 122);
    for (const [x, y] of [
      [22, 22],
      [w - 22, 22],
      [22, h - 22],
      [w - 22, h - 22],
    ] as const) {
      c.fillStyle = '#7a5520';
      c.beginPath();
      c.arc(x, y, 5, 0, 7);
      c.fill();
    }
  });
}
