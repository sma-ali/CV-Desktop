import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy } from '../../core/canvas2d';
import { type Painter, scaled, barcode } from './common';

// Le badge (DEFI-METIERS)

export const BADGE_TEXTURE = { width: 600, height: 870 } as const;

export function paintBadgeFront(scene: SceneContent): Painter {
  const { name } = scene.facts;
  const job = scene.facts.defiMetiers;
  return scaled(400, (c, w, h, F) => {
    c.fillStyle = '#e6ddca';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 51, 3000, 0.05);
    c.fillStyle = '#2d5a5c';
    c.fillRect(0, 0, w, 150);
    c.fillStyle = '#e2c58c';
    c.fillRect(0, 150, w, 8);
    c.fillStyle = '#f4efe4';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    fitFont(c, job.organization, w - 50, 38, 600, F.serif);
    c.fillText(job.organization, w / 2, 88);
    const kind = job.kind.toLocaleUpperCase().split('').join(' ');
    fitFont(c, kind, w - 40, 15, 500, F.mono);
    c.fillText(kind, w / 2, 124);
    c.fillStyle = '#e9e1d0';
    c.fillRect(w / 2 - 80, 196, 160, 160);
    c.fillStyle = '#2d5a5c';
    c.font = `700 110px ${F.serif}`;
    c.fillText(name.charAt(0), w / 2, 320);
    c.fillStyle = '#1f1710';
    fitFont(c, name, w - 50, 46, 700, F.serif);
    c.fillText(name, w / 2, 428);
    c.fillStyle = '#5a4a38';
    fitFont(c, `${job.role} | ${job.year}`, w - 40, 18, 500, F.mono);
    c.fillText(`${job.role} | ${job.year}`, w / 2, 470);
    barcode(c, 70, 505, 260, 40, '#1f1710');
    c.fillStyle = '#c9c1b0';
    c.beginPath();
    c.ellipse(w / 2, 26, 34, 9, 0, 0, 7);
    c.fill();
  });
}

/**
 * Dos du badge : la migration du catalogue des formations. Le livre porte
 * le poste et les plateformes web, le badge seulement la migration.
 */
export function paintBadgeBack(scene: SceneContent): Painter {
  const job = scene.facts.defiMetiers;
  const { title, lines } = scene.badge;
  return scaled(400, (c, w, h, F) => {
    c.fillStyle = '#f1ebde';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 53, 3000, 0.05);
    c.fillStyle = '#c9c1b0';
    c.beginPath();
    c.ellipse(w / 2, 26, 34, 9, 0, 0, 7);
    c.fill();
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#8d2a20';
    fitFont(c, job.organization, w - 80, 16, 600, F.mono);
    c.fillText(job.organization, 40, 96);
    c.fillStyle = '#1f1710';
    fitFont(c, title, w - 80, 46, 700, F.serif);
    c.fillText(title, 40, 170);
    c.fillRect(40, 196, 120, 3);
    // Les deux bases, l'une sous l'autre, reliées par une flèche.
    c.fillStyle = '#2d5a5c';
    fitFont(c, job.migration.from, w - 80, 40, 700, F.hand);
    c.fillText(job.migration.from, 40, 262);
    c.font = `700 34px ${F.mono}`;
    c.fillText('\u2193', 52, 312);
    fitFont(c, job.migration.to, w - 80, 40, 700, F.hand);
    c.fillText(job.migration.to, 40, 366);
    c.fillStyle = '#3a2d20';
    lines.forEach((line, i) => {
      fitFont(c, line, w - 80, 22, 400, F.serif);
      c.fillText(line, 40, 430 + i * 32);
    });
  });
}
