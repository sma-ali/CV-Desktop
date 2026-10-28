import { describe, expect, it } from 'vitest';
import {
  createQualityMonitor,
  QUALITY_SLOW_FRAME,
  QUALITY_WARMUP,
  QUALITY_WINDOW,
  qualitySettings,
  sampleQuality,
} from './quality';

/** Fait passer n images de durée dt ; renvoie les changements de cran. */
function run(n: number, dt: number, { t = QUALITY_WARMUP + 1, frozen = false } = {}) {
  const monitor = createQualityMonitor();
  const changes: number[] = [];
  for (let i = 0; i < n; i++) {
    const level = sampleQuality(monitor, dt, t + i * dt, frozen);
    if (level !== null) changes.push(level);
  }
  return { monitor, changes };
}

describe('la qualité adaptative', () => {
  it('ne bouge pas quand les images sont rapides', () => {
    expect(run(QUALITY_WINDOW * 5, 1 / 60).changes).toEqual([]);
  });

  it('baisse d’un cran par fenêtre lente, deux fois au plus', () => {
    const slow = QUALITY_SLOW_FRAME * 2;
    expect(run(QUALITY_WINDOW - 1, slow).changes).toEqual([]);
    expect(run(QUALITY_WINDOW, slow).changes).toEqual([1]);
    expect(run(QUALITY_WINDOW * 5, slow).changes).toEqual([1, 2]);
  });

  it('ne mesure ni pendant le démarrage, ni horloge gelée', () => {
    const slow = QUALITY_SLOW_FRAME * 2;
    expect(run(QUALITY_WINDOW * 3, slow, { frozen: true }).changes).toEqual([]);
    const monitor = createQualityMonitor();
    for (let i = 0; i < QUALITY_WINDOW * 3; i++) sampleQuality(monitor, slow, 0.5, false);
    expect(monitor.level).toBe(0);
  });

  it('coupe d’abord la densité de pixels et les ombres, puis le bloom', () => {
    expect(qualitySettings(0)).toEqual({ dpr: null, shadows: true, bloom: true });
    expect(qualitySettings(1)).toEqual({ dpr: 1, shadows: false, bloom: true });
    expect(qualitySettings(2)).toEqual({ dpr: 0.8, shadows: false, bloom: false });
  });
});
