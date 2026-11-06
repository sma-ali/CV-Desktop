import type { Collider, ColliderDesc, RigidBody, World } from '@dimforge/rapier3d-compat';
import {
  FALLEN_Y,
  homePose,
  isMoved,
  yawOf,
  type DeskBodies,
  type DeskBodyState,
  type DeskPose,
} from '../core/bodies';
import { DESK } from '../core/constants';
import { BODY_IDS, isDecorBodyId, type BodyId } from '../core/ids';
import { clamp } from '../core/math';
import type { PhysicsControl, PhysicsEvents } from '../core/physicsControl';
import { DECOR_BODY_SPECS } from './decorShapes';
import {
  deskSlab,
  FIXED_SPECS,
  headsetStandSpecs,
  ITEM_BODY_SPECS,
  lowestPoint,
  type BodySpec,
  type FixedSpec,
  type ShapeSpec,
} from './shapes';

// Le monde physique du bureau : un corps rigide Rapier par
// objet du CV et par morceau du décor, posés endormis à leur place
// d'origine, sur un plateau, un sol et un mur fixes. Ce module ne dépend ni
// de React ni de three : il reçoit le module Rapier (useRapier() dans la
// scène, l'import direct dans les tests) et un monde, et se teste en Node
// (world.test.ts).
//
// Le pas est fixe (FIXED_STEP) : à mêmes gestes, mêmes résultats. Personne
// ne fait avancer le monde en dehors de advance() et settle() : sous &fige,
// la scène n'appelle que settle() (le bureau se pose aussitôt dans son état
// final), sinon advance(dt) à chaque image.

/** Le module Rapier (sa forme « compat », WebAssembly embarqué). */
export type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];

/** Durée d'un pas du monde (s). */
export const FIXED_STEP = 1 / 60;

/** Au plus tant de pas par image : une image lente ralentit le monde au lieu de le faire sauter. */
const MAX_STEPS_PER_FRAME = 4;

/** La pesanteur, en unités du bureau (environ 10 cm) par seconde carrée : un peu moins que la vraie, plus lisible. */
export const GRAVITY = 60;

/** Réglages du glisser : hauteur au-dessus de ce qu'il survole, raideur, vitesses bornées. */
const GRAB = {
  /** Hauteur du corps glissé au-dessus de ce qu'il survole. */
  lift: 0.12,
  /** Raideur de la poursuite du pointeur (1/s) et de la remise droite. */
  follow: 16,
  turn: 10,
  /** Vitesse et rotation bornées pendant le glisser. */
  maxSpeed: 30,
  maxSpin: 12,
  /** Vitesse bornée au lâcher (élan). */
  maxThrow: 16,
} as const;

/**
 * Les réglages communs des corps. Rapier ne freine pas le roulement : un
 * amortissement angulaire fort tient lieu de résistance (un cylindre couché
 * ne roule pas des secondes sur le plateau).
 */
const BODY = { friction: 0.7, restitution: 0.12, linearDamping: 0.3, angularDamping: 2 };

/** Un glisser en cours. */
interface Grab {
  id: BodyId;
  /** Décalage entre le point saisi et l'origine du corps, sur le plateau. */
  offsetX: number;
  offsetZ: number;
  /** Le point du plateau visé (sous le pointeur). */
  aimX: number;
  aimZ: number;
  /** Le cap du corps à la saisie : il reste droit à ce cap pendant le glisser. */
  yaw: number;
  /** Hauteur visée, lissée. */
  height: number;
}

interface Entry {
  id: BodyId;
  body: RigidBody;
  colliders: Collider[];
  /** Hauteur de l'origine au-dessus du point le plus bas, debout. */
  standHeight: number;
  /** Repris en main par un autre (rangement) : piloté en position. */
  driven: boolean;
  speed: number;
  thudCooldown: number;
  /** Depuis combien de temps (s) il ne bouge presque plus. */
  calm: number;
}

/** Pose une forme Rapier d'après sa description. */
function colliderDesc(rapier: RapierModule, shape: ShapeSpec): ColliderDesc {
  const { ColliderDesc } = rapier;
  if (shape.kind === 'capsule') {
    const [ax, ay, az] = shape.from;
    const [bx, by, bz] = shape.to;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const length = Math.hypot(dx, dy, dz) || 1;
    // L'axe de la gélule (y local) tourné vers le segment.
    const q = fromUnitY(dx / length, dy / length, dz / length);
    return ColliderDesc.capsule(length / 2, shape.radius)
      .setTranslation((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
      .setRotation(q);
  }
  const [x, y, z] = shape.at ?? [0, 0, 0];
  let desc: ColliderDesc;
  if (shape.kind === 'ball') return ColliderDesc.ball(shape.radius).setTranslation(x, y, z);
  if (shape.kind === 'cylinder') desc = prism(rapier, shape.radius, shape.halfHeight);
  else desc = ColliderDesc.cuboid(shape.half[0], shape.half[1], shape.half[2]);
  desc.setTranslation(x, y, z);
  if (shape.rotation) desc.setRotation(fromEuler(...shape.rotation));
  return desc;
}

/** Côtés du prisme qui remplace un cylindre. */
const PRISM_SIDES = 10;

/**
 * Un cylindre en prisme à PRISM_SIDES côtés (axe y), comme les objets low
 * poly qu'il habille : couché, il se pose sur une face au lieu de rouler
 * et de trembler contre une arête (le cylindre exact de Rapier le fait).
 */
function prism(rapier: RapierModule, radius: number, halfHeight: number): ColliderDesc {
  const points = new Float32Array(PRISM_SIDES * 6);
  for (let i = 0; i < PRISM_SIDES; i++) {
    const a = (i / PRISM_SIDES) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    points.set([x, -halfHeight, z, x, halfHeight, z], i * 6);
  }
  return rapier.ColliderDesc.convexHull(points) ?? rapier.ColliderDesc.cylinder(halfHeight, radius);
}

/** Quaternion qui amène l'axe y sur la direction (x, y, z) unitaire. */
function fromUnitY(x: number, y: number, z: number) {
  // Rotation la plus courte de (0, 1, 0) vers (x, y, z).
  const dot = y;
  if (dot < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
  const cx = z;
  const cz = -x;
  const w = 1 + dot;
  const n = Math.hypot(cx, cz, w) || 1;
  return { x: cx / n, y: 0, z: cz / n, w: w / n };
}

/** Quaternion d'angles d'Euler XYZ (ordre de three). */
function fromEuler(ax: number, ay: number, az: number) {
  const c1 = Math.cos(ax / 2);
  const c2 = Math.cos(ay / 2);
  const c3 = Math.cos(az / 2);
  const s1 = Math.sin(ax / 2);
  const s2 = Math.sin(ay / 2);
  const s3 = Math.sin(az / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

const yawQuat = (ry: number) => ({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) });

/** La description d'un corps. */
function bodySpec(id: BodyId): BodySpec {
  return isDecorBodyId(id) ? DECOR_BODY_SPECS[id] : ITEM_BODY_SPECS[id];
}

/** Un corps presque immobile (vitesse, rotation) pendant seconds s'endort. */
const CALM = { speed: 0.06, spin: 0.12, seconds: 0.4 } as const;

/** Le monde physique du bureau. */
export class DeskPhysics implements PhysicsControl {
  readonly entries = new Map<BodyId, Entry>();
  private readonly fixed: Collider[] = [];
  private formatFixed: Collider[] = [];
  private accumulator = 0;
  private wasAwake = false;
  private grabState: Grab | null = null;
  /** Corps sortis du monde (présentés) : ni collisions, ni pose écrite. */
  private readonly out = new Set<BodyId>();
  private readonly events: PhysicsEvents = { settled: false, thuds: [] };
  private readonly ray;
  portrait: boolean;

  constructor(
    private readonly rapier: RapierModule,
    readonly world: World,
    portrait: boolean,
  ) {
    this.portrait = portrait;
    world.gravity = { x: 0, y: -GRAVITY, z: 0 };
    world.timestep = FIXED_STEP;
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    for (const spec of FIXED_SPECS) this.fixed.push(this.createFixed(spec));
    this.buildFormat(portrait);
    for (const id of BODY_IDS) this.createBody(id);
  }

  get grabbed(): BodyId | null {
    return this.grabState?.id ?? null;
  }

  private createFixed(spec: FixedSpec): Collider {
    return this.world.createCollider(
      colliderDesc(this.rapier, spec.shape).setFriction(BODY.friction),
    );
  }

  private buildFormat(portrait: boolean): void {
    for (const collider of this.formatFixed) this.world.removeCollider(collider, false);
    this.formatFixed = [deskSlab(portrait), ...headsetStandSpecs(portrait)].map((spec) =>
      this.createFixed(spec),
    );
  }

  private createBody(id: BodyId): void {
    const { RigidBodyDesc } = this.rapier;
    const spec = bodySpec(id);
    const home = homePose(id, this.portrait);
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(home.x, home.y, home.z)
        .setRotation(yawQuat(home.ry))
        .setLinearDamping(BODY.linearDamping)
        .setAngularDamping(BODY.angularDamping)
        .setCcdEnabled(true)
        .setCanSleep(true)
        // Endormi à sa place : rien ne bouge tant qu'on n'y touche pas.
        .setSleeping(true),
    );
    const colliders = spec.shapes.map((shape) =>
      this.world.createCollider(
        colliderDesc(this.rapier, shape)
          .setDensity(shape.density ?? spec.density ?? 1)
          .setFriction(spec.friction ?? BODY.friction)
          .setRestitution(spec.restitution ?? BODY.restitution),
        body,
      ),
    );
    this.entries.set(id, {
      id,
      body,
      colliders,
      standHeight: -lowestPoint(spec),
      driven: false,
      speed: 0,
      thudCooldown: 0,
      calm: 0,
    });
  }

  /** Le corps est-il dans le monde (ni caché par le format, ni présenté) ? */
  private active(id: BodyId, desk?: DeskBodies): boolean {
    return !this.out.has(id) && !(desk?.[id].hidden ?? false);
  }

  /**
   * Les corps présentés (ou qui reviennent) sortent du monde, puis y
   * reviennent à leur pose du plateau. Appelé à chaque image.
   */
  syncPresence(desk: DeskBodies, isOut: (id: BodyId) => boolean): void {
    for (const [id, entry] of this.entries) {
      const outNow = isOut(id) || desk[id].hidden;
      const wasOut = this.out.has(id);
      if (outNow === wasOut) continue;
      if (outNow) {
        this.out.add(id);
        if (this.grabState?.id === id) this.grabState = null;
        entry.body.setEnabled(false);
      } else {
        this.out.delete(id);
        const pose = desk[id];
        entry.body.setTranslation({ x: pose.x, y: pose.y, z: pose.z }, false);
        entry.body.setRotation({ x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw }, false);
        entry.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        entry.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        entry.body.setEnabled(true);
        // Revenu là où il était : il dort, sauf s'il flotte (tombé, renversé en l'air).
        if (pose.moved) entry.body.wakeUp();
        else entry.body.sleep();
      }
    }
  }

  grab(id: BodyId, x: number, z: number): boolean {
    const entry = this.entries.get(id);
    if (!entry || this.out.has(id) || entry.driven) return false;
    const t = entry.body.translation();
    const r = entry.body.rotation();
    this.grabState = {
      id,
      offsetX: t.x - x,
      offsetZ: t.z - z,
      aimX: x,
      aimZ: z,
      yaw: yawOf(r.x, r.y, r.z, r.w),
      height: t.y,
    };
    entry.body.setGravityScale(0, true);
    entry.body.wakeUp();
    return true;
  }

  aim(x: number, z: number): void {
    if (!this.grabState) return;
    this.grabState.aimX = x;
    this.grabState.aimZ = z;
  }

  release(withThrow: boolean): void {
    const grab = this.grabState;
    if (!grab) return;
    this.grabState = null;
    const entry = this.entries.get(grab.id);
    if (!entry) return;
    entry.body.setGravityScale(1, true);
    if (!withThrow) {
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }
    const v = entry.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed > GRAB.maxThrow) {
      const k = GRAB.maxThrow / speed;
      entry.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    }
  }

  isAwake(id: BodyId): boolean {
    const entry = this.entries.get(id);
    return !!entry && !this.out.has(id) && !entry.body.isSleeping();
  }

  takeOver(id: BodyId): boolean {
    const entry = this.entries.get(id);
    if (!entry || this.out.has(id) || this.grabState?.id === id) return false;
    entry.driven = true;
    entry.body.setBodyType(this.rapier.RigidBodyType.KinematicPositionBased, true);
    // Sans CCD, drive() pose le corps là où on le demande (avec, un grand pas l'arrête au premier contact).
    entry.body.enableCcd(false);
    return true;
  }

  drive(id: BodyId, pose: DeskPose & { qx?: number; qy?: number; qz?: number; qw?: number }): void {
    const entry = this.entries.get(id);
    if (!entry?.driven) return;
    entry.body.setNextKinematicTranslation({ x: pose.x, y: pose.y, z: pose.z });
    const q =
      pose.qw === undefined
        ? yawQuat(pose.ry)
        : { x: pose.qx ?? 0, y: pose.qy ?? 0, z: pose.qz ?? 0, w: pose.qw };
    entry.body.setNextKinematicRotation(q);
  }

  handBack(id: BodyId, asleep: boolean): void {
    const entry = this.entries.get(id);
    if (!entry?.driven) return;
    entry.driven = false;
    entry.body.setBodyType(this.rapier.RigidBodyType.Dynamic, true);
    entry.body.enableCcd(true);
    entry.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    entry.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    if (asleep) entry.body.sleep();
    else entry.body.wakeUp();
  }

  sendHome(id: BodyId): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (this.grabState?.id === id) this.grabState = null;
    if (entry.driven) {
      entry.driven = false;
      entry.body.setBodyType(this.rapier.RigidBodyType.Dynamic, false);
      entry.body.enableCcd(true);
    }
    const home = homePose(id, this.portrait);
    entry.body.setGravityScale(1, false);
    entry.body.setTranslation({ x: home.x, y: home.y, z: home.z }, false);
    entry.body.setRotation(yawQuat(home.ry), false);
    entry.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    entry.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    entry.body.sleep();
    this.dirty.add(id);
  }

  /** Tous les corps à leur place d'origine (Rejouer, changement de format). */
  resetAll(): void {
    this.grabState = null;
    for (const id of BODY_IDS) this.sendHome(id);
    this.wasAwake = false;
  }

  /** Le format change : plateau, support du casque, et tout le monde rentre (bureau rangé). */
  setFormat(portrait: boolean): void {
    if (portrait === this.portrait) return;
    this.portrait = portrait;
    this.buildFormat(portrait);
    this.resetAll();
  }

  /** La hauteur du dessus de ce qu'il y a sous (x, z), sans compter le corps glissé ; au moins le plateau. */
  private surfaceUnder(x: number, z: number, exclude: RigidBody): number {
    this.ray.origin = { x, y: 12, z };
    const hit = this.world.castRay(this.ray, 30, true, undefined, undefined, undefined, exclude);
    const y = hit ? 12 - hit.timeOfImpact : 0;
    return Math.max(0, y);
  }

  /** Pilote le corps glissé vers le pointeur, droit à son cap (avant chaque pas). */
  private driveGrab(): void {
    const grab = this.grabState;
    if (!grab) return;
    const entry = this.entries.get(grab.id);
    if (!entry) return;
    const { body } = entry;
    // Ni dans le mur, ni au-delà des parois de la pièce.
    const tx = clamp(grab.aimX + grab.offsetX, -11, 11);
    const tz = clamp(grab.aimZ + grab.offsetZ, DESK.z0 + 0.15, 8);
    const target = this.surfaceUnder(tx, tz, body) + entry.standHeight + GRAB.lift;
    // Monter vite (pour passer par-dessus), descendre doucement.
    const k = target > grab.height ? 0.5 : 0.15;
    grab.height += (target - grab.height) * k;
    const t = body.translation();
    let vx = (tx - t.x) * GRAB.follow;
    let vy = (grab.height - t.y) * GRAB.follow;
    let vz = (tz - t.z) * GRAB.follow;
    const speed = Math.hypot(vx, vy, vz);
    if (speed > GRAB.maxSpeed) {
      const s = GRAB.maxSpeed / speed;
      vx *= s;
      vy *= s;
      vz *= s;
    }
    body.setLinvel({ x: vx, y: vy, z: vz }, true);
    // Remis droit, à son cap : la rotation qui reste à faire, en vitesse angulaire.
    const r = body.rotation();
    const g = yawQuat(grab.yaw);
    // e = g * conj(r)
    let ex = g.w * -r.x + g.x * r.w + g.y * -r.z - g.z * -r.y;
    let ey = g.w * -r.y - g.x * -r.z + g.y * r.w + g.z * -r.x;
    let ez = g.w * -r.z + g.x * -r.y - g.y * -r.x + g.z * r.w;
    let ew = g.w * r.w - g.x * -r.x - g.y * -r.y - g.z * -r.z;
    if (ew < 0) {
      ex = -ex;
      ey = -ey;
      ez = -ez;
      ew = -ew;
    }
    const sin = Math.hypot(ex, ey, ez);
    const angle = 2 * Math.atan2(sin, ew);
    const spin = Math.min(GRAB.maxSpin, angle * GRAB.turn);
    const n = sin > 1e-6 ? spin / sin : 0;
    body.setAngvel({ x: ex * n, y: ey * n, z: ez * n }, true);
  }

  /** Les corps qui ont bougé depuis la dernière écriture des poses. */
  private readonly dirty = new Set<BodyId>();

  /** Un pas du monde. */
  private stepOnce(): void {
    this.driveGrab();
    this.world.step();
    for (const [id, entry] of this.entries) {
      if (!this.out.has(id) && entry.body.isEnabled() && !entry.body.isSleeping()) {
        this.dirty.add(id);
      }
    }
  }

  /**
   * Avance le monde de dt secondes (pas fixes, au plus MAX_STEPS_PER_FRAME),
   * puis écrit les poses dans desk.
   */
  advance(dt: number, desk: DeskBodies): PhysicsEvents {
    this.accumulator = Math.min(
      this.accumulator + Math.max(0, dt),
      FIXED_STEP * MAX_STEPS_PER_FRAME,
    );
    let steps = 0;
    while (this.accumulator >= FIXED_STEP - 1e-9) {
      this.accumulator -= FIXED_STEP;
      this.stepOnce();
      steps += 1;
    }
    return this.output(desk, steps * FIXED_STEP);
  }

  /**
   * Fait avancer le monde jusqu'à ce que tout dorme (au plus maxSteps pas),
   * d'un coup : sous &fige, le bureau se pose aussitôt dans son état final.
   */
  settle(desk: DeskBodies, maxSteps = 900): PhysicsEvents {
    let steps = 0;
    while (steps < maxSteps && (steps === 0 || this.anyAwake())) {
      this.stepOnce();
      steps += 1;
    }
    this.accumulator = 0;
    return this.output(desk, steps * FIXED_STEP);
  }

  /** Quelques pas d'un coup (sous &fige, pendant un glisser). */
  stepMany(desk: DeskBodies, steps: number): PhysicsEvents {
    for (let i = 0; i < steps; i++) this.stepOnce();
    return this.output(desk, steps * FIXED_STEP);
  }

  /** Un corps bougeait encore au dernier pas joué (advance, stepMany ou settle). */
  get moving(): boolean {
    return this.wasAwake;
  }

  anyAwake(): boolean {
    for (const [id, entry] of this.entries) {
      if (!this.out.has(id) && entry.body.isEnabled() && !entry.body.isSleeping()) return true;
    }
    return false;
  }

  /** Écrit la pose des corps éveillés dans desk ; détecte chocs et bureau posé. */
  private output(desk: DeskBodies, elapsed: number): PhysicsEvents {
    const events = this.events;
    events.thuds.length = 0;
    let awake = false;
    for (const [id, entry] of this.entries) {
      if (this.out.has(id) || !entry.body.isEnabled()) continue;
      entry.thudCooldown = Math.max(0, entry.thudCooldown - elapsed);
      // Endormi pendant ces pas : sa dernière pose s'écrit encore une fois.
      if (this.dirty.delete(id)) writePose(desk[id], entry.body, homePose(id, this.portrait));
      if (entry.body.isSleeping()) {
        entry.speed = 0;
        continue;
      }
      const v = entry.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      // Un choc : la vitesse tombe d'un coup (hors du glisser, qui la pilote).
      const drop = entry.speed - speed;
      if (drop > 4 && entry.thudCooldown <= 0 && this.grabState?.id !== id) {
        events.thuds.push(Math.min(1, drop / 24));
        entry.thudCooldown = 0.15;
      }
      entry.speed = speed;
      // Presque immobile depuis CALM.seconds : il s'endort tout de suite, sans
      // attendre les 2 s de Rapier (moins de calcul sur téléphone, et un
      // bureau qui se pose vite même quand les images sont lentes).
      const w = entry.body.angvel();
      const still = speed < CALM.speed && Math.hypot(w.x, w.y, w.z) < CALM.spin;
      entry.calm = still && !entry.driven && this.grabState?.id !== id ? entry.calm + elapsed : 0;
      if (entry.calm >= CALM.seconds) {
        entry.body.sleep();
        entry.calm = 0;
        writePose(desk[id], entry.body, homePose(id, this.portrait));
        continue;
      }
      awake = true;
    }
    events.settled = this.wasAwake && !awake;
    this.wasAwake = awake;
    return events;
  }

  /**
   * La plus grande interpénétration entre deux corps (contacts du monde, en
   * unités) : un état sain reste sous quelques centièmes. Pour les tests et
   * l'attribut data-penetration.
   */
  maxPenetration(): number {
    let depth = 0;
    for (const [id, entry] of this.entries) {
      if (!this.active(id)) continue;
      for (const collider of entry.colliders) {
        this.world.contactPairsWith(collider, (other) => {
          this.world.contactPair(collider, other, (manifold) => {
            for (let i = 0; i < manifold.numContacts(); i++) {
              depth = Math.max(depth, -manifold.contactDist(i));
            }
          });
        });
      }
    }
    return depth;
  }

  /** La pose d'un corps dans le monde (tests). */
  poseOf(id: BodyId): { x: number; y: number; z: number } {
    const t = this.entries.get(id)?.body.translation();
    return t ? { x: t.x, y: t.y, z: t.z } : { x: 0, y: 0, z: 0 };
  }

  dispose(): void {
    this.grabState = null;
    for (const entry of this.entries.values()) this.world.removeRigidBody(entry.body);
    for (const collider of [...this.fixed, ...this.formatFixed]) {
      this.world.removeCollider(collider, false);
    }
    this.entries.clear();
  }
}

/** Recopie la pose d'un corps Rapier dans son état du plateau. */
function writePose(state: DeskBodyState, body: RigidBody, home: DeskPose): void {
  const t = body.translation();
  const r = body.rotation();
  state.x = t.x;
  state.y = t.y;
  state.z = t.z;
  state.qx = r.x;
  state.qy = r.y;
  state.qz = r.z;
  state.qw = r.w;
  state.ry = yawOf(r.x, r.y, r.z, r.w);
  state.moved = isMoved(state, home);
  state.fallen = t.y < FALLEN_Y;
}
