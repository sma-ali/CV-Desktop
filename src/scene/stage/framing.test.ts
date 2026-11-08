import { describe, expect, it } from 'vitest';
import { cameraProgress } from '../core/arrival';
import { bodyObb, FOOTPRINT_IDS, homePlace } from '../core/bodies';
import { decorExtentPortrait } from '../decor/obstacles';
import { ARRIVAL, SETTLE } from '../core/constants';
import { HELD, PORTRAIT_HUD, REST, REST_FIT, START_L, START_P, type View } from '../core/views';
import {
  arrivalPose,
  blendPose,
  BODY_HEIGHTS,
  bodyExtent,
  cameraForView,
  cameraPosition,
  createPose,
  deskExtent,
  FIXED_EXTENT,
  fixedExtent,
  fitRestView,
  focusPoint,
  isPortrait,
  parallaxLevel,
  projectedBounds,
  restLimits,
  restPoints,
  screenFocusPose,
  screenShare,
  startView,
} from './framing';

const FORMATS = {
  ordinateur: 1440 / 900,
  large: 2560 / 1080,
  tablette: 1024 / 1366,
  telephone: 390 / 844,
} as const;

/** Des fenêtres réelles, en pixels CSS : téléphones, tablettes, ordinateurs. */
const SIZES = {
  'iPhone 12 à 15 (390x844)': [390, 844],
  'petit Android (360x740)': [360, 740],
  'grand Android (412x915)': [412, 915],
  'Pixel 7 (412x839)': [412, 839],
  'iPhone SE (375x667)': [375, 667],
  'iPhone Pro Max (430x932)': [430, 932],
  'téléphone en paysage (844x390)': [844, 390],
  'petit téléphone en paysage (740x360)': [740, 360],
  'tablette en portrait (768x1024)': [768, 1024],
  'tablette en paysage (1024x768)': [1024, 768],
  'ordinateur (1440x900)': [1440, 900],
  'ordinateur (1280x720)': [1280, 720],
  'grand écran (1920x1080)': [1920, 1080],
  'écran large (2560x1080)': [2560, 1080],
} as const satisfies Record<string, readonly [number, number]>;

const near = (a: number, b: number, precision = 5) => expect(a).toBeCloseTo(b, precision);

/** Les bornes à l'écran du bureau utile, vu de la vue de repos d'une fenêtre. */
function restBounds(width: number, height: number) {
  const aspect = width / height;
  const portrait = isPortrait(aspect);
  const view = fitRestView(aspect, { width, height });
  const camera = cameraForView(view, aspect);
  return {
    portrait,
    view,
    camera,
    limits: restLimits(portrait, { width, height }),
    desk: projectedBounds(deskExtent(portrait), camera),
    all: projectedBounds(restPoints(portrait), camera),
  };
}

describe('fitRestView', () => {
  for (const [name, aspect] of Object.entries(FORMATS)) {
    it(`fait tenir le bureau dans le cadre (${name})`, () => {
      const view = fitRestView(aspect);
      const portrait = isPortrait(aspect);
      const points = restPoints(portrait);
      const limits = restLimits(portrait);
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

  for (const [name, [width, height]] of Object.entries(SIZES)) {
    it(`ne laisse aucun encombrement hors du cadre (${name})`, () => {
      const { desk, all, limits } = restBounds(width, height);
      // Le bureau utile entier est dans la fenêtre...
      expect(desk.x0).toBeGreaterThanOrEqual(-1);
      expect(desk.x1).toBeLessThanOrEqual(1);
      expect(desk.y0).toBeGreaterThanOrEqual(-1);
      expect(desk.y1).toBeLessThanOrEqual(1);
      // ... et entre les bandes du HUD.
      expect(all.x0).toBeGreaterThanOrEqual(-limits.x - 1e-3);
      expect(all.x1).toBeLessThanOrEqual(limits.x + 1e-3);
      expect(all.y0).toBeGreaterThanOrEqual(limits.yBottom - 1e-3);
      expect(all.y1).toBeLessThanOrEqual(limits.yTop + 1e-3);
    });
  }

  it('en portrait, pose le bureau sur le HUD du bas, sur toute la largeur', () => {
    for (const [width, height] of [
      [390, 844],
      [360, 740],
      [412, 915],
    ] as const) {
      const { portrait, desk, all, limits } = restBounds(width, height);
      expect(portrait).toBe(true);
      // Pas de bande vide sous le bureau : son bord avant touche le HUD du bas.
      near(desk.y0, limits.yBottom, 2);
      // Le plateau resserré occupe toute la largeur : c'est elle qui fixe la distance.
      expect(Math.max(-all.x0, all.x1)).toBeGreaterThan(limits.x - 0.02);
      expect(Math.min(-desk.x0, desk.x1)).toBeGreaterThan(0.85);
    }
  });

  it('en portrait, garde la place du HUD en pixels, quelle que soit la hauteur', () => {
    const small = restLimits(true, { width: 360, height: 740 });
    const tall = restLimits(true, { width: 412, height: 915 });
    near(((1 - small.yTop) / 2) * 740, PORTRAIT_HUD.top);
    near(((small.yBottom + 1) / 2) * 740, PORTRAIT_HUD.bottom);
    near(((tall.yBottom + 1) / 2) * 915, PORTRAIT_HUD.bottom);
    // En paysage, ou sans taille connue, les limites fixes de REST_FIT.
    expect(restLimits(false, { width: 844, height: 390 })).toBe(REST_FIT.landscape.limits);
    expect(restLimits(true)).toBe(REST_FIT.portrait.limits);
  });

  it('prend le cadrage portrait sous 0.9', () => {
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

describe('le bureau utile', () => {
  it('compte les huit coins de chaque corps, au ras du plateau et à sa hauteur', () => {
    const points = bodyExtent('chest', homePlace('chest', false));
    expect(points).toHaveLength(8);
    expect(points.filter(([, y]) => y === 0)).toHaveLength(4);
    expect(points.filter(([, y]) => y === BODY_HEIGHTS.chest)).toHaveLength(4);
    // Le rectangle suit la rotation et le décalage du coffret (bodies.ts).
    const xs = points.map(([x]) => x);
    const zs = points.map(([, , z]) => z);
    const box = bodyObb('chest', homePlace('chest', false));
    near((Math.min(...xs) + Math.max(...xs)) / 2, box.x);
    near((Math.min(...zs) + Math.max(...zs)) / 2, box.z);
  });

  it('comprend chaque corps du plateau, le bord gauche et la lampe', () => {
    const points = deskExtent(false);
    expect(points).toHaveLength(
      FOOTPRINT_IDS.length * 8 +
        Object.values(FIXED_EXTENT).reduce((n, list) => n + list.length, 0),
    );
    expect(Object.keys(FIXED_EXTENT).sort()).toEqual(['edge', 'headset', 'lamp', 'monitor']);
    // Le bord gauche (le pendule de Newton) est le point le plus à gauche.
    const left = Math.min(...points.map(([x]) => x));
    expect(left).toBeLessThan(-6.1);
    expect(Math.min(...FIXED_EXTENT.edge.map(([x]) => x))).toBe(left);
  });
});

describe('le bureau resserré du portrait', () => {
  /**
   * Part minimale de la hauteur libre (entre les bandes du HUD) que couvre le
   * bureau. Il est limité par la largeur : la hauteur libre est plus grande
   * que ce qu'il lui faut (0.64 en 412x915).
   */
  const SHARE = 0.62;
  const PORTRAITS = Object.entries(SIZES).filter(([, [width, height]]) =>
    isPortrait(width / height),
  );

  it('compte sept portraits, six téléphones et une tablette', () => {
    expect(PORTRAITS).toHaveLength(7);
  });

  for (const [name, [width, height]] of PORTRAITS) {
    it(`remplit la hauteur libre, sans bande de mur vide (${name})`, () => {
      const { camera, limits } = restBounds(width, height);
      // Avant le bureau resserré : 0.41 en 390x844, 0.47 en 360x740, 0.38 en 412x915.
      expect(screenShare(deskExtent(true), camera, limits)).toBeGreaterThan(SHARE);
    });

    it(`garde le décor du portrait dans le cadre (${name})`, () => {
      const { camera, limits } = restBounds(width, height);
      const decor = projectedBounds(decorExtentPortrait(), camera);
      expect(decor.x0).toBeGreaterThanOrEqual(-limits.x - 1e-3);
      expect(decor.x1).toBeLessThanOrEqual(limits.x + 1e-3);
      expect(decor.y0).toBeGreaterThanOrEqual(limits.yBottom - 1e-3);
      expect(decor.y1).toBeLessThanOrEqual(limits.yTop + 1e-3);
    });
  }

  it('mesure une part de 1 d’une bande du HUD à l’autre', () => {
    const { camera, limits } = restBounds(390, 844);
    const share = screenShare(deskExtent(true), camera, limits);
    expect(share).toBeGreaterThan(0.66);
    expect(share).toBeLessThanOrEqual(1 + 1e-3);
  });

  it('déplace la lampe et le casque, sans bord gauche, et rien en paysage', () => {
    expect(fixedExtent(false)).toBe(FIXED_EXTENT);
    const portrait = fixedExtent(true);
    expect(portrait.edge).toEqual([]);
    expect(portrait.monitor).toEqual(FIXED_EXTENT.monitor);
    expect(portrait.lamp[0]).not.toEqual(FIXED_EXTENT.lamp[0]);
    expect(portrait.headset[0]![0]).toBeGreaterThan(2.8);
    // Le décor ne se cadre qu'en portrait.
    expect(restPoints(false)).toHaveLength(
      REST_FIT.landscape.points.length + deskExtent(false).length,
    );
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
