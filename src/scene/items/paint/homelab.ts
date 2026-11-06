import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../../core/canvas2d';
import { FACE, homelabLeds, JACK, PORTS, portY, UNITS, type UnitId } from '../homelab';
import type { Ctx, Painter } from './common';

// Homelab : la façade de la baie, son dessus et son dos

/** La façade des équipements (FACE de homelab.ts), aux proportions du plan. */
export const HOMELAB_FACE = { width: 640, height: 556 } as const;

/** Passe d'un point de la façade (repère de l'objet) aux pixels de la texture. */
function facePx(x: number, y: number, w: number, h: number): [number, number] {
  return [((x - FACE.x0) / (FACE.x1 - FACE.x0)) * w, ((FACE.y1 - y) / (FACE.y1 - FACE.y0)) * h];
}

/** Une prise RJ45 vue de face, centrée en (x, y) (pixels), large de size. */
function rj45(c: Ctx, x: number, y: number, size: number) {
  c.fillStyle = '#0b0c0d';
  c.fillRect(x - size / 2, y - size * 0.38, size, size * 0.76);
  c.fillRect(x - size * 0.22, y + size * 0.38, size * 0.44, size * 0.14);
  c.fillStyle = '#c9a54a';
  for (let k = 0; k < 4; k++) c.fillRect(x - size * 0.3 + k * size * 0.18, y - size * 0.3, 2, 5);
}

export function paintHomelabFront(scene: SceneContent): Painter {
  const { units } = scene.homelab;
  const names: Partial<Record<UnitId, string>> = {
    server: units.server,
    firewall: units.firewall,
  };
  const leds = homelabLeds();
  return (c, w, h, F) => {
    c.fillStyle = '#101113';
    c.fillRect(0, 0, w, h);
    for (const unit of UNITS) {
      const [, top] = facePx(0, unit.y1, w, h);
      const [, bottom] = facePx(0, unit.y0, w, h);
      const uh = bottom - top;
      const face = c.createLinearGradient(0, top, 0, bottom);
      face.addColorStop(0, unit.id === 'patch' ? '#2c2f33' : '#4a4e55');
      face.addColorStop(1, unit.id === 'patch' ? '#1e2023' : '#33363b');
      c.fillStyle = face;
      c.fillRect(4, top, w - 8, uh);
      c.fillStyle = 'rgba(255,255,255,.12)';
      c.fillRect(4, top, w - 8, 2);
      // Les vis des oreilles de fixation.
      c.fillStyle = '#8d9197';
      for (const sx of [14, w - 14]) {
        c.beginPath();
        c.arc(sx, top + uh / 2, 4, 0, 7);
        c.fill();
      }
      const cy = top + uh / 2;
      if (unit.id === 'server') {
        // Quatre baies de disques, puis des ouïes d'aération.
        for (let k = 0; k < 4; k++) {
          const bx = 92 + k * 88;
          c.fillStyle = '#1d1f22';
          c.fillRect(bx, top + 22, 78, uh - 44);
          c.fillStyle = '#5a5e65';
          c.fillRect(bx + 6, top + 30, 66, 10);
          c.fillStyle = '#2a2c30';
          for (let r = 0; r < 6; r++) c.fillRect(bx + 10, top + 56 + r * 20, 58, 6);
        }
        c.fillStyle = '#16181a';
        for (let r = 0; r < 7; r++) {
          for (let k = 0; k < 5; k++) c.fillRect(470 + k * 30, top + 30 + r * 22, 20, 9);
        }
      } else if (unit.id === 'firewall' || unit.id === 'switch') {
        // Les prises, là où les câbles se branchent (homelab.ts : PORTS, portY).
        const jackWidth = (JACK[unit.id][0] / (FACE.x1 - FACE.x0)) * w;
        for (const x of PORTS[unit.id]) {
          const [px, py] = facePx(x, portY(unit.id), w, h);
          rj45(c, px, py, jackWidth);
        }
      } else {
        // Le panneau de brassage : douze prises numérotées.
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `500 11px ${F.mono}`;
        const [jw, jh] = JACK.patch.map((size) => (size / (FACE.x1 - FACE.x0)) * w) as [
          number,
          number,
        ];
        PORTS.patch.forEach((x, k) => {
          const [px, py] = facePx(x, portY('patch'), w, h);
          c.fillStyle = '#0b0c0d';
          c.fillRect(px - jw / 2, py - jh / 2, jw, jh);
          c.fillStyle = '#9aa0a6';
          c.fillText(String(k + 1), px, py - jh / 2 - 12);
        });
      }
      const name = names[unit.id];
      if (name) {
        c.fillStyle = '#e8e2d4';
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        const x = unit.id === 'server' ? 92 : 64;
        const y = unit.id === 'server' ? bottom - 6 : cy + 8;
        fitFont(
          c,
          name,
          unit.id === 'server' ? 340 : 150,
          unit.id === 'server' ? 18 : 22,
          600,
          F.mono,
        );
        if (unit.id === 'server') c.fillText(name, x, y);
        else c.fillText(name, x + 20, y);
      }
    }
    // Les logements des LED (les LED elles-mêmes sont des maillages qui luisent).
    for (const led of leds) {
      const [px, py] = facePx(led.x, led.y, w, h);
      c.fillStyle = '#060606';
      c.beginPath();
      c.arc(px, py, 7, 0, 7);
      c.fill();
    }
  };
}

/** Le dessus de la baie, vu d'en haut : tôle perforée et le nom gravé à l'avant. */
export const HOMELAB_TOP = { width: 640, height: 508 } as const;

export function paintHomelabTop(scene: SceneContent): Painter {
  const { name } = scene.homelab;
  return (c, w, h, F) => {
    c.fillStyle = '#3d4046';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 63, 3000, 0.05);
    c.fillStyle = '#1b1c1f';
    for (let r = 0; r < 9; r++) {
      for (let k = 0; k < 16; k++) {
        c.beginPath();
        c.arc(96 + k * 30, 54 + r * 26, 6, 0, 7);
        c.fill();
      }
    }
    // Le haut de la texture regarde le mur : le nom est en bas, côté visiteur.
    c.fillStyle = '#d9d2c3';
    roundRect(c, 120, h - 170, w - 240, 120, 10);
    c.fill();
    c.strokeStyle = '#7d6c58';
    c.lineWidth = 3;
    roundRect(c, 132, h - 158, w - 264, 96, 6);
    c.stroke();
    c.fillStyle = '#2a2724';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitFont(c, name, w - 300, 64, 700, F.serif);
    c.fillText(name, w / 2, h - 108);
  };
}

/** Le dos de la baie (retournée) : le nom, puis trois étiquettes à pictogramme. */
export const HOMELAB_BACK = { width: 640, height: 556 } as const;

type Pictogram = 'server' | 'firewall' | 'access';

function pictogram(c: Ctx, kind: Pictogram, x: number, y: number, size: number) {
  c.strokeStyle = '#2a2724';
  c.fillStyle = '#2a2724';
  c.lineWidth = 4;
  c.lineJoin = 'round';
  const s = size;
  if (kind === 'server') {
    for (let k = 0; k < 3; k++) {
      roundRect(c, x - s / 2, y - s / 2 + k * (s / 3), s, s / 3 - 5, 4);
      c.stroke();
      c.beginPath();
      c.arc(x + s / 2 - 10, y - s / 2 + k * (s / 3) + s / 6 - 2, 3, 0, 7);
      c.fill();
    }
  } else if (kind === 'firewall') {
    // Un mur de briques.
    const rows = 3;
    const bh = s / rows;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? s / 4 : 0;
      for (let k = -1; k < 2; k++) {
        const bx = x - s / 2 + offset + k * (s / 2);
        const left = Math.max(x - s / 2, bx);
        const right = Math.min(x + s / 2, bx + s / 2);
        if (right - left > 4) c.strokeRect(left, y - s / 2 + r * bh, right - left, bh);
      }
    }
  } else {
    // Un cadenas : l'accès.
    c.beginPath();
    c.arc(x, y - s * 0.12, s * 0.24, Math.PI, 0);
    c.stroke();
    roundRect(c, x - s * 0.36, y - s * 0.12, s * 0.72, s * 0.56, 6);
    c.fill();
    c.fillStyle = '#efe4cc';
    c.beginPath();
    c.arc(x, y + s * 0.12, 5, 0, 7);
    c.fill();
  }
}

export function paintHomelabBack(scene: SceneContent): Painter {
  const { name, units, access } = scene.homelab;
  const rows: [Pictogram, string][] = [
    ['server', units.server],
    ['firewall', units.firewall],
    ['access', access],
  ];
  return (c, w, h, F) => {
    c.fillStyle = '#2b2e33';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 71, 2500, 0.05);
    // Les ouïes du dos.
    c.fillStyle = '#17181b';
    for (let r = 0; r < 4; r++) c.fillRect(40, 40 + r * 20, w - 80, 8);
    c.fillStyle = '#e8e2d4';
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    fitFont(c, name, w - 120, 64, 700, F.serif);
    c.fillText(name, 60, 182);
    rows.forEach(([kind, label], i) => {
      const y = 214 + i * 104;
      c.save();
      c.translate(60, y);
      c.rotate((i - 1) * 0.012);
      c.fillStyle = '#efe4cc';
      roundRect(c, 0, 0, w - 120, 86, 6);
      c.fill();
      c.restore();
      pictogram(c, kind, 112, y + 43, 52);
      c.fillStyle = '#2a2724';
      fitFont(c, label, w - 300, 40, 600, F.mono);
      c.fillText(label, 170, y + 57);
    });
  };
}
