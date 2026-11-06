import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../../core/canvas2d';
import { type Painter, scaled } from './common';

// Le portable (la pile : les compétences)

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

/**
 * La pile du portable : les compétences du CV que porte le contenu de la
 * scène (la pile de l'écran, les autocollants), sans les noms des projets,
 * qui ont leurs propres objets (le bocal et la baie). Sans doublon, dans
 * l'ordre du contenu.
 */
export function laptopSkills(scene: SceneContent): string[] {
  const projects = new Set(scene.facts.projects.items.map((item) => item.name));
  const skills = [...scene.screen.words.stackItems, ...scene.facts.projects.stickers];
  return [...new Set(skills.filter((skill) => !projects.has(skill)))];
}

/**
 * Les pastilles de l'écran du portable : la pile, puis les technologies des
 * projets qui figurent dans la section compétences du CV (skills, à plat ;
 * « PostgreSQL / pgvector » compte pour pgvector). Une technologie propre à
 * un projet, absente des compétences (WireGuard), reste sur son objet.
 */
export function laptopChips(scene: SceneContent, skills: readonly string[]): string[] {
  const projects = new Set(scene.facts.projects.items.map((item) => item.name));
  const known = new Set(skills.flatMap((skill) => [skill, ...skill.split(/\s*\/\s*/)]));
  const chips = [
    ...laptopSkills(scene),
    ...scene.facts.projects.chips.filter((chip) => known.has(chip)),
  ];
  return [...new Set(chips.filter((chip) => !projects.has(chip)))];
}

/** Le couvercle fermé du portable, couvert d'autocollants : la pile. */
export function paintLaptopStickers(scene: SceneContent): Painter {
  const stickers = laptopSkills(scene);
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

/**
 * L'écran du portable, vu quand il s'ouvre devant la caméra : la pile en
 * code (« const pile = [ ... ] »), en pastilles.
 */
export function paintLaptopScreen(scene: SceneContent, skills: readonly string[]): Painter {
  const { path } = scene.laptop;
  const { mark, text } = scene.labels.laptop;
  const { stack } = scene.screen.words;
  const chips = laptopChips(scene, skills);
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
    fitFont(c, mark, w - 100, 96, 700, F.serif);
    c.fillText(mark, 48, 140);
    const markWidth = c.measureText(mark).width;
    c.fillStyle = '#a8977f';
    fitFont(c, text, w - markWidth - 120, 34, 'italic 400', F.serif);
    c.fillText(text, 48 + markWidth + 22, 140);
    c.font = `500 26px ${F.mono}`;
    c.fillStyle = '#c792ea';
    c.fillText('const', 52, 206);
    const constWidth = c.measureText('const ').width;
    c.fillStyle = '#f3e9d4';
    c.fillText(`${stack} = [`, 52 + constWidth, 206);
    let x = 80;
    let y = 236;
    c.font = `600 24px ${F.mono}`;
    for (const chip of chips) {
      const tw = c.measureText(chip).width + 30;
      if (x + tw > w - 40) {
        x = 80;
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
    c.font = `500 26px ${F.mono}`;
    c.fillStyle = '#f3e9d4';
    c.fillText('];', 52, y + 90);
    c.fillStyle = '#ffcf8a';
    c.fillRect(52 + c.measureText('];').width + 8, y + 70, 12, 24);
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
