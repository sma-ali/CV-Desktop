import { homePose, setHomePose, type DeskBodies, type DeskPose } from '../core/bodies';
import { BODY_IDS, type BodyId } from '../core/ids';
import { rng } from '../core/rng';
import type { PhysicsControl } from '../core/physicsControl';
import { tiltOf } from './disorder';
import { DESK, DESK_PORTRAIT_Z1, DESK_THICKNESS } from '../core/constants';
import {
  deskExit,
  easeInOut,
  flightPose,
  type DeskArea,
  type FlightPose,
  type FullPose,
} from './flight';
import { bottomOf, occupiedHeight, reachOf } from './reach';

/** Le plateau du format, pour deskExit. */
const deskArea = (portrait: boolean): DeskArea => ({
  x0: DESK.x0,
  x1: DESK.x1,
  z0: DESK.z0,
  z1: portrait ? DESK_PORTRAIT_Z1 : DESK.z1,
  under: -DESK_THICKNESS,
});

// Le metteur en ordre du bureau, sans React ni
// three : il reçoit le monde physique par PhysicsControl et les poses par
// store.desk, et se teste en Node avec le vrai Rapier (director.test.ts).
//
// - Un corps tombé du plateau y reste FALL_RETURN.delay secondes, puis
//   rentre en douceur : repris en main (takeOver), conduit le long d'un
//   arc (drive) jusqu'un peu au-dessus de sa place, puis lâché (handBack)
//   pour qu'il s'y pose de lui-même. Si sa place est libre, il y est remis
//   exactement une fois posé (sendHome) ; si quelque chose l'occupe, il se
//   pose dessus, comme un vrai objet, au lieu de l'écraser. Un seul à la fois.
// - Le rangement demandé (tidy) reprend en main d'un coup tous les corps
//   déplacés (ils ne se poussent plus entre eux), puis les fait rentrer
//   l'un après l'autre (TIDY.stagger entre deux départs), de gauche à
//   droite d'après leur place d'origine, et les pose exactement chez eux.
//   Un dernier passage remet d'un coup ce qu'un trajet aurait bousculé.
// - En mouvement réduit (instant), rien ne vole : chaque corps est remis à
//   sa place aussitôt. Sous &fige (frozen), le temps est arrêté : un corps
//   tombé reste par terre, et le rangement se fait d'un coup.
// - Le visiteur garde la main : un corps glissé ou présenté n'est jamais
//   repris ; présenté pendant son retour, il est posé à sa place sur-le-champ.

/**
 * Le retour d'un corps tombé : délai par terre, durée du trajet, hauteur de
 * l'arc, hauteur d'où il est lâché au-dessus de sa place, et jusqu'où il
 * est remis exactement chez lui une fois posé (écart, inclinaison).
 */
export const FALL_RETURN = {
  delay: 2.5,
  duration: 0.9,
  lift: 2.2,
  drop: 0.3,
  snap: 0.15,
  snapTilt: 0.15,
  /** Au plus tant de secondes pour se poser après le lâcher. */
  landing: 2,
  /** Au plus tant au-dessus de sa place, quand quelque chose l'occupe. */
  maxStack: 2.5,
} as const;

/** Le rangement : écart entre deux départs, durée d'un trajet, hauteur de l'arc. */
export const TIDY = { stagger: 0.13, duration: 0.6, lift: 1.5 } as const;

/** ?desordre : le bureau lâché en vrac, au plus tant de secondes avant de retomber. */
const SCATTER_HOLD = 1;

/** Ce que le metteur en ordre lit du monde, à chaque image. */
export interface TidyContext {
  physics: PhysicsControl;
  desk: DeskBodies;
  portrait: boolean;
  /** L'objet est sorti du monde (présenté, ou en route vers ou depuis la caméra). */
  isOut(id: BodyId): boolean;
  /** Mouvement réduit : retours immédiats, sans trajet. */
  instant: boolean;
  /** &fige : le monde est arrêté (pas de retour tout seul, rangement d'un coup). */
  frozen: boolean;
}

/** Ce qui a changé pendant l'image. */
export interface TidyReport {
  /** Des corps sont rentrés : recopier les places (commitPlaces). */
  changed: boolean;
  /** Le rangement vient de finir. */
  finished: boolean;
}

interface Flight {
  id: BodyId;
  kind: 'fall' | 'tidy';
  /** Secondes avant le départ (le rangement part l'un après l'autre). */
  wait: number;
  elapsed: number;
  duration: number;
  lift: number;
  /** La pose au départ, prise quand le corps est repris en main. */
  start: FullPose | null;
  /** Lâché au-dessus de sa place (retour d'un corps tombé) : depuis combien de temps. */
  landing: number | null;
  /** Tombé sous le plateau : il en sort d'abord par le sol, jusqu'à ce point. */
  exit: { x: number; z: number; elapsed: number } | null;
}

/** Durée de la sortie de sous le plateau (s). */
const EXIT_TIME = 0.35;

/** La pose d'un corps : celle que le moteur a écrite. */
function poseOf(desk: DeskBodies, id: BodyId): FullPose {
  const { x, y, z, qx, qy, qz, qw } = desk[id];
  return { x, y, z, qx, qy, qz, qw };
}

/**
 * Des poses en vrac pour ?desordre : chaque corps en l'air au-dessus d'une
 * case d'une grille qui déborde du plateau, penché au hasard (graine fixe :
 * même désordre à chaque fois). Lâchés, ils tombent, se renversent,
 * s'empilent, et certains finissent par terre.
 */
export function scatterPoses(seed = 9): Map<BodyId, FlightPose> {
  const random = rng(seed);
  const poses = new Map<BodyId, FlightPose>();
  const columns = 5;
  const rows = Math.ceil(BODY_IDS.length / columns);
  BODY_IDS.forEach((id, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = -7.6 + (column + 0.5) * (15.2 / columns) + (random() - 0.5) * 0.8;
    const z = -2.4 + (row + 0.5) * (6.6 / rows) + (random() - 0.5) * 0.5;
    const y = 1.8 + random() * 1.6 + (index % 2) * 1.2;
    // Un axe au hasard, un angle franc : la plupart retombent sur le flanc.
    const ax = random() - 0.5;
    const ay = random() - 0.5;
    const az = random() - 0.5;
    const n = Math.hypot(ax, ay, az) || 1;
    const angle = 0.9 + random() * 1.8;
    const s = Math.sin(angle / 2);
    const q = { qx: (ax / n) * s, qy: (ay / n) * s, qz: (az / n) * s, qw: Math.cos(angle / 2) };
    poses.set(id, { x, y, z, ry: 0, ...q });
  });
  return poses;
}

export class TidyDirector {
  private readonly flights = new Map<BodyId, Flight>();
  /** Depuis combien de temps (s) chaque corps tombé est par terre. */
  private readonly fallenFor = new Map<BodyId, number>();
  /** ?desordre : corps tenus en l'air, à lâcher dès qu'ils y sont. */
  private readonly scattered = new Map<BodyId, FlightPose>();
  private scatterHeld = 0;
  /** Le rangement demandé est en cours. */
  tidying = false;

  /** Des corps sont-ils en train de rentrer ? */
  get busy(): boolean {
    return this.flights.size > 0;
  }

  /** ?desordre : des corps sont-ils encore tenus en l'air ? */
  get scattering(): boolean {
    return this.scattered.size > 0;
  }

  /** Le corps est-il en train de rentrer ? */
  isFlying(id: BodyId): boolean {
    return this.flights.has(id);
  }

  /** Oublie tout (Rejouer, changement de format : le moteur a déjà tout remis en place). */
  reset(): void {
    this.flights.clear();
    this.fallenFor.clear();
    this.scattered.clear();
    this.tidying = false;
  }

  /** Remet un corps à sa place exacte, endormi, et sa pose dans desk. */
  private home(ctx: TidyContext, id: BodyId): void {
    ctx.physics.sendHome(id);
    setHomePose(ctx.desk[id], homePose(id, ctx.portrait));
    this.fallenFor.delete(id);
  }

  /** Le corps peut-il être repris en main ? */
  private free(ctx: TidyContext, id: BodyId): boolean {
    return !ctx.desk[id].hidden && !ctx.isOut(id) && ctx.physics.grabbed !== id;
  }

  /**
   * Le visiteur demande le rangement. Instantané en mouvement réduit et
   * sous &fige ; sinon, les trajets partent l'un après l'autre, et
   * update() signale la fin (finished).
   */
  tidy(ctx: TidyContext): TidyReport {
    if (this.tidying) return { changed: false, finished: false };
    // Les corps lâchés en vrac (?desordre) sont encore tenus : ils comptent.
    for (const id of this.scattered.keys()) ctx.physics.handBack(id, false);
    this.scattered.clear();
    const ids = BODY_IDS.filter(
      (id) =>
        (ctx.desk[id].moved || ctx.desk[id].fallen || this.flights.has(id)) && this.free(ctx, id),
    );
    if (ctx.instant || ctx.frozen) {
      for (const id of this.flights.keys()) this.home(ctx, id);
      this.flights.clear();
      for (const id of ids) this.home(ctx, id);
      return { changed: true, finished: true };
    }
    this.tidying = true;
    const order = [...ids].sort(
      (a, b) => homePose(a, ctx.portrait).x - homePose(b, ctx.portrait).x,
    );
    let index = 0;
    for (const id of order) {
      const current = this.flights.get(id);
      // Déjà en route (retour d'un corps tombé) : il finit son trajet.
      if (current?.start && current.landing === null) {
        current.kind = 'tidy';
        continue;
      }
      if (current?.landing !== undefined && current.landing !== null) {
        // Lâché au-dessus de sa place : il repart comme les autres.
        this.flights.delete(id);
      }
      // Repris en main tout de suite : en attendant son tour, il ne pousse plus personne.
      if (!ctx.physics.takeOver(id)) continue;
      this.flights.set(id, {
        id,
        kind: 'tidy',
        wait: index * TIDY.stagger,
        elapsed: 0,
        duration: TIDY.duration,
        lift: TIDY.lift,
        start: poseOf(ctx.desk, id),
        landing: null,
        exit: null,
      });
      ctx.physics.drive(id, { ...poseOf(ctx.desk, id), ry: ctx.desk[id].ry });
      index += 1;
    }
    return { changed: false, finished: false };
  }

  /**
   * ?desordre : tous les corps libres repris en main et posés en vrac en
   * l'air (scatterPoses), puis lâchés par update() dès que le moteur les y
   * a portés.
   */
  scatter(ctx: TidyContext, seed?: number): void {
    const poses = scatterPoses(seed);
    for (const [id, pose] of poses) {
      if (!this.free(ctx, id) || this.flights.has(id) || !ctx.physics.takeOver(id)) continue;
      ctx.physics.drive(id, pose);
      this.scattered.set(id, pose);
    }
    this.scatterHeld = 0;
  }

  /** Une image : les trajets avancent, les corps tombés attendent leur tour. */
  update(ctx: TidyContext, dt: number): TidyReport {
    const report: TidyReport = { changed: false, finished: false };
    const step = ctx.frozen ? 0 : Math.max(0, dt);

    this.releaseScattered(ctx, dt);

    for (const [id, flight] of this.flights) {
      if (ctx.isOut(id) || ctx.desk[id].hidden) {
        // Présenté pendant son retour : il rentre sur-le-champ.
        this.home(ctx, id);
        this.flights.delete(id);
        report.changed = true;
        continue;
      }
      if (flight.landing !== null) {
        if (this.land(ctx, flight, step)) {
          this.flights.delete(id);
          report.changed = true;
        }
        continue;
      }
      let time = step;
      if (flight.wait > 0) {
        flight.wait -= time;
        if (flight.wait > 0) continue;
        time = -flight.wait;
        flight.wait = 0;
      }
      if (!flight.start) {
        // Saisi par le visiteur avant son départ : il le garde.
        if (!this.free(ctx, id) || !ctx.physics.takeOver(id)) {
          this.flights.delete(id);
          continue;
        }
        flight.start = poseOf(ctx.desk, id);
        const exit = deskExit(flight.start, deskArea(ctx.portrait), reachOf(id) + 0.2);
        flight.exit = exit ? { ...exit, elapsed: 0 } : null;
      }
      if (flight.exit) {
        // Sous le plateau : d'abord dehors, au ras du sol.
        const exit = flight.exit;
        exit.elapsed += time;
        const k = easeInOut(exit.elapsed / EXIT_TIME);
        const { start } = flight;
        const pose = {
          ...start,
          x: start.x + (exit.x - start.x) * k,
          z: start.z + (exit.z - start.z) * k,
        };
        ctx.physics.drive(id, { ...pose, ry: ctx.desk[id].ry });
        if (exit.elapsed < EXIT_TIME) continue;
        flight.start = { ...start, x: exit.x, z: exit.z };
        flight.exit = null;
        time = exit.elapsed - EXIT_TIME;
      }
      flight.elapsed += time;
      const u = flight.elapsed / flight.duration;
      const home = homePose(id, ctx.portrait);
      // Le retour d'un corps tombé finit un peu au-dessus de sa place, d'où il est lâché.
      const dropped = flight.kind === 'fall' && id !== 'headset';
      const target: DeskPose = dropped ? { ...home, y: this.dropHeight(ctx, id, home) } : home;
      if (u < 1) {
        ctx.physics.drive(id, flightPose(flight.start, target, u, flight.lift));
        continue;
      }
      if (dropped) {
        ctx.physics.handBack(id, false);
        flight.landing = 0;
        continue;
      }
      this.home(ctx, id);
      this.flights.delete(id);
      report.changed = true;
    }

    if (!ctx.frozen) this.watchFallen(ctx, step, report);

    if (this.tidying && this.flights.size === 0) {
      // Dernier passage : ce qu'un trajet a bousculé rentre d'un coup.
      for (const id of BODY_IDS) {
        if ((ctx.desk[id].moved || ctx.desk[id].fallen) && this.free(ctx, id)) this.home(ctx, id);
      }
      this.tidying = false;
      report.changed = true;
      report.finished = true;
    }
    return report;
  }

  /**
   * D'où lâcher un corps qui rentre : un peu au-dessus de sa place, ou
   * au-dessus de ce qui l'occupe (un corps déplacé, endormi ou pas), pour
   * s'y poser au lieu de l'écraser contre le plateau.
   */
  private dropHeight(ctx: TidyContext, id: BodyId, home: DeskPose): number {
    const occupied = occupiedHeight(
      ctx.desk,
      id,
      home.x,
      home.z,
      (other) => !ctx.desk[other].moved || this.flights.has(other) || ctx.isOut(other),
    );
    // Borné : un corps encore en l'air au-dessus de sa place ne l'envoie pas au plafond.
    const above = Math.min(occupied + bottomOf(id), home.y + FALL_RETURN.maxStack);
    return Math.max(home.y, above) + FALL_RETURN.drop;
  }

  /**
   * Un corps lâché au-dessus de sa place se pose. Posé (ou au bout de
   * FALL_RETURN.landing s), il est remis exactement chez lui s'il y est à
   * peu près, et laissé là où il est (sur ce qui occupait sa place) sinon.
   * Vrai quand c'est fini.
   */
  private land(ctx: TidyContext, flight: Flight, dt: number): boolean {
    const { id } = flight;
    flight.landing = (flight.landing ?? 0) + dt;
    // Au moins une image après le lâcher : le moteur l'a réveillé.
    if (ctx.physics.isAwake(id) && flight.landing < FALL_RETURN.landing) return false;
    const body = ctx.desk[id];
    const home = homePose(id, ctx.portrait);
    const close =
      Math.hypot(body.x - home.x, body.z - home.z) < FALL_RETURN.snap &&
      Math.abs(body.y - home.y) < FALL_RETURN.snap &&
      tiltOf(body) < FALL_RETURN.snapTilt;
    if (close && !body.fallen) this.home(ctx, id);
    return true;
  }

  /** Les corps tombés : au bout du délai, le plus ancien rentre (un seul à la fois). */
  private watchFallen(ctx: TidyContext, dt: number, report: TidyReport): void {
    let next: BodyId | null = null;
    let longest = 0;
    let returning = false;
    for (const flight of this.flights.values()) if (flight.kind === 'fall') returning = true;
    for (const id of BODY_IDS) {
      const body = ctx.desk[id];
      if (!body.fallen || this.flights.has(id) || this.scattered.has(id) || !this.free(ctx, id)) {
        this.fallenFor.delete(id);
        continue;
      }
      const time = (this.fallenFor.get(id) ?? 0) + dt;
      this.fallenFor.set(id, time);
      if (time >= FALL_RETURN.delay && time > longest) {
        longest = time;
        next = id;
      }
    }
    if (next === null || returning || this.tidying) return;
    if (ctx.instant) {
      this.home(ctx, next);
      report.changed = true;
      return;
    }
    this.fallenFor.delete(next);
    this.flights.set(next, {
      id: next,
      kind: 'fall',
      wait: 0,
      elapsed: 0,
      duration: FALL_RETURN.duration,
      lift: FALL_RETURN.lift,
      start: null,
      landing: null,
      exit: null,
    });
  }

  /** ?desordre : lâche les corps arrivés en l'air (ou au bout de SCATTER_HOLD s). */
  private releaseScattered(ctx: TidyContext, dt: number): void {
    if (this.scattered.size === 0) return;
    this.scatterHeld += Math.max(dt, 1 / 60);
    for (const [id, pose] of this.scattered) {
      const body = ctx.desk[id];
      const there = Math.hypot(body.x - pose.x, body.y - pose.y, body.z - pose.z) < 0.01;
      if (!there && this.scatterHeld < SCATTER_HOLD) continue;
      ctx.physics.handBack(id, false);
      this.scattered.delete(id);
    }
  }
}
