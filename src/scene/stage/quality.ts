// La qualité adaptative (perf() du prototype), en machine pure et testée :
// si les images sont lentes en moyenne, on baisse d'un cran, deux fois au
// plus. Cran 1 : densité de pixels à 1, plus d'ombres. Cran 2 : densité de
// pixels à 0.8, plus de bloom.

/** Images mesurées avant chaque décision. */
export const QUALITY_WINDOW = 90;

/** Au-delà de cette durée moyenne d'image (environ 34 images par seconde), on baisse. */
export const QUALITY_SLOW_FRAME = 1 / 34;

/** Pas de mesure pendant les deux premières secondes (compilation des shaders). */
export const QUALITY_WARMUP = 2;

export type QualityLevel = 0 | 1 | 2;

export interface QualityMonitor {
  level: QualityLevel;
  frames: number;
  total: number;
}

export const createQualityMonitor = (): QualityMonitor => ({ level: 0, frames: 0, total: 0 });

/**
 * Compte une image ; renvoie le nouveau cran quand il faut baisser, sinon
 * null. Pas de mesure quand l'horloge est gelée (captures).
 */
export function sampleQuality(
  monitor: QualityMonitor,
  dt: number,
  t: number,
  frozen: boolean,
): QualityLevel | null {
  if (frozen || monitor.level >= 2 || t < QUALITY_WARMUP) return null;
  monitor.total += dt;
  monitor.frames += 1;
  if (monitor.frames < QUALITY_WINDOW) return null;
  const average = monitor.total / monitor.frames;
  monitor.total = 0;
  monitor.frames = 0;
  if (average <= QUALITY_SLOW_FRAME) return null;
  monitor.level = monitor.level === 0 ? 1 : 2;
  return monitor.level;
}

/** Ce que chaque cran garde. */
export function qualitySettings(level: QualityLevel) {
  return {
    dpr: level === 0 ? null : level === 1 ? 1 : 0.8,
    shadows: level === 0,
    bloom: level < 2,
  } as const;
}
