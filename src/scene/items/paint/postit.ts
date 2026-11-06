import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy } from '../../core/canvas2d';
import { type Ctx, type Painter, scaled, checkMark } from './common';

// Les post-it (DARES)

export const POSTIT_TEXTURE = { width: 450, height: 450 } as const;

function postitBase(c: Ctx, w: number, h: number, color: string, seed: number) {
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  grainy(c, w, h, seed, 2500, 0.06);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,.07)');
  g.addColorStop(0.2, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,60,0,.10)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

/** Un post-it coché : un mot, une coche et une mention plus petite (facultative). */
export function paintPostit(color: string, seed: number, title: string, note?: string): Painter {
  return scaled(300, (c, w, h, F) => {
    postitBase(c, w, h, color, seed);
    c.fillStyle = '#24303f';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    fitFont(c, title, w - 40, 50, 700, F.hand);
    c.fillText(title, w / 2, 118);
    checkMark(c, w / 2, 176, 100, '#24303f', 9);
    if (note) {
      c.fillStyle = 'rgba(36,48,63,.8)';
      fitFont(c, note, w - 36, 36, 700, F.hand);
      c.fillText(note, w / 2, 262);
    }
  });
}

/** Le dos du post-it du CV : le support chez DARES. */
export function paintPostitBack(scene: SceneContent): Painter {
  const { dares } = scene.facts;
  return scaled(300, (c, w, h, F) => {
    c.fillStyle = '#f7e39a';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 64, 2500, 0.05);
    c.fillStyle = '#24303f';
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const size = fitFont(c, dares.support, w - 52, 40, 700, F.hand);
    c.fillText(dares.support, 26, 58);
    c.strokeStyle = '#a1352a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(26, 58 + size * 0.25);
    c.lineTo(Math.min(w - 26, 26 + c.measureText(dares.support).width), 54 + size * 0.25);
    c.stroke();
    [dares.organization, dares.period, dares.users].forEach((line, i) => {
      fitFont(c, line, w - 52, 32, 700, F.hand);
      c.fillText(line, 26, 122 + i * 46);
    });
  });
}
