import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy } from '../../core/canvas2d';
import { type Painter, checkMark } from './common';

// Netherbrain : l'étiquette du bocal et son couvercle

/** L'étiquette collée au dos du bocal (enroulée sur le verre) : nom, accroche, année, pile, tests. */
export const NETHERBRAIN_LABEL = { width: 768, height: 512 } as const;

export function paintNetherbrainLabel(scene: SceneContent): Painter {
  const { name, tagline, year, stack, tests } = scene.netherbrain.label;
  return (c, w, h, F) => {
    c.fillStyle = '#efe4cc';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 47, 5000, 0.06);
    // L'étiquette s'enroule sur le verre : les bords fuient, le texte reste au milieu.
    const x0 = 120;
    const x1 = w - 120;
    const cx = w / 2;
    c.strokeStyle = '#5a3d2b';
    c.lineWidth = 4;
    c.strokeRect(84, 20, w - 168, h - 40);
    c.lineWidth = 1.5;
    c.strokeRect(96, 32, w - 192, h - 64);
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#8c3b2a';
    fitFont(c, year, 200, 28, 600, F.mono);
    c.fillText(year, cx, 76);
    c.fillStyle = '#2a1c14';
    fitFont(c, name, x1 - x0, 88, 700, F.serif);
    c.fillText(name, cx, 156);
    c.fillStyle = '#6b4c38';
    fitFont(c, tagline, x1 - x0, 32, 'italic 400', F.serif);
    c.fillText(tagline, cx, 198);
    c.fillStyle = '#8c3b2a';
    c.fillRect(cx - 110, 218, 220, 2);
    c.fillStyle = '#2a1c14';
    const step = Math.min(42, 190 / Math.max(1, stack.length));
    stack.forEach((line, i) => {
      fitFont(c, line, x1 - x0, 28, 500, F.mono);
      c.fillText(line, cx, 262 + i * step);
    });
    c.fillStyle = '#4f6b3a';
    fitFont(c, tests, x1 - x0 - 50, 24, 500, F.mono);
    const testsWidth = c.measureText(tests).width;
    c.fillText(tests, cx + 20, h - 56);
    checkMark(c, cx - testsWidth / 2 - 12, h - 64, 26, '#4f6b3a', 4);
  };
}

/** Le dessus du couvercle, lu d'en haut : le nom et l'année, gravés dans le laiton. */
export const NETHERBRAIN_LID = { width: 512, height: 512 } as const;

export function paintNetherbrainLid(scene: SceneContent): Painter {
  const { name, year } = scene.netherbrain.label;
  return (c, w, h, F) => {
    const g = c.createRadialGradient(w * 0.4, h * 0.35, w * 0.05, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#e9c983');
    g.addColorStop(0.6, '#c99a45');
    g.addColorStop(1, '#8a6224');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,35,10,.55)';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 26, 0, 7);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 44, 0, 7);
    c.stroke();
    c.fillStyle = '#3a2410';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitFont(c, name, w - 150, 74, 700, F.serif);
    c.fillText(name, w / 2, h / 2 - 8);
    fitFont(c, year, w - 200, 34, 600, F.mono);
    c.fillText(year, w / 2, h / 2 + 62);
  };
}
