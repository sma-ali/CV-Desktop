import { describe, expect, it } from 'vitest';
import { BODY_FOOTPRINTS } from '../core/bodies';
import { ITEM_POSES } from '../core/constants';
import {
  CABLES,
  FACE,
  hash01,
  HOMELAB_SEED,
  homelabLeds,
  JACK,
  LED_OFF,
  ledLevel,
  portPoint,
  PORTS,
  portY,
  RACK,
  UNITS,
  type PortUnit,
} from './homelab';

/** L'état allumé ou éteint de chaque LED, image par image, sur une durée. */
function timeline(seed: number, from: number, to: number, step = 1 / 30): string {
  const leds = homelabLeds(seed);
  let out = '';
  for (let t = from; t < to; t += step) {
    out += leds.map((led) => (ledLevel(led, t, false) > 0.5 ? '1' : '0')).join('');
  }
  return out;
}

describe('la baie du Homelab', () => {
  it('tient dans son encombrement du plateau et sous son étiquette', () => {
    expect(RACK.w / 2).toBeLessThanOrEqual(BODY_FOOTPRINTS.homelab.hw);
    expect(RACK.d / 2).toBeLessThanOrEqual(BODY_FOOTPRINTS.homelab.hd);
    expect(RACK.h).toBeLessThan(ITEM_POSES.homelab.tag?.y ?? 0);
  });

  it('empile ses équipements sans chevauchement, dans la façade', () => {
    for (let i = 0; i < UNITS.length; i++) {
      const unit = UNITS[i]!;
      expect(unit.y1).toBeGreaterThan(unit.y0);
      expect(unit.y0).toBeGreaterThanOrEqual(FACE.y0);
      expect(unit.y1).toBeLessThanOrEqual(FACE.y1);
      const next = UNITS[i + 1];
      if (next) expect(next.y0).toBeGreaterThanOrEqual(unit.y1);
    }
    expect(UNITS.map((unit) => unit.id)).toEqual(['server', 'firewall', 'switch', 'patch']);
  });

  it('pose ses LED sur la façade des équipements', () => {
    for (const led of homelabLeds()) {
      const unit = UNITS.find((candidate) => candidate.id === led.unit)!;
      expect(led.x).toBeGreaterThan(FACE.x0);
      expect(led.x).toBeLessThan(FACE.x1);
      expect(led.y).toBeGreaterThan(unit.y0);
      expect(led.y).toBeLessThan(unit.y1);
    }
  });
});

describe('les LED de la baie', () => {
  it('clignotent toujours de la même façon pour une même graine', () => {
    expect(homelabLeds(HOMELAB_SEED)).toEqual(homelabLeds(HOMELAB_SEED));
    expect(timeline(HOMELAB_SEED, 11, 15)).toBe(timeline(HOMELAB_SEED, 11, 15));
    expect(timeline(HOMELAB_SEED, 11, 15)).not.toBe(timeline(HOMELAB_SEED + 1, 11, 15));
  });

  it('ne dépendent que de T : figées quand l’horloge l’est', () => {
    const leds = homelabLeds();
    const frozen = leds.map((led) => ledLevel(led, 11, false));
    expect(leds.map((led) => ledLevel(led, 11, false))).toEqual(frozen);
  });

  it('clignotent vraiment : l’activité s’allume et s’éteint, l’alimentation reste allumée', () => {
    const leds = homelabLeds();
    for (const led of leds) {
      const levels = new Set<number>();
      for (let t = 10; t < 20; t += 0.05) levels.add(ledLevel(led, t, false));
      if (led.kind === 'power') expect([...levels]).toEqual([1]);
      if (led.kind === 'activity') expect([...levels].sort()).toEqual([LED_OFF, 1]);
      if (led.kind === 'idle') expect([...levels]).toEqual([LED_OFF]);
    }
    expect(leds.filter((led) => led.kind === 'activity').length).toBeGreaterThanOrEqual(6);
  });

  it('ne clignotent pas en mouvement réduit', () => {
    for (const led of homelabLeds()) {
      const levels = new Set<number>();
      for (let t = 10; t < 20; t += 0.05) levels.add(ledLevel(led, t, true));
      expect(levels.size).toBe(1);
      if (led.kind === 'idle') expect([...levels][0]).toBe(LED_OFF);
      else expect([...levels][0]).toBeGreaterThan(0.5);
    }
  });

  it('tirent des valeurs réparties entre 0 et 1', () => {
    const draws = Array.from({ length: 2000 }, (_, i) => hash01(i, 12345));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...draws)).toBeLessThan(1);
    const mean = draws.reduce((sum, v) => sum + v, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('le brassage de la baie', () => {
  const units: PortUnit[] = ['switch', 'firewall', 'patch'];

  it('place chaque prise sur la façade de son équipement, sans chevauchement', () => {
    for (const id of units) {
      const unit = UNITS.find((candidate) => candidate.id === id)!;
      const [width, height] = JACK[id];
      expect(portY(id) - height / 2).toBeGreaterThan(unit.y0);
      expect(portY(id) + height / 2).toBeLessThan(unit.y1);
      const xs = PORTS[id];
      xs.forEach((x, i) => {
        expect(x - width / 2).toBeGreaterThan(FACE.x0);
        expect(x + width / 2).toBeLessThan(FACE.x1);
        const next = xs[i + 1];
        if (next !== undefined) expect(next - x).toBeGreaterThan(width);
      });
    }
  });

  it('branche chaque câble dans une vraie prise, jamais deux dans la même', () => {
    const used = new Set<string>();
    for (const cable of CABLES) {
      for (const end of [cable.from, cable.to]) {
        expect(PORTS[end.unit][end.index]).toBeDefined();
        const key = `${end.unit}:${end.index}`;
        expect(used.has(key)).toBe(false);
        used.add(key);
        const [x, y] = portPoint(end);
        expect(x).toBe(PORTS[end.unit][end.index]);
        expect(y).toBe(portY(end.unit));
      }
    }
  });

  it("n'allume que les ports du switch où un câble est branché", () => {
    const wired = new Set(
      CABLES.flatMap((cable) => [cable.from, cable.to])
        .filter((end) => end.unit === 'switch')
        .map((end) => PORTS.switch[end.index]),
    );
    const portLeds = homelabLeds().filter(
      (led) => led.unit === 'switch' && led.kind !== 'power',
    );
    expect(portLeds).toHaveLength(PORTS.switch.length);
    for (const led of portLeds) {
      expect(led.kind).toBe(wired.has(led.x) ? 'activity' : 'idle');
    }
  });
});
