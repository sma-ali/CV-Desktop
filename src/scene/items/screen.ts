import type { SceneContent } from '@/content/scene/schema';
import type { SceneFonts } from '../core/fonts';

// L'écran principal : un éditeur sombre où le code du parcours se tape
// pendant l'arrivée (drawCode du prototype). Le défaut du prototype (code
// illisible en vue large, 23 px sur 1024) est corrigé ainsi : texture deux
// fois plus fine, code plus court, et une taille de police calculée pour
// remplir l'écran (environ 60 px sur 2048).

export const SCREEN_TEXTURE = { width: 2048, height: 1152 } as const;

/** Couleurs de la coloration syntaxique (celles du prototype). */
const SYNTAX = {
  comment: '#8a7a66',
  string: '#b4c98f',
  number: '#f0956f',
  keyword: '#f2a94e',
  call: '#7fc4bb',
  key: '#e8d7b8',
  name: '#f3e9d4',
  punctuation: '#bba98e',
} as const;

type TokenKind = keyof typeof SYNTAX;
export type Token = readonly [text: string, kind: TokenKind];

const KEYWORDS = new Set([
  'export',
  'import',
  'from',
  'const',
  'let',
  'type',
  'as',
  'true',
  'false',
  'return',
]);

/** Découpe une ligne de TypeScript en morceaux colorés. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest.startsWith('//')) {
      tokens.push([rest, 'comment']);
      break;
    }
    const string = /^(['"])(?:\\.|(?!\1).)*\1?/.exec(rest);
    if (string) {
      tokens.push([string[0], 'string']);
      i += string[0].length;
      continue;
    }
    const number = /^\d+/.exec(rest);
    if (number) {
      tokens.push([number[0], 'number']);
      i += number[0].length;
      continue;
    }
    const word = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(rest);
    if (word) {
      const value = word[0];
      const next = rest[value.length];
      tokens.push([
        value,
        KEYWORDS.has(value) ? 'keyword' : next === '(' ? 'call' : next === ':' ? 'key' : 'name',
      ]);
      i += value.length;
      continue;
    }
    // Les espaces se regroupent : moins de morceaux à dessiner.
    const spaces = /^ +/.exec(rest);
    const value = spaces ? spaces[0] : (rest[0] ?? '');
    tokens.push([value, 'punctuation']);
    i += value.length;
  }
  return tokens;
}

/** Ce que l'écran montre à un instant : caractères tapés, curseur, ligne finale. */
export interface ScreenFrame {
  /** Caractères du code déjà tapés (sans les retours à la ligne). */
  typed: number;
  /** Caractères visibles de la ligne finale. */
  extra: number;
  cursor: boolean;
}

export function codeLength(code: readonly string[]): number {
  return code.reduce((total, line) => total + line.length, 0);
}

/** Numéro (base 0) de la ligne où se trouve le curseur après typed caractères. */
export function cursorLine(code: readonly string[], typed: number): number {
  let total = 0;
  for (let i = 0; i < code.length; i++) {
    total += code[i]?.length ?? 0;
    if (total >= typed) return i;
  }
  return Math.max(0, code.length - 1);
}

/** La mise en page du code : taille de police et interligne qui remplissent l'écran. */
export interface ScreenLayout {
  fontSize: number;
  lineHeight: number;
  top: number;
  gutter: number;
}

const HEADER = 76;
const STATUS = 60;
const PADDING = 26;
/** Début de la barre d'état, à droite du post-it rose posé sur le cadre. */
const STATUS_LEFT = 104;

/**
 * Plus grande police qui fait tenir toutes les lignes (code et ligne finale)
 * en hauteur et la plus longue en largeur. charRatio : largeur d'un caractère
 * de la police à chasse fixe rapportée à sa taille.
 */
export function screenLayout(
  lines: readonly string[],
  width: number,
  height: number,
  charRatio = 0.6,
): ScreenLayout {
  const count = Math.max(1, lines.length);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const byHeight = (height - HEADER - STATUS - PADDING * 2) / (count * 1.24);
  // Gouttière des numéros de ligne : environ 2.3 fois la taille de la police.
  const byWidth = (width - PADDING * 2) / (longest * charRatio + 2.3);
  const fontSize = Math.floor(Math.min(byHeight, byWidth));
  return {
    fontSize,
    lineHeight: Math.floor(fontSize * 1.24),
    top: HEADER + PADDING,
    gutter: Math.round(fontSize * 2.3),
  };
}

/** Bande horizontale de la texture, en pixels (top inclus, height de haut). */
export interface ScreenBand {
  top: number;
  height: number;
}

/**
 * La bande qui contient tout ce qui bouge une fois le code tapé : la dernière
 * ligne du code (le curseur y attend), la ligne finale qui se tape et
 * s'efface en boucle, et son numéro. Seule cette bande est repeinte ensuite,
 * au lieu de toute la texture.
 */
export function closingBand(
  code: readonly string[],
  closing: string,
  width: number = SCREEN_TEXTURE.width,
  height: number = SCREEN_TEXTURE.height,
): ScreenBand {
  const { fontSize, lineHeight, top } = screenLayout([...code, closing], width, height);
  const last = Math.max(0, code.length - 1);
  const start = Math.floor(top + last * lineHeight);
  // Jusque sous les jambages et le curseur de la ligne finale, sans toucher la barre d'état.
  const end = Math.min(height - STATUS, Math.ceil(top + code.length * lineHeight + fontSize * 1.3));
  return { top: start, height: end - start };
}

/** Dessine l'éditeur et le code tapé jusqu'à state. */
export function drawScreen(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  fonts: SceneFonts,
  screen: SceneContent['screen'],
  tokens: readonly Token[][],
  state: ScreenFrame,
): void {
  const { code, closing } = screen;
  const total = codeLength(code);
  const typed = Math.max(0, Math.min(state.typed, total));
  const extra = typed >= total ? Math.max(0, Math.min(state.extra, closing.length)) : 0;

  // Le cadre de l'éditeur : onglets en haut, barre d'état en bas.
  c.fillStyle = '#1a1512';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#241d18';
  c.fillRect(0, 0, w, HEADER);
  ['#c0574a', '#d9a441', '#7fa36b'].forEach((color, k) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(44 + k * 40, HEADER / 2, 12, 0, 7);
    c.fill();
  });
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.font = `500 32px ${fonts.mono}`;
  const tabWidth = c.measureText(screen.fileName).width + 76;
  c.fillStyle = '#1a1512';
  c.fillRect(180, 10, tabWidth, HEADER - 10);
  c.fillStyle = '#f3e9d4';
  c.fillText(screen.fileName, 218, HEADER / 2 + 4);
  c.fillStyle = '#f2a94e';
  c.fillRect(180, HEADER - 4, tabWidth, 4);
  c.font = `400 30px ${fonts.mono}`;
  c.fillStyle = '#7d6c58';
  c.fillText(screen.otherFile, 180 + tabWidth + 40, HEADER / 2 + 4);

  c.fillStyle = '#241d18';
  c.fillRect(0, h - STATUS, w, STATUS);
  c.font = `500 28px ${fonts.mono}`;
  c.fillStyle = '#a8977f';
  const line = Math.min(code.length, cursorLine(code, typed) + 1) + (extra > 0 ? 1 : 0);
  const { status } = screen;
  c.fillText(
    `${status.language}    ${status.encoding}    ${status.line} ${line}    ${status.errors}`,
    // Le post-it rose du cadre couvre le bord gauche de la dalle : à 36 px, il
    // cachait le T de TypeScript.
    STATUS_LEFT,
    h - STATUS / 2,
  );
  c.fillStyle = '#62d18e';
  c.beginPath();
  c.arc(w - 48, h - STATUS / 2, 10, 0, 7);
  c.fill();

  // Le code.
  const layout = screenLayout([...code, closing], w, h);
  const { fontSize, lineHeight, top, gutter } = layout;
  c.textBaseline = 'alphabetic';
  c.font = `400 ${fontSize}px ${fonts.mono}`;
  const charWidth = c.measureText('M').width;
  const left = PADDING + gutter;
  const baseline = (index: number) => top + index * lineHeight + fontSize * 0.92;
  let remaining = typed;
  let cursorX = left;
  let cursorY = baseline(0);
  for (let index = 0; index < code.length; index++) {
    const y = baseline(index);
    c.fillStyle = '#5a4c3e';
    c.textAlign = 'right';
    c.font = `400 ${Math.round(fontSize * 0.78)}px ${fonts.mono}`;
    c.fillText(String(index + 1), left - fontSize * 0.7, y);
    c.textAlign = 'left';
    c.font = `400 ${fontSize}px ${fonts.mono}`;
    if (remaining <= 0 && index > 0) continue;
    const text = code[index] ?? '';
    let shown = Math.min(remaining, text.length);
    let x = left;
    for (const [piece, kind] of tokens[index] ?? []) {
      if (shown <= 0) break;
      const visible = piece.slice(0, shown);
      c.fillStyle = SYNTAX[kind];
      c.fillText(visible, x, y);
      x += visible.length * charWidth;
      shown -= visible.length;
    }
    if (remaining <= text.length) {
      cursorX = left + remaining * charWidth;
      cursorY = y;
      remaining = 0;
    } else {
      remaining -= text.length;
      cursorX = left + text.length * charWidth;
      cursorY = y;
    }
  }
  if (extra > 0) {
    const y = baseline(code.length);
    c.fillStyle = '#5a4c3e';
    c.textAlign = 'right';
    c.font = `400 ${Math.round(fontSize * 0.78)}px ${fonts.mono}`;
    c.fillText(String(code.length + 1), left - fontSize * 0.7, y);
    c.textAlign = 'left';
    c.font = `400 ${fontSize}px ${fonts.mono}`;
    c.fillStyle = '#c9a46a';
    c.fillText(closing.slice(0, extra), left, y);
    cursorX = left + extra * charWidth;
    cursorY = y;
  }
  if (state.cursor) {
    c.fillStyle = '#ffcf8a';
    c.fillRect(cursorX + 3, cursorY - fontSize * 0.86, charWidth * 0.62, fontSize * 1.06);
  }
}
