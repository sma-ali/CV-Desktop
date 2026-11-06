import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy } from '../../core/canvas2d';
import { rng } from '../../core/rng';
import { type Ctx, type Painter, wrapText, scaled, barcode } from './common';

// Le livre (DEFI-METIERS)

export const BOOK_PAGE = { width: 768, height: 1008, base: 512 } as const;

export function paintBookCover(scene: SceneContent): Painter {
  const { cover } = scene.book;
  return scaled(512, (c, w, h, F) => {
    c.fillStyle = '#3a4466';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 31, 9000, 0.12);
    const r = rng(4);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(220,210,190,${0.04 + r() * 0.07})`;
      c.beginPath();
      c.ellipse(r() * w, r() * h, 8 + r() * 40, 3 + r() * 12, r() * 3, 0, 7);
      c.fill();
    }
    c.fillStyle = 'rgba(15,18,30,.45)';
    c.fillRect(0, 0, 26, h);
    c.strokeStyle = 'rgba(214,174,98,.85)';
    c.lineWidth = 3;
    c.strokeRect(54, 48, w - 96, h - 96);
    c.lineWidth = 1;
    c.strokeRect(64, 58, w - 116, h - 116);
    c.fillStyle = '#e0b867';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const cx = w / 2 + 12;
    fitFont(c, cover.kicker, w - 160, 22, 500, F.mono);
    c.fillText(cover.kicker, cx, 150);
    fitFont(c, cover.title, w - 150, 190, 700, F.serif);
    c.fillText(cover.title, cx, 320);
    c.fillRect(w / 2 - 60, 430, 144, 3);
    cover.subtitle.forEach((line, i) => {
      fitFont(c, line, w - 160, 30, 'italic 400', F.serif);
      c.fillText(line, cx, 488 + i * 38);
    });
    fitFont(c, cover.edition, w - 160, 18, 500, F.mono);
    c.fillText(cover.edition, cx, h - 96);
    const g = c.createRadialGradient(w * 0.55, h * 0.45, w * 0.2, w * 0.5, h * 0.5, w * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,8,5,.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/** Le dos du livre (vu quand on le retourne). */
export function paintBookBack(scene: SceneContent): Painter {
  const job = scene.facts.defiMetiers;
  return scaled(512, (c, w, h, F) => {
    c.fillStyle = '#343d5c';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 33, 9000, 0.12);
    c.fillStyle = 'rgba(15,18,30,.45)';
    c.fillRect(w - 26, 0, 26, h);
    c.strokeStyle = 'rgba(214,174,98,.6)';
    c.lineWidth = 2;
    c.strokeRect(54, 48, w - 96, h - 96);
    c.fillStyle = '#e0b867';
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    fitFont(c, job.organization, w - 160, 40, 600, F.serif);
    c.fillText(job.organization, 80, 170);
    c.font = `italic 400 26px ${F.serif}`;
    wrapText(c, job.detail, w - 170).forEach((line, i) => c.fillText(line, 80, 216 + i * 34));
    c.fillRect(80, 330, 120, 3);
    fitFont(c, job.role, w - 160, 30, 600, F.serif);
    c.fillText(job.role, 80, 392);
    fitFont(c, job.period, w - 160, 22, 500, F.mono);
    c.fillText(job.period, 80, 436);
    c.fillStyle = '#efe3c6';
    c.fillRect(80, h - 190, 200, 96);
    barcode(c, 92, h - 178, 176, 60, '#1f1710');
  });
}

function pageBase(c: Ctx, w: number, h: number, seed: number) {
  c.fillStyle = '#efe3c6';
  c.fillRect(0, 0, w, h);
  grainy(c, w, h, seed, 7000, 0.07);
}

/** Page de gauche : le poste chez DEFI-METIERS. */
export function paintBookLeft(scene: SceneContent): Painter {
  const job = scene.facts.defiMetiers;
  const { chapter } = scene.book;
  return scaled(512, (c, w, h, F) => {
    pageBase(c, w, h, 41);
    const g = c.createLinearGradient(w - 70, 0, w, 0);
    g.addColorStop(0, 'rgba(90,60,20,0)');
    g.addColorStop(1, 'rgba(90,60,20,.35)');
    c.fillStyle = g;
    c.fillRect(w - 70, 0, 70, h);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#8d2a20';
    c.font = `600 20px ${F.mono}`;
    c.fillText(chapter, 56, 92);
    c.fillStyle = '#1f1710';
    c.font = `700 66px ${F.serif}`;
    c.fillText(job.year, 52, 170);
    fitFont(c, job.period, w - 120, 30, 'italic 400', F.serif);
    c.fillText(job.period, 56, 214);
    c.fillRect(56, 244, 200, 2.5);
    fitFont(c, job.role, w - 120, 40, 600, F.serif);
    c.fillText(job.role, 56, 306);
    c.fillStyle = '#3a2d20';
    c.font = `600 28px ${F.serif}`;
    c.fillText(job.organization, 56, 356);
    c.font = `400 26px ${F.serif}`;
    wrapText(c, job.detail, w - 130).forEach((line, i) => c.fillText(line, 56, 396 + i * 36));
    c.fillStyle = '#3b5f86';
    c.save();
    c.translate(70, 560);
    c.rotate(-0.05);
    fitFont(c, job.stack, w - 170, 44, 700, F.hand);
    c.fillText(job.stack, 0, 0);
    c.restore();
    c.strokeStyle = '#3b5f86';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(70, 578);
    c.quadraticCurveTo(200, 590, 330, 572);
    c.stroke();
    c.fillStyle = '#7b6a55';
    c.font = `500 18px ${F.mono}`;
    c.fillText('12', 56, h - 40);
  });
}

/** Page de droite : l'exercice, du code Drupal / PHP sur la maintenance. */
export function paintBookRight(scene: SceneContent): Painter {
  const { exercise, code, lines } = scene.book;
  return scaled(512, (c, w, h, F) => {
    pageBase(c, w, h, 43);
    const g = c.createLinearGradient(0, 0, 70, 0);
    g.addColorStop(0, 'rgba(90,60,20,.38)');
    g.addColorStop(1, 'rgba(90,60,20,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 70, h);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#1f1710';
    c.font = `600 26px ${F.serif}`;
    c.fillText(exercise, 60, 96);
    c.fillStyle = 'rgba(31,23,16,.08)';
    c.fillRect(54, 124, w - 96, 300);
    const longest = code.reduce((a, b) => (b.length > a.length ? b : a), '');
    const size = fitFont(c, longest, w - 150, 21, 500, F.mono);
    const step = Math.min(40, 270 / code.length);
    // Le surligneur sur l'avant-dernière ligne du code.
    const marked = Math.max(0, code.length - 2);
    // Le contenu n'a pas d'espaces en tête : le corps d'une fonction est
    // décalé ici, entre « function » et « } ».
    const indent = (i: number) =>
      code.slice(0, i).some((l) => l.startsWith('function')) &&
      !code.slice(0, i + 1).some((l, j) => j > 0 && l === '}')
        ? 28
        : 0;
    c.fillStyle = 'rgba(240,200,60,.45)';
    c.fillRect(
      66 + indent(marked),
      166 + marked * step - size + 2,
      c.measureText(code[marked] ?? '').width + 12,
      size + 8,
    );
    code.forEach((line, i) => {
      const tag = line.startsWith('<?') || line.startsWith('?>');
      c.fillStyle = tag ? '#8d2a20' : line.startsWith('//') ? '#7b6a55' : '#1f1710';
      c.fillText(line, 72 + indent(i), 166 + i * step);
    });
    c.fillStyle = '#3a2d20';
    lines.forEach((line, i) => {
      fitFont(c, line, w - 110, 26, 400, F.serif);
      c.fillText(line, 60, 486 + i * 38);
    });
    c.fillStyle = '#7b6a55';
    c.font = `500 18px ${F.mono}`;
    c.fillText('13', w - 80, h - 40);
  });
}
