import { describe, expect, it } from 'vitest';
import { cameraProgress } from '../core/arrival';
import {
  ARRIVAL,
  HELD,
  REST,
  REST_FIT,
  SETTLE,
  START_L,
  START_P,
  type View,
} from '../core/constants';
import {
  arrivalPose,
  blendPose,
  cameraForView,
  cameraPosition,
  createPose,
  fitRestView,
  focusPoint,
  isPortrait,
  parallaxLevel,
  projectedBounds,
  screenFocusPose,
  startView,
} from './framing';

const FORMATS = {
  ordinateur: 1440 / 900,
  large: 2560 / 1080,
  tablette: 1024 / 1366,
  telephone: 390 / 844,
} as const;

const near = (a: number, b: number, precision = 5) => expect(a).toBeCloseTo(b, precision);

describe('fitRestView', () => {
  for (const [name, aspect] of Object.entries(FORMATS)) {
    it(`fait tenir le bureau dans le cadre (${name})`, () => {
      const view = fitRestView(aspect);
      const portrait = isPortrait(aspect);
      const { points, limits } = portrait ? REST_FIT.portrait : REST_FIT.landscape;
      const bounds = projectedBounds(points, cameraForView(view, aspect));
      expect(bounds.x0).toBeGreaterThanOrEqual(-limits.x - 1e-3);
      expect(bounds.x1).toBeLessThanOrEqual(limits.x + 1e-3);
      expect(bounds.y0).toBeGreaterThanOrEqual(limits.yBottom - 1e-3);
      expect(bounds.y1).toBeLessThanOrEqual(limits.yTop + 1e-3);
      // Et pas plus loin qu'il ne faut : un peu plus près, ça ne tient plus.
      const closer = cameraForView({ ...view, dist: view.dist * 0.97 }, aspect);
      const tight = projectedBounds(points, closer);
      const overflows =
        tight.x0 < -limits.x ||
        tight.x1 > limits.x ||
        tight.y0 < limits.yBottom ||
        tight.y1 > limits.yTop;
      expect(overflows).toBe(true);
    });
  }

  it('prend le cadrage portrait du prototype sous 0.9', () => {
    expect(isPortrait(0.89)).toBe(true);
    expect(isPortrait(0.9)).toBe(false);
    const phone = fitRestView(FORMATS.telephone);
    expect(phone.elev).toBe(REST.portrait.elev);
    expect(phone.fov).toBe(REST.portrait.fov);
    const desktop = fitRestView(FORMATS.ordinateur);
    expect(desktop.elev).toBe(REST.landscape.elev);
    expect(desktop.fov).toBe(REST.landscape.fov);
  });

  it('recule en portrait, où le bureau doit tenir dans la largeur', () => {
    expect(fitRestView(FORMATS.telephone).dist).toBeGreaterThan(
      fitRestView(FORMATS.ordinateur).dist,
    );
  });

  it('part de la vue de départ du bon format', () => {
    expect(startView(true)).toBe(START_P);
    expect(startView(false)).toBe(START_L);
  });
});

describe('arrivalPose', () => {
  const rest = fitRestView(FORMATS.ordinateur);
  const base = { start: START_L, rest, pointerX: 0, pointerY: 0, reduced: false };
  const expectedPosition = (view: View) =>
    cameraPosition(view.target, view.elev, view.az, view.dist);

  it('part de START, au ras du bureau, avec un léger recul', () => {
    const pose = arrivalPose({ ...base, t: 0, progress: cameraProgress(0) }, createPose());
    const start = expectedPosition({ ...START_L, dist: START_L.dist - ARRIVAL.cameraStart * 0.1 });
    near(pose.position.x, start.x);
    near(pose.position.y, start.y);
    near(pose.position.z, start.z);
    near(pose.fov, START_L.fov);
  });

  it('se pose sur la vue de repos en fin de montée', () => {
    const t = ARRIVAL.cameraEnd;
    // Le mouvement lent de fin d'arrivée ne s'est pas encore installé à 9 s.
    const pose = arrivalPose({ ...base, t: ARRIVAL.parallaxStart, progress: 1 }, createPose());
    const end = expectedPosition(rest);
    near(pose.position.x, end.x, 3);
    near(pose.position.y, end.y, 3);
    near(pose.position.z, end.z, 3);
    near(pose.fov, rest.fov);
    expect(cameraProgress(t)).toBe(1);
  });

  it('monte sans à-coup : la hauteur ne fait que croître', () => {
    let previous = -Infinity;
    for (let t = ARRIVAL.cameraStart; t <= ARRIVAL.cameraEnd; t += 0.1) {
      const pose = arrivalPose({ ...base, t, progress: cameraProgress(t) }, createPose());
      expect(pose.position.y).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = pose.position.y;
    }
  });

  it('suit doucement le pointeur une fois posée, jamais en mouvement réduit', () => {
    expect(parallaxLevel(ARRIVAL.parallaxStart, false)).toBe(0);
    expect(parallaxLevel(SETTLE + 1, false)).toBe(1);
    expect(parallaxLevel(SETTLE + 1, true)).toBe(0);
    const still = arrivalPose({ ...base, t: 20, progress: 1 }, createPose());
    const moved = arrivalPose({ ...base, t: 20, progress: 1, pointerX: 1 }, createPose());
    expect(moved.position.distanceTo(still.position)).toBeGreaterThan(0.1);
    expect(moved.position.distanceTo(still.position)).toBeLessThan(1);
    const reducedStill = arrivalPose({ ...base, t: 20, progress: 0, reduced: true }, createPose());
    const reducedMoved = arrivalPose(
      { ...base, t: 20, progress: 0, reduced: true, pointerX: 1, pointerY: -1 },
      createPose(),
    );
    expect(reducedMoved.position.distanceTo(reducedStill.position)).toBe(0);
  });

  it('en mouvement réduit, est déjà sur la vue de repos', () => {
    const pose = arrivalPose({ ...base, t: 0.5, progress: 0, reduced: true }, createPose());
    const end = expectedPosition(rest);
    near(pose.position.x, end.x, 3);
    near(pose.position.y, end.y, 3);
    near(pose.position.z, end.z, 3);
  });
});

describe('le gros plan sur l’écran', () => {
  it('regarde la dalle de face, de plus loin en portrait', () => {
    const wide = screenFocusPose(false);
    const tall = screenFocusPose(true);
    expect(wide.position.z).toBeGreaterThan(wide.target.z);
    expect(wide.position.distanceTo(wide.target)).toBeLessThan(
      tall.position.distanceTo(tall.target),
    );
  });

  it('se mélange à la pose courante', () => {
    const pose = createPose();
    const screen = screenFocusPose(false);
    blendPose(pose, screen, 1);
    near(pose.position.x, screen.position.x);
    near(pose.target.z, screen.target.z);
  });

  it('assombrit autour de l’objet tenu ou de la dalle', () => {
    expect(focusPoint(false, false)).toEqual([
      HELD.landscape.x * 0.5 + 0.5,
      HELD.landscape.y * 0.5 + 0.5,
    ]);
    expect(focusPoint(false, true)[1]).toBeGreaterThan(0.6);
    expect(focusPoint(true, false)[0]).toBeLessThan(0.5);
  });
});
