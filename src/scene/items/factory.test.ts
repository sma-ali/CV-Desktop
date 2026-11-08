import { describe, expect, it } from 'vitest';
import {
  armAngles,
  beltLap,
  cardAt,
  CARDS,
  isStamped,
  nearStation,
  stationLevel,
  STATIONS,
} from './factory';

const calm = { period: 3.4, strength: 0.35 };
const busy = { period: 1.6, strength: 1 };

describe('le tapis roulant', () => {
  it('tourne plus vite quand l’usine est active', () => {
    expect(beltLap(busy)).toBeLessThan(beltLap(calm));
    expect(beltLap(calm)).toBe(7);
    expect(beltLap(busy)).toBe(4);
  });

  it('espace régulièrement les cartes et les fait boucler', () => {
    const positions = Array.from({ length: CARDS }, (_, i) => cardAt(0, i, calm));
    expect(positions).toEqual([0, 0.25, 0.5, 0.75]);
    for (let t = 0; t < 20; t += 0.37) {
      const u = cardAt(t, 1, busy);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    expect(cardAt(beltLap(calm), 0, calm)).toBeCloseTo(0);
  });

  it('allume un poste quand une carte passe dessous, seulement', () => {
    expect(nearStation(STATIONS.scan, STATIONS.scan)).toBe(1);
    expect(nearStation(STATIONS.scan + 0.2, STATIONS.scan)).toBe(0);
    expect(stationLevel([0.1, STATIONS.stamp], STATIONS.stamp)).toBe(1);
    expect(stationLevel([0.1, 0.9], STATIONS.stamp)).toBe(0);
  });

  it('passe le scanner avant le tampon, et tamponne après le bras', () => {
    expect(STATIONS.scan).toBeLessThan(STATIONS.stamp);
    expect(isStamped(STATIONS.stamp - 0.01)).toBe(false);
    expect(isStamped(STATIONS.stamp + 0.01)).toBe(true);
  });

  it('pose le bout du bras sur le point visé', () => {
    const upper = 0.32;
    const lower = 0.3;
    for (const [dz, dy] of [
      [0.38, 0.16],
      [0.38, 0.02],
      [0.3, -0.05],
    ] as const) {
      const { shoulder, elbow } = armAngles(dz, dy, upper, lower);
      const z = upper * Math.cos(shoulder) + lower * Math.cos(elbow);
      const y = upper * Math.sin(shoulder) + lower * Math.sin(elbow);
      expect(z).toBeCloseTo(dz, 5);
      expect(y).toBeCloseTo(dy, 5);
      // Coude vers le haut : il passe au-dessus de la droite épaule-bout.
      expect(shoulder).toBeGreaterThan(Math.atan2(dy, dz));
    }
  });
});
