import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../../core/canvas2d';
import type { SkillGroup } from '../../core/texts';
import { type Painter, scaled } from './common';

// Le portable (les compétences)

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
 * Les autocollants du portable : les compétences du CV que porte le contenu
 * de la scène (celles de l'écran, les autocollants), sans les noms des projets,
 * qui ont leurs propres objets (le bocal et la baie). Sans doublon, dans
 * l'ordre du contenu.
 */
export function laptopSkills(scene: SceneContent): string[] {
  const projects = new Set(scene.facts.projects.items.map((item) => item.name));
  const skills = [...scene.screen.words.stackItems, ...scene.facts.projects.stickers];
  return [...new Set(skills.filter((skill) => !projects.has(skill)))];
}

/** Le couvercle fermé du portable, couvert d'autocollants de compétences. */
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

/** Une ligne de l'écran du portable : l'intitulé d'un groupe, ou une pastille. */
interface ScreenChip {
  kind: 'label' | 'chip';
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Range les compétences en lignes, groupe par groupe : chaque groupe ouvre
 * une ligne par son intitulé, ses pastilles suivent et passent à la ligne au
 * bord droit. Renvoie les éléments placés et le bas de la dernière ligne.
 */
export function layoutLaptopChips(
  groups: readonly SkillGroup[],
  measure: (text: string) => number,
  size: number,
  left: number,
  right: number,
  top: number,
): { placed: ScreenChip[]; bottom: number } {
  const row = Math.round(size * 1.9);
  const pad = Math.round(size * 0.55);
  const gap = Math.round(size * 0.45);
  const placed: ScreenChip[] = [];
  let y = top;
  for (const group of groups) {
    const label = `${group.label}:`;
    const labelWidth = measure(label);
    placed.push({ kind: 'label', text: label, x: left, y, width: labelWidth });
    let x = left + labelWidth + gap * 2;
    for (const item of group.items) {
      const width = measure(item) + pad * 2;
      if (x + width > right) {
        x = left + size * 1.5;
        y += row;
      }
      placed.push({ kind: 'chip', text: item, x, y, width });
      x += width + gap;
    }
    y += row + Math.round(size * 0.35);
  }
  return { placed, bottom: y };
}

/** L'écran du portable, en pixels logiques : largeur et hauteur visible. */
export const LAPTOP_SCREEN = { width: 800, visible: 560 } as const;
/** Taille du texte des compétences sur l'écran du portable. */
const CHIP_SIZE = 22;
/** Haut de la première ligne de compétences, sous l'en-tête et « const … = { ». */
const CHIPS_TOP = 150;
const CHIPS_LEFT = 58;
const CHIPS_RIGHT = LAPTOP_SCREEN.width - 26;

/** Largeur d'un texte dans la police à chasse fixe (0.6 de la taille par caractère). */
const monoWidth = (size: number) => (text: string) => text.length * size * 0.6;

/** Les compétences rangées sur l'écran du portable (positions en pixels logiques). */
function laptopScreenLayout(skills: readonly SkillGroup[]) {
  return layoutLaptopChips(
    skills,
    monoWidth(CHIP_SIZE),
    CHIP_SIZE,
    CHIPS_LEFT,
    CHIPS_RIGHT,
    CHIPS_TOP,
  );
}

/**
 * Hauteur totale de l'écran du portable (pixels logiques) : toutes les
 * compétences et l'accolade finale. Plus haute que la partie visible, elle
 * défile (laptopScroll.ts).
 */
export function laptopScreenHeight(skills: readonly SkillGroup[]): number {
  return Math.max(LAPTOP_SCREEN.visible, laptopScreenLayout(skills).bottom + 60);
}

/**
 * L'écran du portable, vu quand il s'ouvre devant la caméra : toutes les
 * compétences du CV en code (« const competences = { ... } »), en pastilles
 * rangées par groupe. La toile est plus haute que l'écran : elle défile.
 */
export function paintLaptopScreen(scene: SceneContent, skills: readonly SkillGroup[]): Painter {
  const { path } = scene.laptop;
  const { mark, text } = scene.labels.laptop;
  const { stack } = scene.screen.words;
  const layout = laptopScreenLayout(skills);
  return scaled(LAPTOP_SCREEN.width, (c, w, h, F) => {
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
    fitFont(c, mark, w - 100, 54, 700, F.serif);
    c.fillText(mark, 40, 92);
    const markWidth = c.measureText(mark).width;
    c.fillStyle = '#a8977f';
    fitFont(c, text, w - markWidth - 120, 28, 'italic 400', F.serif);
    c.fillText(text, 40 + markWidth + 18, 92);
    c.font = `500 22px ${F.mono}`;
    c.fillStyle = '#c792ea';
    c.fillText('const', 40, 134);
    const constWidth = c.measureText('const ').width;
    c.fillStyle = '#f3e9d4';
    c.fillText(`${stack} = {`, 40 + constWidth, 134);

    const size = CHIP_SIZE;
    const chipHeight = Math.round(size * 1.5);
    for (const item of layout.placed) {
      if (item.kind === 'label') {
        c.font = `500 ${size}px ${F.mono}`;
        c.fillStyle = '#a8977f';
        c.fillText(item.text, item.x, item.y + size * 1.08);
        continue;
      }
      c.font = `600 ${size}px ${F.mono}`;
      c.strokeStyle = '#7fc4bb';
      c.lineWidth = 1.5;
      roundRect(c, item.x, item.y, item.width, chipHeight, 5);
      c.stroke();
      c.fillStyle = '#7fc4bb';
      c.fillText(item.text, item.x + size * 0.55, item.y + size * 1.08);
    }
    c.font = `500 22px ${F.mono}`;
    c.fillStyle = '#f3e9d4';
    c.fillText('};', 40, layout.bottom + 22);
    c.fillStyle = '#ffcf8a';
    c.fillRect(40 + c.measureText('};').width + 8, layout.bottom + 4, 11, 22);
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
