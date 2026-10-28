import { FIXED_ITEM_OBSTACLES, type DeskBodies } from '../core/bodies';
import { BOUNDS } from '../core/constants';
import { BODY_IDS, type BodyId } from '../core/ids';
import { DECOR_OBSTACLES } from '../decor/layout';
import { moveBody, overlapScore, settleBodies, type SolverWorld } from './solver';

// Le glisser d'un corps sur le plateau, image par image (updateItem et
// collide du prototype) : le corps suit la main avec un peu de retard, se
// soulève, s'incline selon sa vitesse, pousse les autres ; lâché, il
// retombe, rebondit et s'écrase un peu. Sans three ni React : le composant
// Gestures lui donne la cible (le point du plateau sous le pointeur) et
// applique les sons qu'il renvoie.

/** Le plateau : le décor, le pied de l'écran, le support du casque et les bords. */
export const DESK_WORLD: SolverWorld = {
  obstacles: [...DECOR_OBSTACLES, ...FIXED_ITEM_OBSTACLES],
  bounds: BOUNDS,
};

/** Réglages du prototype (l. 1336-1390). */
export const DRAG = {
  /** Seuil du glisser, en pixels : en deçà, un clic reste un clic. */
  threshold: 7,
  /** Hauteur du corps glissé au-dessus du plateau. */
  lift: 0.32,
  /** Retard du corps sur la main : part du chemin qui reste après une seconde. */
  follow: 0.0005,
  /** Montée vers lift : part qui reste après une seconde. */
  rise: 0.001,
  /** Inclinaison par unité de vitesse, et plafond (radians). */
  tilt: 0.05,
  maxTilt: 0.3,
  /** Inclinaison qui reste après une image de 1/60 s, une fois lâché. */
  tiltDecay: 0.85,
  /** Vitesse verticale au lâcher, pesanteur, rebond. */
  dropSpeed: -2.5,
  gravity: 22,
  bounceBelow: -1.4,
  restitution: 0.34,
  /** Petit saut d'un corps poussé, et ce qu'il faut de poussée pour sauter. */
  hopSpeed: 1.4,
  hopAfter: 0.05,
  /** Retour de l'écrasement, par seconde. */
  squashRate: 3.2,
} as const;

/** Le mouvement vertical et l'élan de chaque corps, hors du store. */
interface Motion {
  vy: number;
  /** Le corps glissé bute déjà (un seul choc par contact). */
  bump: boolean;
}

/** Un glisser en cours : le corps, et le point du plateau qu'il vise. */
export interface DragSession {
  id: BodyId;
  /** Décalage entre le point de prise et le centre du corps. */
  offsetX: number;
  offsetZ: number;
  /** Cible du centre du corps (point sous la main + décalage). */
  targetX: number;
  targetZ: number;
}

export interface StepOptions {
  dt: number;
  /** Les corps posés sur le plateau (un objet présenté n'y est pas). */
  active: readonly BodyId[];
  /** Mouvement réduit : ni retard, ni inclinaison, ni rebond. */
  reduced: boolean;
  /** Horloge gelée (?fige) : le corps suit la main sans retard. */
  instant: boolean;
}

/** Ce qu'une image a produit : chocs à faire sonner (force de 0 à 1), places changées. */
export interface StepEvents {
  thuds: number[];
  /** Des corps ont bougé hors du glisser (poussés, relaxés) : places à recopier. */
  settled: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class DragSim {
  session: DragSession | null = null;
  private readonly motion = new Map<BodyId, Motion>(
    BODY_IDS.map((id) => [id, { vy: 0, bump: false }]),
  );

  /** Les corps actifs de l'image précédente (pour savoir lequel vient d'être reposé). */
  private lastActive: readonly BodyId[] = BODY_IDS;

  constructor(private readonly world: SolverWorld = DESK_WORLD) {}

  /** Commence un glisser : (px, pz) est le point du plateau sous la main au moment de la prise. */
  begin(desk: DeskBodies, id: BodyId, px: number, pz: number): DragSession {
    const body = desk[id];
    this.session = {
      id,
      offsetX: body.x - px,
      offsetZ: body.z - pz,
      targetX: body.x,
      targetZ: body.z,
    };
    const motion = this.motion.get(id)!;
    motion.vy = 0;
    motion.bump = false;
    return this.session;
  }

  /** La main est au point (px, pz) du plateau. */
  aim(px: number, pz: number): void {
    const session = this.session;
    if (!session || !Number.isFinite(px) || !Number.isFinite(pz)) return;
    session.targetX = px + session.offsetX;
    session.targetZ = pz + session.offsetZ;
  }

  /** Vise directement une place du centre du corps (?glisse=). */
  aimCenter(x: number, z: number): void {
    if (!this.session) return;
    this.session.targetX = x;
    this.session.targetZ = z;
  }

  /** Lâche le corps : il retombe (sans rebond en mouvement réduit). */
  release(desk: DeskBodies, reduced: boolean): BodyId | null {
    const session = this.session;
    if (!session) return null;
    this.session = null;
    const body = desk[session.id];
    const motion = this.motion.get(session.id)!;
    motion.bump = false;
    if (reduced) {
      body.lift = 0;
      body.tiltX = 0;
      body.tiltZ = 0;
      motion.vy = 0;
    } else {
      motion.vy = DRAG.dropSpeed;
    }
    return session.id;
  }

  /** Arrête tout : Rejouer, ou corps qui quitte le plateau (présenté). */
  cancel(desk: DeskBodies): void {
    if (this.session) {
      const body = desk[this.session.id];
      body.lift = 0;
      body.tiltX = 0;
      body.tiltZ = 0;
    }
    this.session = null;
    for (const motion of this.motion.values()) {
      motion.vy = 0;
      motion.bump = false;
    }
  }

  /** Pose les corps à plat, immobiles (fin d'un ?glisse sous &fige, Rejouer). */
  settle(desk: DeskBodies): void {
    for (const id of BODY_IDS) {
      const body = desk[id];
      body.lift = 0;
      body.tiltX = 0;
      body.tiltZ = 0;
      body.squash = 0;
      this.motion.get(id)!.vy = 0;
    }
  }

  /** Une image : le glisser en cours, la retombée des corps, les recouvrements laissés. */
  step(desk: DeskBodies, { dt, active, reduced, instant }: StepOptions): StepEvents {
    const events: StepEvents = { thuds: [], settled: false };
    const session = this.session;
    const smooth = reduced || instant;
    if (session && active.includes(session.id)) {
      const body = desk[session.id];
      const motion = this.motion.get(session.id)!;
      const k = smooth ? 1 : 1 - Math.pow(DRAG.follow, dt);
      const x0 = body.x;
      const z0 = body.z;
      const result = moveBody(
        desk,
        session.id,
        x0 + (session.targetX - x0) * k,
        z0 + (session.targetZ - z0) * k,
        active,
        this.world,
      );
      const vx = (body.x - x0) / Math.max(dt, 1e-3);
      const vz = (body.z - z0) / Math.max(dt, 1e-3);
      if (result.blocked) {
        if (!motion.bump) {
          motion.bump = true;
          if (!reduced) body.squash = 0.6;
          events.thuds.push(0.5);
        }
      } else {
        motion.bump = false;
      }
      body.lift = reduced
        ? DRAG.lift
        : body.lift + (DRAG.lift - body.lift) * (1 - Math.pow(DRAG.rise, dt));
      body.tiltX = smooth ? 0 : clamp(vz * DRAG.tilt, -DRAG.maxTilt, DRAG.maxTilt);
      body.tiltZ = smooth ? 0 : clamp(-vx * DRAG.tilt, -DRAG.maxTilt, DRAG.maxTilt);
      motion.vy = 0;
      for (const [id, distance] of result.pushed) {
        const pushed = desk[id];
        const hop = this.motion.get(id)!;
        if (!reduced && distance > DRAG.hopAfter * dt * 60 && pushed.lift === 0 && hop.vy === 0) {
          hop.vy = DRAG.hopSpeed;
          pushed.squash = 0.5;
        }
      }
      if (result.pushed.size > 0) events.settled = true;
    } else if (overlapScore(desk, active, this.world) > 0) {
      // Un objet reposé sur une place prise entre-temps : on l'écarte en
      // premier, les autres ne bougent qu'en dernier recours.
      const arrived = active.filter((id) => !this.lastActive.includes(id));
      if (settleBodies(desk, active, this.world, arrived).length > 0) events.settled = true;
    }
    this.lastActive = [...active];

    // Retombée, rebond et écrasement de tous les corps qui ne sont pas tenus.
    for (const id of BODY_IDS) {
      const body = desk[id];
      const motion = this.motion.get(id)!;
      const resting = motion.vy === 0 && body.lift === 0 && body.tiltX === 0 && body.tiltZ === 0;
      if (session?.id !== id && !resting) {
        if (reduced) {
          body.lift = 0;
          motion.vy = 0;
        } else {
          motion.vy -= DRAG.gravity * dt;
          body.lift += motion.vy * dt;
          if (body.lift <= 0) {
            body.lift = 0;
            if (motion.vy < DRAG.bounceBelow) {
              const impact = -motion.vy;
              motion.vy = impact * DRAG.restitution;
              body.squash = 1;
              events.thuds.push(Math.min(1, impact / 3));
            } else {
              motion.vy = 0;
            }
          }
        }
        const decay = Math.pow(DRAG.tiltDecay, dt * 60);
        body.tiltX = reduced ? 0 : body.tiltX * decay;
        body.tiltZ = reduced ? 0 : body.tiltZ * decay;
        if (Math.abs(body.tiltX) < 1e-4) body.tiltX = 0;
        if (Math.abs(body.tiltZ) < 1e-4) body.tiltZ = 0;
      }
      body.squash = reduced ? 0 : Math.max(0, body.squash - dt * DRAG.squashRate);
    }
    return events;
  }
}
