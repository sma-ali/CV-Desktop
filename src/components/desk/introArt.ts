// Le dessin de l'écran de chargement (validé le 05/11, version 24 de la
// maquette) : Ali derrière son ordinateur portable, vu de face, qui tape.
// Ses lunettes reflètent un éditeur sombre où défile du code, la lueur de
// l'écran vacille sur son visage, une tasse fume à côté, et la barre de
// chargement court sous l'ordinateur. Des frappes tombent au hasard sur les
// côtés du clavier, chacune fait plonger un peu sa tête. Vers 70 %, une
// goutte de sueur apparaît une fois et reste. Quand tout est prêt, ses
// verres deviennent blancs, une étincelle brille et un « ting ! » s'affiche.
//
// Tout est du SVG en texte : le serveur rend la première image, puis
// Intro.tsx redessine à chaque image. Le décor ne montre rien de réel (ni
// marque, ni jeu, ni animé).

/** Le cadre du dessin (viewBox du SVG). */
export const INTRO_VIEWBOX = '-12 4 224 140';

/** La durée d'une boucle de frappes : un nouveau rythme tiré à chaque boucle. */
const LOOP = 10_000;

/** Un nombre pseudo-aléatoire stable (0 à 1) pour n. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5;
  return x - Math.floor(x);
};

const f = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

const SKIN = '#e9c3a1';
const SKIN_D = '#d4a582';
const HAIR = '#2a1c15';
const HAIR_L = '#3d2a1f';
const BEARD = '#3a2a22';
const HOOD = '#1d2333';
const MONO = 'font-family:var(--font-pixel),var(--mono),monospace';

/** Une frappe : son instant dans la boucle, sa place et ses traits. */
export interface Hit {
  t: number;
  x: number;
  y: number;
  dir: -1 | 1;
  n: number;
  spread: number;
  rot: number;
  len: number;
  w: number;
  life: number;
}

/**
 * Le rythme d'une boucle : tantôt une frappe isolée, tantôt une petite
 * rafale, avec des pauses de longueur variable, et de temps en temps une
 * grosse touche. Les frappes tombent à gauche ou à droite de l'ordinateur,
 * jamais derrière.
 */
export function hitSchedule(rnd: () => number = Math.random): Hit[] {
  const out: Hit[] = [];
  let t = 0;
  let burst = 0;
  while (t < 7000) {
    if (burst <= 0) burst = rnd() < 0.35 ? 0 : 1 + Math.floor(rnd() * 4);
    const gap = burst > 0 ? 130 + rnd() * 170 : rnd() < 0.2 ? 800 + rnd() * 500 : 330 + rnd() * 350;
    burst--;
    t += gap;
    const left = rnd() < 0.5;
    const big = rnd() < 0.09;
    out.push({
      t,
      x: left ? 39 + rnd() * 5 : 156 + rnd() * 5,
      y: 96 + rnd() * 16,
      dir: left ? -1 : 1,
      n: big ? 5 : 2 + Math.floor(rnd() * 2),
      spread: 50 + rnd() * 30,
      rot: (rnd() - 0.5) * 30,
      len: big ? 9 : 4 + rnd() * 4,
      w: big ? 2 : 1.1 + rnd() * 0.7,
      life: big ? 420 : 220 + rnd() * 160,
    });
  }
  return out;
}

// Les six stickers au dos de l'ordinateur, dans l'ordre choisi le 05/11 :
// balise de code, dé à 20 faces, terminal, cœur en pixels, branche git, manette.
const HEART_ROWS: ReadonlyArray<readonly [number, number, number]> = [
  // [y, x de début, x de fin] des lignes du cœur
  [-6, -4.5, -2.5],
  [-6, 1.5, 3.5],
  [-5, -5.5, -1.5],
  [-5, 0.5, 4.5],
  [-4, -6.5, 5.5],
  [-3, -6.5, 5.5],
  [-2, -6.5, 5.5],
  [-1, -5.5, 4.5],
  [0, -4.5, 3.5],
  [1, -3.5, 2.5],
  [2, -2.5, 1.5],
  [3, -1.5, 0.5],
  [4, -0.5, -0.5],
];
const HEART_SHADE: ReadonlyArray<readonly [number, number]> = [
  [4.5, -2],
  [3.5, -1],
  [2.5, 0],
  [1.5, 1],
  [0.5, 2],
  [4.5, -1],
  [3.5, 0],
  [2.5, 1],
  [1.5, 2],
  [0.5, 3],
  [5.5, -2],
  [5.5, -3],
];
const HEART_LIGHT: ReadonlyArray<readonly [number, number]> = [
  [-4.5, -5],
  [-3.5, -5],
  [-5.5, -4],
  [-4.5, -4],
  [-5.5, -3],
];
const px = (x: number, y: number) => `<rect x="${x}" y="${y}" width="1.08" height="1.08"/>`;
const HEART = (() => {
  let base = '';
  for (const [y, from, to] of HEART_ROWS) for (let x = from; x <= to; x++) base += px(x, y);
  return `<g transform="scale(1.45)"><g fill="#e0475b">${base}</g><g fill="#a82a3d">${HEART_SHADE.map(([x, y]) => px(x, y)).join('')}</g><g fill="#ffd0d6">${HEART_LIGHT.map(([x, y]) => px(x, y)).join('')}</g></g>`;
})();

const STICKERS: readonly string[] = [
  `<rect x="-9" y="-5" width="18" height="10" rx="2" fill="#e6a54a"/><text y="2.4" text-anchor="middle" style="${MONO}" font-size="6.5" fill="#1a120c">&lt;/&gt;</text>`,
  `<path d="M0 -9 L8 -4.5 L8 4.5 L0 9 L-8 4.5 L-8 -4.5 Z" fill="#7a5bd0"/><path d="M0 -9 L5 3 L-5 3 Z M-8 -4.5 L-5 3 M8 -4.5 L5 3 M-8 4.5 L-5 3 L0 9 L5 3 L8 4.5" fill="none" stroke="#c7b6f5" stroke-width=".6"/><text y="1.6" text-anchor="middle" style="${MONO}" font-size="4" fill="#fff">20</text>`,
  '<rect x="-11" y="-8" width="22" height="16" rx="2" fill="#15181d" stroke="#5a6270" stroke-width=".6"/><path d="M-11 -5 L11 -5" stroke="#5a6270" stroke-width=".6"/><path d="M-7 -1 L-4 1.5 L-7 4" stroke="#5be08a" stroke-width="1.2" fill="none"/><rect x="-2" y="3.3" width="5" height="1.2" fill="#5be08a"/>',
  HEART,
  '<rect x="-10" y="-10" width="20" height="20" rx="4" fill="#e8673a"/><path d="M-3.5 -6 L-3.5 6 M-3.5 1 Q-3.5 -2 3.5 -3" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="-3.5" cy="-6" r="2" fill="#fff"/><circle cx="-3.5" cy="6" r="2" fill="#fff"/><circle cx="3.5" cy="-4" r="2" fill="#fff"/>',
  '<path d="M-8 -5 Q-6 -7 -3 -6 L3 -6 Q6 -7 8 -5 Q10.5 -2 11 3 Q11.5 7.5 8.5 7.5 Q6.5 7.5 5 4.5 L-5 4.5 Q-6.5 7.5 -8.5 7.5 Q-11.5 7.5 -11 3 Q-10.5 -2 -8 -5 Z" fill="#3c8f8a"/><path d="M-7.5 -6 L-4 -7 M4 -7 L7.5 -6" stroke="#2c6b67" stroke-width="1.4" stroke-linecap="round"/><path d="M-6.6 -1.4 L-3.4 -1.4 M-5 -3 L-5 .2" stroke="#e9f5f1" stroke-width="1.3"/><circle cx="4.6" cy="-3" r=".95" fill="#f2c230"/><circle cx="6.6" cy="-1.3" r=".95" fill="#e0475b"/><circle cx="2.6" cy="-1.3" r=".95" fill="#5fa8e0"/><circle cx="4.6" cy=".4" r=".95" fill="#7fd06a"/><circle cx="-2.4" cy="2.4" r="1.5" fill="#2c6b67"/><circle cx="2.4" cy="2.4" r="1.5" fill="#2c6b67"/><rect x="-1.5" y="-3.4" width="1.2" height=".7" rx=".3" fill="#e9f5f1" opacity=".7"/><rect x=".3" y="-3.4" width="1.2" height=".7" rx=".3" fill="#e9f5f1" opacity=".7"/>',
];
const SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [66, 82, -9],
  [96, 79, 6],
  [129, 81, 10],
  [70, 104, 7],
  [101, 103, -5],
  [131, 104, -8],
];
const STICKER_LAYER = STICKERS.map((svg, i) => {
  const [x, y, rot] = SLOTS[i]!;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(.82)"><g opacity=".93">${svg}</g></g>`;
}).join('');

// Les cheveux : ondulés, pas bouclés, avec une frange en vagues balayée vers
// la gauche et quelques épis ébouriffés.
const HAIR_PATH = (() => {
  const cx = 100;
  const cy = 41;
  const rx = 31;
  const ry = 24;
  const n = 15;
  const jitter = [0, 3, 0, 4, 1, 4, 0, 5, 2, 4, 1, 5, 1, 3, 0, 1];
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const th = ((212 - (i * 244) / n) * Math.PI) / 180;
    const rr = 1 + jitter[i]! * 0.016;
    out.push([cx + Math.cos(th) * rx * rr, cy - Math.sin(th) * ry * rr]);
  }
  const first = out[0]!;
  const last = out[out.length - 1]!;
  let path = `M${f(first[0])} ${f(first[1] + 9)} L${f(first[0])} ${f(first[1])}`;
  for (let i = 1; i < out.length; i++) {
    const [x0, y0] = out[i - 1]!;
    const [x1, y1] = out[i]!;
    const k = 1.02 + (i % 2) * 0.07;
    path += ` Q${f(cx + ((x0 + x1) / 2 - cx) * k)} ${f(cy + ((y0 + y1) / 2 - cy) * k)} ${f(x1)} ${f(y1)}`;
  }
  path += ` L${f(last[0])} ${f(last[1] + 9)} Q${f(last[0] - 2)} 52 121 47`;
  path +=
    ' C119 41 115 39 112 43 C109 47 106 41 102 40 C98 39 96 46 92 44 C88 42 86 39 83 43 C81 46 80 46 79 47';
  path += ` Q${f(first[0] + 2)} 52 ${f(first[0])} ${f(first[1] + 9)} Z`;
  return path;
})();

const HAIR_TUFTS = (
  [
    // [angle sur le contour (degrés), longueur, demi-largeur, courbure]
    [150, 4, 4.2, -1.4],
    [118, 5.5, 4.6, 1.8],
    [101, 3.8, 4, -1.2],
    [80, 6, 4.8, 1.6],
    [58, 4.2, 4, -1.8],
    [34, 3.4, 3.6, 1.2],
  ] as const
)
  .map(([deg, len, w, bend]) => {
    const th = (deg * Math.PI) / 180;
    const bx = 100 + Math.cos(th) * 31 * 0.97;
    const by = 41 - Math.sin(th) * 24 * 0.97;
    const nx = Math.cos(th);
    const ny = -Math.sin(th);
    const tx = -ny;
    const ty = nx;
    const tipX = bx + nx * len + tx * bend;
    const tipY = by + ny * len + ty * bend;
    const lx = bx - tx * w - nx * 2;
    const ly = by - ty * w - ny * 2;
    const rx = bx + tx * w - nx * 2;
    const ry = by + ty * w - ny * 2;
    const c1x = bx - tx * w * 0.4 + nx * len * 0.55 + tx * bend * 0.2;
    const c1y = by - ty * w * 0.4 + ny * len * 0.55 + ty * bend * 0.2;
    const c2x = bx + tx * w * 0.5 + nx * len * 0.5 + tx * bend * 0.7;
    const c2y = by + ty * w * 0.5 + ny * len * 0.5 + ty * bend * 0.7;
    return `M${f(lx)} ${f(ly)} Q${f(c1x)} ${f(c1y)} ${f(tipX)} ${f(tipY)} Q${f(c2x)} ${f(c2y)} ${f(rx)} ${f(ry)} Z`;
  })
  .join(' ');

const HAIR_STROKES =
  'M76 34 C82 28 86 33 92 27 C97 22 101 27 106 23 M96 33 C101 29 105 33 110 29 C114 26 118 30 121 28 M74 44 C77 40 79 42 82 38 M118 40 C121 37 123 40 126 37 M86 22 C90 18 94 21 98 18';

const CODE_COLORS = ['#7ee787', '#ffa657', '#79c0ff', '#7ee787', '#d2a8ff', '#ffa657'];

/**
 * Ses lunettes (pantos, d'après sa photo) : haut légèrement bombé, coin
 * extérieur marqué, coin côté nez arrondi, bas en U. Dessiné pour le verre
 * droit, retourné pour le gauche.
 */
function lensShape(cx: number, gy: number, k = 1): string {
  const sg = cx < 100 ? -1 : 1;
  const X = (x: number) => f2(cx + sg * x * 0.93 * k);
  const Y = (y: number) => f2(gy + y * 0.93 * k);
  return `M${X(-5.2)} ${Y(-7.6)} C${X(-1)} ${Y(-8.3)} ${X(4)} ${Y(-8.3)} ${X(7.2)} ${Y(-7.7)} C${X(9.6)} ${Y(-7.3)} ${X(10.2)} ${Y(-6)} ${X(10.2)} ${Y(-3.4)} C${X(10.2)} ${Y(3.6)} ${X(6.4)} ${Y(8.8)} ${X(0)} ${Y(8.8)} C${X(-6.4)} ${Y(8.8)} ${X(-10.2)} ${Y(4)} ${X(-10.2)} ${Y(-1)} C${X(-10.2)} ${Y(-5.2)} ${X(-8.6)} ${Y(-7.2)} ${X(-5.2)} ${Y(-7.6)} Z`;
}

export interface DevSceneOptions {
  /** Mouvement réduit : ni frappes, ni code qui défile, ni vacillement, ni « ting ». */
  still?: boolean;
  /** Le hasard des frappes (les tests le fixent). */
  random?: () => number;
}

/**
 * Une scène qui garde sa mémoire (goutte de sueur, « ting », rythme de la
 * boucle) : à chaque image, render(v, t) rend le contenu du SVG pour
 * l'avancement v (0 à 1) à l'instant t (ms).
 */
export function createDevScene(id: string, { still = false, random }: DevSceneOptions = {}) {
  let doneAt: number | null = null;
  let sweatAt: number | null = null;
  let cache: { loop: number; hits: Hit[] } = { loop: -1, hits: [] };
  const hitsFor = (t: number) => {
    const loop = Math.floor(t / LOOP);
    if (cache.loop !== loop) cache = { loop, hits: hitSchedule(random) };
    return cache.hits;
  };

  return function render(v: number, t: number): string {
    if (v >= 0.7 && v < 1 && sweatAt === null) sweatAt = t;
    if (v < 0.7) sweatAt = null;
    if (v >= 1 && doneAt === null) doneAt = t;
    if (v < 1) doneAt = null;
    const d = doneAt === null ? -1 : t - doneAt;
    const typing = v < 1;
    const moving = typing && !still;
    const u = t % LOOP;
    const hits = moving ? hitsFor(t) : [];

    // Un hochement par frappe, calé sur son bruitage : la tête plonge d'un
    // coup puis remonte en douceur.
    let lastHit = -1e9;
    for (const h of hits) {
      if (h.t > u) break;
      lastHit = h.t;
    }
    const since = u - lastHit;
    const bob = moving && since >= 0 && since < 220 ? 0.55 * (1 - since / 220) ** 2 : 0;
    const tg = !still && d >= 120 ? d - 120 : -1;
    const spark = tg < 0 ? 0 : tg < 160 ? tg / 160 : Math.max(0.35, 1 - (tg - 160) / 700);
    const gy = 56 + bob;
    const glow = moving ? 0.82 + 0.18 * hash(Math.floor(t / 90)) : 1;
    // Il code en thème sombre : les verres reflètent un éditeur sombre
    // pendant la frappe, et ne deviennent blancs qu'au « ting ».
    const dark = typing;

    const codeIn = (cx: number) => {
      if (!typing) return '';
      const tt = still ? 0 : t;
      const off = (tt / 45) % 3.2;
      let lines = '';
      for (let i = 0; i < 8; i++) {
        const y = gy - 10 + i * 3.2 - off;
        const w = 5 + hash(i + Math.floor(tt / 45 / 3.2) * 3) * 9;
        const color = CODE_COLORS[(i + Math.floor(tt / 144)) % CODE_COLORS.length];
        lines += `<rect x="${cx - 7 + (i % 3 === 1 ? 2 : 0)}" y="${f(y)}" width="${f(w)}" height="1.3" rx=".6" fill="${color}" opacity=".95"/>`;
      }
      return `<g clip-path="url(#lc-${id}-${cx})">${lines}</g>`;
    };

    const lens = (cx: number) =>
      `<clipPath id="lc-${id}-${cx}"><path d="${lensShape(cx, gy, 0.9)}"/></clipPath>` +
      `<ellipse cx="${cx}" cy="${f(gy)}" rx="${d >= 0 ? 17 : 14}" ry="${d >= 0 ? 15 : 12}" fill="${dark ? '#6f8fd8' : '#fff'}" opacity="${f2(glow * (d >= 0 ? 0.6 : 0.32))}" filter="url(#bl-${id})"/>` +
      `<path d="${lensShape(cx, gy)}" fill="${dark ? '#161a24' : '#fff'}" opacity="${dark ? 1 : f2(glow)}"${dark ? '' : ` filter="url(#gl-${id})"`}/>` +
      (dark
        ? `<path d="${lensShape(cx, gy)}" fill="#3a4a78" opacity="${f2(0.18 + 0.12 * glow)}"/>`
        : '') +
      codeIn(cx) +
      `<path d="${lensShape(cx, gy)}" fill="none" stroke="#211a29" stroke-width="2.3" stroke-linejoin="round"/>` +
      `<circle cx="${cx + (cx < 100 ? -8 : 8)}" cy="${f(gy - 5)}" r=".7" fill="#8a8f99"/>`;

    // Les traits des frappes, sur les côtés de l'ordinateur.
    let strokes = '';
    for (const h of hits) {
      if (h.t > u) break;
      const age = (u - h.t) / h.life;
      if (age > 1) continue;
      for (let j = 0; j < h.n; j++) {
        const a = ((h.rot - h.spread / 2 + (j * h.spread) / Math.max(1, h.n - 1)) * Math.PI) / 180;
        const r1 = 4 + age * 7;
        const r2 = r1 + h.len * (1 - age * 0.5);
        strokes += `<path d="M${f(h.x + h.dir * Math.cos(a) * r1)} ${f(h.y + Math.sin(a) * r1)} L${f(h.x + h.dir * Math.cos(a) * r2)} ${f(h.y + Math.sin(a) * r2)}" stroke="#efe4cf" stroke-width="${f(h.w)}" stroke-linecap="round" opacity="${f2(1 - age)}"/>`;
      }
    }

    // La goutte de sueur : une seule fois vers 70 %, elle glisse un peu puis reste.
    let sweat = '';
    if (sweatAt !== null) {
      const a = still ? 900 : t - sweatAt;
      const s = Math.min(1, a / 250);
      const y = 39 + 6 * (1 - (1 - Math.min(1, a / 900)) ** 3);
      sweat = `<path d="M127 ${f(y)} C129 ${f(y + 3)} 130 ${f(y + 6)} 127 ${f(y + 7)} C124 ${f(y + 6)} 125 ${f(y + 3)} 127 ${f(y)} Z" fill="#9ec9ff" stroke="#dfe9ff" stroke-width=".6" opacity="${f2(s)}"/>`;
    }

    // La lueur de l'écran qui vacille sur son visage.
    const flicker = moving
      ? `<ellipse cx="100" cy="72" rx="26" ry="22" fill="#7fb4ff" opacity="${(0.05 + 0.12 * hash(Math.floor(t / 110))).toFixed(3)}"/>`
      : '';

    // La tasse : trois volutes qui montent l'une après l'autre, ondulent de
    // plus en plus et s'effacent en haut.
    const tm = still ? 0 : t;
    const steam = [0, 1, 2]
      .map((i) => {
        const period = 2600;
        const p = ((tm + (i * period) / 3) % period) / period;
        const base = -1 - p * 9;
        const x0 = 2.5 + i * 3.5;
        const pts: string[] = [];
        for (let k = 0; k <= 8; k++) {
          const y = base - (k / 8) * 12;
          const amp = 0.6 + (-y / 24) * 3.2;
          pts.push(`${f2(x0 + Math.sin(-y * 0.42 + tm / 420 + i * 2.1) * amp)} ${f2(y)}`);
        }
        return `<path d="M${pts.join(' L')}" stroke="url(#sg-${id})" stroke-width="${f2(1.9 - p * 0.8)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(Math.sin(p * Math.PI))}"/>`;
      })
      .join('');
    const mug = `<g transform="translate(177 101)"><path d="M10 4 C17 4 17 12 10 12" stroke="#cbbd9f" stroke-width="2.4" fill="none"/><path d="M0 0 L12 0 L11 16 Q6 18 1 16 Z" fill="#efe4cf"/><rect x="0.6" y="1" width="10.8" height="2.2" fill="#5a3418"/>${steam}</g>`;

    // Le « ting ! » : une étincelle sur le verre gauche, dans la police de l'interface.
    const star = spark
      ? `<g transform="translate(77 ${f(gy - 7)}) scale(${f2(spark * 1.7)}) rotate(${f(tg / 12)})" opacity="${f2(Math.min(1, spark * 1.4))}"><path d="M0 -14 L2.2 -2.2 L14 0 L2.2 2.2 L0 14 L-2.2 2.2 L-14 0 L-2.2 -2.2 Z" fill="#fff" stroke="#9ec9ff" stroke-width=".8"/><path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#fff" stroke-width=".8" opacity=".7"/><circle r="3" fill="#fff"/></g>` +
        `<text x="40" y="40" style="${MONO}" font-size="13" fill="#fff8ea" opacity="${f2(Math.min(1, spark * 1.6))}" transform="rotate(-8 40 40)">ting !</text>`
      : '';

    const bar = 76 * Math.min(1, Math.max(0, v));
    const head =
      moving && v > 0 && v < 1
        ? `<rect x="${f(62 + bar - 3)}" y="129" width="6" height="5" rx="2.5" fill="#fff8ea" opacity=".35" filter="url(#bl-${id})"/>`
        : '';

    return (
      `<defs><filter id="bl-${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>` +
      `<filter id="gl-${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      `<radialGradient id="sl-${id}" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="#9ec9ff" stop-opacity=".3"/><stop offset="1" stop-color="#9ec9ff" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="sg-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-24"><stop offset="0" stop-color="#efe6d4" stop-opacity="0"/><stop offset=".2" stop-color="#efe6d4" stop-opacity=".75"/><stop offset=".7" stop-color="#efe6d4" stop-opacity=".35"/><stop offset="1" stop-color="#efe6d4" stop-opacity="0"/></linearGradient></defs>` +
      `<path d="M54 125 C56 102 74 96 100 96 C126 96 144 102 146 125 Z" fill="${HOOD}"/>` +
      `<path d="M84 98 C88 106 112 106 116 98" stroke="#2c3448" stroke-width="5" fill="none"/>` +
      `<rect x="93" y="84" width="14" height="14" fill="${SKIN_D}"/>` +
      `<g transform="translate(0 ${f2(bob)})">` +
      `<path d="M78 46 C78 30 88 26 100 26 C112 26 122 30 122 46 L122 64 C122 80 112 90 100 90 C88 90 78 80 78 64 Z" fill="${SKIN}"/>` +
      `<rect x="75" y="52" width="5" height="10" rx="2.5" fill="${SKIN_D}"/><rect x="120" y="52" width="5" height="10" rx="2.5" fill="${SKIN_D}"/>` +
      `<ellipse cx="100" cy="74" rx="24" ry="18" fill="url(#sl-${id})"/>${flicker}` +
      `<path d="M79 62 C80 78 88 90 100 90 C112 90 120 78 121 62 C118 72 112 76 108 75 C104 74 96 74 92 75 C88 76 82 72 79 62 Z" fill="${BEARD}" opacity=".62"/>` +
      `<path d="M100 62 L98 69 L101 69" stroke="${SKIN_D}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<path d="${HAIR_TUFTS}" fill="${HAIR}" stroke="${HAIR}" stroke-width="2.2" stroke-linejoin="round"/><path d="${HAIR_PATH}" fill="${HAIR}"/><path d="${HAIR_STROKES}" stroke="${HAIR_L}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<path d="M80 44.5 Q88 41.5 96 44.5 M104 44.5 Q112 41.5 120 44.5" stroke="${HAIR}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
      sweat +
      `</g>` +
      `<g transform="translate(0 ${f2(bob)})">${lens(88.5)}${lens(111.5)}<path d="M97.8 ${f(gy - 4.4)} Q100 ${f(gy - 5.8)} 102.2 ${f(gy - 4.4)}" stroke="#211a29" stroke-width="2" fill="none"/><path d="M79.2 ${f(gy - 4.1)} L75 ${f(gy - 4.6)} M120.8 ${f(gy - 4.1)} L125 ${f(gy - 4.6)}" stroke="#211a29" stroke-width="2.1"/></g>` +
      `<rect x="44" y="118" width="112" height="5" rx="2" fill="#4a5059"/>` +
      `<g transform="translate(0 68)"><path d="M52 0 L148 0 L150 50 L50 50 Z" fill="#3a3f46"/><path d="M52 0 L148 0" stroke="#7d8692" stroke-width="1.4"/></g>` +
      STICKER_LAYER +
      mug +
      strokes +
      star +
      `<rect x="62" y="130" width="76" height="3" rx="1.5" fill="#2a2620"/>` +
      `<rect x="62" y="130" width="${f(bar)}" height="3" rx="1.5" fill="#efe4cf"/>` +
      head
    );
  };
}

/** La première image (serveur et hydratation) : il tape, rien n'est chargé. */
export const INTRO_FIRST_FRAME = createDevScene('intro', { still: true })(0, 0);
