import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../core/canvas2d';
import type { SceneFonts } from '../core/fonts';
import { rng } from '../core/rng';

// Les textures peintes des objets du CV (couvertures, pages, badge, post-it,
// carte, portable, plaque du coffret), portées du prototype. Les mises en page
// gardent les coordonnées du prototype ; les textures plus fines sont
// dessinées à l'échelle (ctx.scale). Tous les mots viennent de SceneContent :
// faits du CV, ou décor qui n'affirme rien.

type Ctx = CanvasRenderingContext2D;
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
function scaled(base: number, paint: (ctx: Ctx, w: number, h: number, fonts: SceneFonts) => void) {
  return (ctx: Ctx, width: number, height: number, fonts: SceneFonts) => {
    const k = width / base;
    ctx.scale(k, k);
    paint(ctx, width / k, height / k, fonts);
  };
}

/** Un code-barres décoratif, toujours le même. */
function barcode(ctx: Ctx, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  const bars = Math.floor(width / 7.6);
  for (let i = 0; i < bars; i++) ctx.fillRect(x + i * 7.6, y, ((i * 7) % 5) + 2, height);
}

/** Une coche manuscrite. */
function checkMark(ctx: Ctx, x: number, y: number, size: number, color: string, width: number) {
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

// ------------------------------------------------------------------
// Le livre (DEFI-METIERS)
// ------------------------------------------------------------------

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

/** Le dos du livre (vu quand on le retournera, étape 4). */
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

/** Page de droite : l'exercice, la migration du catalogue des formations. */
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
    // Le surligneur sur l'appel qui migre (l'avant-dernière ligne).
    const marked = Math.max(0, code.length - 2);
    c.fillStyle = 'rgba(240,200,60,.45)';
    c.fillRect(
      66,
      166 + marked * step - size + 2,
      c.measureText(code[marked] ?? '').width + 12,
      size + 8,
    );
    code.forEach((line, i) => {
      const tag = line.startsWith('<?') || line.startsWith('?>');
      c.fillStyle = tag ? '#8d2a20' : line.startsWith('//') ? '#7b6a55' : '#1f1710';
      c.fillText(line, 72, 166 + i * step);
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

// ------------------------------------------------------------------
// Le badge (DEFI-METIERS)
// ------------------------------------------------------------------

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

export function paintBadgeBack(scene: SceneContent): Painter {
  const job = scene.facts.defiMetiers;
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
    c.font = `700 46px ${F.serif}`;
    c.fillText(job.year, 40, 170);
    fitFont(c, job.period, w - 80, 26, 'italic 400', F.serif);
    c.fillText(job.period, 40, 210);
    c.fillRect(40, 236, 120, 3);
    fitFont(c, job.role, w - 80, 32, 600, F.serif);
    c.fillText(job.role, 40, 290);
    c.fillStyle = '#3a2d20';
    c.font = `400 22px ${F.serif}`;
    wrapText(c, job.detail, w - 80)
      .slice(0, 3)
      .forEach((line, i) => c.fillText(line, 40, 340 + i * 30));
    c.fillStyle = '#2d5a5c';
    fitFont(c, job.stack, w - 80, 38, 700, F.hand);
    c.fillText(job.stack, 40, 520);
  });
}

// ------------------------------------------------------------------
// Les post-it (DARES)
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// La carte de visite (contact)
// ------------------------------------------------------------------

export const CARD_TEXTURE = { width: 1020, height: 600 } as const;

export function paintCardFront(scene: SceneContent): Painter {
  const { name, headline, location } = scene.facts;
  return scaled(680, (c, w, h, F) => {
    c.fillStyle = '#e8dcc4';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 71, 5000, 0.05);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#1f1710';
    fitFont(c, name, w - 110, 104, 650, F.serif);
    c.fillText(name, 52, 190);
    c.fillStyle = '#c9973f';
    c.fillRect(56, 226, 90, 5);
    c.fillStyle = '#1f1710';
    const title = headline.toLocaleUpperCase();
    fitFont(c, title, w - 110, 30, 500, F.mono);
    c.fillText(title, 56, 290);
    c.fillStyle = '#6a5a48';
    fitFont(c, location, w - 110, 28, 'italic 400', F.serif);
    c.fillText(location, 56, 340);
    c.strokeStyle = 'rgba(201,151,63,.8)';
    c.lineWidth = 2;
    c.strokeRect(18, 18, w - 36, h - 36);
  });
}

export function paintCardBack(scene: SceneContent): Painter {
  const { availability, location, email, linkedin } = scene.facts;
  const { contact } = scene.card;
  return scaled(680, (c, w, h, F) => {
    c.fillStyle = '#1f1710';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 72, 5000, 0.08);
    c.strokeStyle = 'rgba(201,151,63,.8)';
    c.lineWidth = 2;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#e2c58c';
    c.font = `500 22px ${F.mono}`;
    c.fillText(contact.toLocaleUpperCase(), 56, 82);
    c.fillStyle = '#62d18e';
    c.beginPath();
    c.arc(66, 136, 10, 0, 7);
    c.fill();
    c.fillStyle = '#f3e9d4';
    fitFont(c, availability, w - 160, 46, 600, F.serif);
    c.fillText(availability, 92, 152);
    c.font = `italic 400 32px ${F.serif}`;
    wrapText(c, location, w - 112)
      .slice(0, 2)
      .forEach((line, i) => c.fillText(line, 56, 214 + i * 40));
    c.fillStyle = '#c9973f';
    roundRect(c, 56, 288, w - 112, 1.5, 0);
    c.fill();
    c.fillStyle = '#f3e9d4';
    fitFont(c, email, w - 112, 26, 500, F.mono);
    c.fillText(email, 56, 330);
    c.fillStyle = '#e2c58c';
    fitFont(c, linkedin, w - 112, 24, 500, F.mono);
    c.fillText(linkedin, 56, 368);
  });
}

// ------------------------------------------------------------------
// Le portable (projets 2026)
// ------------------------------------------------------------------

export const LAPTOP_TEXTURE = { width: 1200, height: 840 } as const;

type StickerShape = 'rect' | 'round' | 'pill' | 'hex';
const STICKER_STYLES: {
  x: number;
  y: number;
  r: number;
  bg: string;
  fg: string;
  shape: StickerShape;
  fs: number;
}[] = [
  { x: 230, y: 140, r: -0.1, bg: '#2a2f3a', fg: '#e9c98a', shape: 'rect', fs: 56 },
  { x: 590, y: 120, r: 0.1, bg: '#2f5f8f', fg: '#f3eee4', shape: 'round', fs: 50 },
  { x: 190, y: 400, r: 0.07, bg: '#4f7a45', fg: '#f3eee4', shape: 'hex', fs: 52 },
  { x: 500, y: 320, r: -0.14, bg: '#f3eee4', fg: '#151515', shape: 'pill', fs: 50 },
  { x: 630, y: 450, r: 0.12, bg: '#c2492f', fg: '#f6efe2', shape: 'rect', fs: 48 },
];

/** Le couvercle fermé du portable, couvert d'autocollants. */
export function paintLaptopStickers(scene: SceneContent): Painter {
  const { stickers } = scene.facts.projects;
  return scaled(800, (c, w, h, F) => {
    c.fillStyle = '#8f8a82';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 81, 6000, 0.05);
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,.10)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    stickers.slice(0, STICKER_STYLES.length).forEach((label, i) => {
      const s = STICKER_STYLES[i];
      if (!s) return;
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.r);
      const size = fitFont(c, label, 300, s.fs, 700, F.serif);
      const tw = c.measureText(label).width;
      const pw = tw + 56;
      const ph = size + 42;
      const path = () => {
        if (s.shape === 'round') {
          c.beginPath();
          c.ellipse(0, 0, pw / 2 + 8, ph / 2 + 16, 0, 0, 7);
        } else if (s.shape === 'pill') {
          roundRect(c, -pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12, (ph + 12) / 2);
        } else if (s.shape === 'hex') {
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            c.lineTo(Math.cos(a) * (pw / 2 + 18), Math.sin(a) * (ph / 2 + 22));
          }
          c.closePath();
        } else {
          roundRect(c, -pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12, 10);
        }
      };
      c.shadowColor = 'rgba(0,0,0,.35)';
      c.shadowBlur = 6;
      c.shadowOffsetY = 3;
      c.fillStyle = '#f6f1e7';
      path();
      c.fill();
      c.shadowColor = 'transparent';
      c.save();
      c.scale(0.95, 0.9);
      path();
      c.fillStyle = s.bg;
      c.fill();
      c.restore();
      c.fillStyle = s.fg;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, 4);
      c.restore();
    });
  });
}

/** L'écran du portable, vu quand il s'ouvre devant la caméra. */
export function paintLaptopScreen(scene: SceneContent): Painter {
  const { projects } = scene.facts;
  const { path } = scene.laptop;
  return scaled(800, (c, w, h, F) => {
    c.fillStyle = '#1a1512';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#241d18';
    c.fillRect(0, 0, w, 34);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#7d6c58';
    c.font = `500 15px ${F.mono}`;
    c.fillText(path, 20, 23);
    c.fillStyle = '#f2a94e';
    c.font = `700 112px ${F.serif}`;
    c.fillText(projects.year, 48, 150);
    projects.items.slice(0, 2).forEach((item, i) => {
      const y = 214 + i * 70;
      c.fillStyle = '#f3e9d4';
      c.font = `600 40px ${F.serif}`;
      c.fillText(item.name, 52, y);
      const nameWidth = c.measureText(item.name).width;
      c.fillStyle = '#a8977f';
      fitFont(c, item.tagline, w - nameWidth - 120, 24, 'italic 400', F.serif);
      c.fillText(item.tagline, 52 + nameWidth + 18, y);
    });
    let x = 52;
    let y = 362;
    c.font = `600 24px ${F.mono}`;
    for (const chip of projects.chips) {
      const tw = c.measureText(chip).width + 30;
      if (x + tw > w - 40) {
        x = 52;
        y += 56;
      }
      c.strokeStyle = '#7fc4bb';
      c.lineWidth = 2;
      roundRect(c, x, y, tw, 42, 6);
      c.stroke();
      c.fillStyle = '#7fc4bb';
      c.fillText(chip, x + 15, y + 29);
      x += tw + 12;
    }
    const comment = `// ${projects.tests}`;
    c.fillStyle = '#8a7a66';
    c.font = `400 22px ${F.mono}`;
    c.fillText(comment, 52, h - 52);
    c.fillStyle = '#ffcf8a';
    c.fillRect(52 + c.measureText(comment).width + 6, h - 72, 12, 24);
  });
}

/** Les touches du portable (décor). */
export const paintLaptopKeys: Painter = (c, w, h) => {
  c.fillStyle = '#7b766e';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#2a2724';
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 13; k++) {
      roundRect(c, 40 + k * 33.5, 30 + r * 34, 29, 29, 3);
      c.fill();
    }
  }
  c.fillStyle = '#6a655e';
  roundRect(c, 170, 220, 170, 100, 6);
  c.fill();
};

// ------------------------------------------------------------------
// La plaque du coffret scellé
// ------------------------------------------------------------------

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
