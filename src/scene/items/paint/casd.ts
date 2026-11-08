import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../../core/canvas2d';
import { type Painter, scaled } from './common';

// Le dessus du boîtier d'accès au CASD : à gauche le capteur d'empreinte,
// à droite le clavier du code, et le nom du boîtier. Les trois facteurs
// de l'authentification (la carte est dans sa fente, en façade).

/** Le dessus du boîtier (TOP de Casd.tsx), aux proportions du plan. */
export const CASD_TOP_TEXTURE = { width: 600, height: 400 } as const;

export function paintCasdTop(scene: SceneContent): Painter {
  const { device } = scene.casd;
  return scaled(600, (c, w, h, F) => {
    // Le plastique graphite, un peu grenu.
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3c4045');
    g.addColorStop(1, '#2a2d31');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 41, 900, 0.08);
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 3;
    roundRect(c, 12, 12, w - 24, h - 24, 22);
    c.stroke();

    // Le capteur d'empreinte : une alvéole sombre cerclée de vert.
    const fx = 150;
    const fy = 185;
    c.fillStyle = '#15171a';
    roundRect(c, fx - 78, fy - 92, 156, 184, 34);
    c.fill();
    c.strokeStyle = '#5fd18a';
    c.lineWidth = 5;
    roundRect(c, fx - 70, fy - 84, 140, 168, 28);
    c.stroke();
    c.strokeStyle = 'rgba(150,230,180,.55)';
    c.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const rx = 12 + k * 9;
      const ry = 18 + k * 11;
      c.beginPath();
      c.ellipse(fx, fy + 6, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92 + k * 0.06);
      c.stroke();
    }

    // Le clavier du code : 3 x 4 touches.
    const kx = 330;
    const ky = 92;
    const key = 46;
    const gap = 12;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const x = kx + col * (key + gap);
        const y = ky + row * (key + gap);
        c.fillStyle = '#4a4f55';
        roundRect(c, x, y + 4, key, key, 9);
        c.fill();
        c.fillStyle = '#6a7077';
        roundRect(c, x, y, key, key, 9);
        c.fill();
      }
    }
    c.fillStyle = '#d9dde2';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `600 24px ${F.mono}`;
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].forEach((label, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      c.fillText(label, kx + col * (key + gap) + key / 2, ky + row * (key + gap) + key / 2 + 1);
    });

    // Le nom du boîtier, sous le clavier.
    c.fillStyle = '#c9ced4';
    c.textBaseline = 'alphabetic';
    fitFont(c, device, 200, 34, 700, F.mono);
    c.fillText(device, kx + (3 * key + 2 * gap) / 2, h - 42);
  });
}
