import { bodyObb, type DeskPlace, type Obb } from '../core/bodies';
import type { BodyId } from '../core/ids';

// Le solveur des collisions du plateau, vu de dessus (étape 4) : des
// rectangles orientés (OBB) qui ne se chevauchent pas, ne traversent pas le
// décor et ne sortent pas du plateau. Pur et déterministe, sans three ni
// moteur physique (WASM et workers sont interdits par la CSP).
//
// Principe, une relaxation de positions :
// - le corps glissé avance par petits pas (jamais plus de MAX_STEP), pour ne
//   traverser aucun obstacle même à grande vitesse ;
// - à chaque pas, les recouvrements se résolvent le long de l'axe de plus
//   petite pénétration (axe séparateur) : le corps glissé pousse les autres
//   devant lui (en chaîne, par itérations bornées), les obstacles fixes et
//   les bords repoussent tout le monde ;
// - un pas qui laisserait un recouvrement est refusé et l'état revient en
//   arrière : on essaie alors de glisser le long de l'obstacle (en x seul, en
//   z seul), puis des pas plus courts. Un état sans recouvrement le reste donc
//   toujours : le corps s'arrête contre ce qui le bloque.

/** Les limites du plateau (BOUNDS). */
export interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Le monde fixe : obstacles (décor, pied de l'écran, support du casque) et bords. */
export interface SolverWorld {
  obstacles: readonly Obb[];
  bounds: Bounds;
}

/** Ce que le solveur lit et écrit d'un corps : sa place, et s'il a quitté sa place de repos. */
export interface SolverBody extends DeskPlace {
  moved: boolean;
}

export type SolverBodies = Record<BodyId, SolverBody>;

/** Écart gardé entre deux rectangles après résolution (unités du plateau). */
export const CONTACT_MARGIN = 0.012;
/** Plus grand pas d'un corps glissé : bien moins que la moitié du plus mince des obstacles. */
export const MAX_STEP = 0.12;
/** Itérations de la relaxation à chaque pas (longueur de la chaîne de poussée). */
export const ITERATIONS = 8;
/** Recouvrement toléré par la validation (erreurs d'arrondi). */
const TOLERANCE = 1e-5;
/** Fractions d'un pas refusé qu'on essaie encore, de la plus longue à la plus courte. */
const RETRY_SCALES = [1, 0.25] as const;

/** Une séparation : profondeur, et direction (unitaire) dans laquelle pousser le premier rectangle. */
export interface Separation {
  depth: number;
  nx: number;
  nz: number;
}

const out: Separation = { depth: 0, nx: 0, nz: 0 };

/**
 * Séparation de deux rectangles (théorème de l'axe séparateur, sur les
 * quatre axes des deux rectangles) : null s'ils sont écartés d'au moins
 * margin, sinon la plus petite poussée qui écarte a de b d'autant. Le
 * résultat est un objet partagé : le lire avant l'appel suivant.
 */
export function separate(a: Obb, b: Obb, margin = 0): Separation | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  // Tri grossier : deux cercles qui ne se touchent pas.
  const limit = Math.hypot(a.hw, a.hd) + Math.hypot(b.hw, b.hd) + margin;
  if (dx * dx + dz * dz >= limit * limit) return null;
  const ca = Math.cos(a.ry);
  const sa = Math.sin(a.ry);
  const cb = Math.cos(b.ry);
  const sb = Math.sin(b.ry);
  // Axes locaux (x, puis z) de chaque rectangle, dans le repère du plateau.
  const axes = [ca, -sa, sa, ca, cb, -sb, sb, cb];
  let depth = Infinity;
  let nx = 0;
  let nz = 0;
  for (let i = 0; i < 8; i += 2) {
    const ux = axes[i]!;
    const uz = axes[i + 1]!;
    const ra = a.hw * Math.abs(ca * ux - sa * uz) + a.hd * Math.abs(sa * ux + ca * uz);
    const rb = b.hw * Math.abs(cb * ux - sb * uz) + b.hd * Math.abs(sb * ux + cb * uz);
    const distance = dx * ux + dz * uz;
    const overlap = ra + rb + margin - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      // a s'éloigne de b : à l'opposé de la direction a vers b.
      const sign = distance > 0 ? -1 : 1;
      nx = ux * sign;
      nz = uz * sign;
    }
  }
  out.depth = depth;
  out.nx = nx;
  out.nz = nz;
  return out;
}

/** Demi-étendues d'un rectangle le long de x et de z du plateau. */
function extents(box: Obb): [number, number] {
  const c = Math.abs(Math.cos(box.ry));
  const s = Math.abs(Math.sin(box.ry));
  return [box.hw * c + box.hd * s, box.hw * s + box.hd * c];
}

/** Le déplacement qui ramène un rectangle dans les limites (0, 0 s'il y est). */
export function intoBounds(box: Obb, bounds: Bounds): [number, number] {
  const [ex, ez] = extents(box);
  const dx = Math.max(0, bounds.x0 + ex - box.x) - Math.max(0, box.x + ex - bounds.x1);
  const dz = Math.max(0, bounds.z0 + ez - box.z) - Math.max(0, box.z + ez - bounds.z1);
  return [dx, dz];
}

/** Ce qu'un corps dépasse des limites (0 s'il y est). */
function outside(box: Obb, bounds: Bounds): number {
  const [dx, dz] = intoBounds(box, bounds);
  return Math.abs(dx) + Math.abs(dz);
}

const boxOf = (bodies: SolverBodies, id: BodyId): Obb => bodyObb(id, bodies[id]);

/**
 * La somme des recouvrements entre les corps actifs, avec les obstacles et
 * hors des bords (0 : un état valide). Sert à refuser un pas qui empire les
 * choses, et aux tests.
 */
export function overlapScore(
  bodies: SolverBodies,
  active: readonly BodyId[],
  world: SolverWorld,
): number {
  let score = 0;
  const boxes = active.map((id) => boxOf(bodies, id));
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    for (let j = i + 1; j < boxes.length; j++) {
      const hit = separate(a, boxes[j]!);
      if (hit && hit.depth > TOLERANCE) score += hit.depth;
    }
    for (const obstacle of world.obstacles) {
      const hit = separate(a, obstacle);
      if (hit && hit.depth > TOLERANCE) score += hit.depth;
    }
    const out = outside(a, world.bounds);
    if (out > TOLERANCE) score += out;
  }
  return score;
}

/** Déplace un corps et son rectangle (gardé en cache pendant une relaxation). */
function shift(body: SolverBody, box: Obb, dx: number, dz: number): void {
  body.x += dx;
  body.z += dz;
  box.x += dx;
  box.z += dz;
}

/**
 * Relaxation : écarte les corps actifs les uns des autres, du décor et des
 * bords. pinned (le corps tenu par le visiteur, ou ceux qui doivent rester en
 * place) ne cède pas aux autres corps, qui reculent devant lui ; il cède au
 * décor et aux bords. Chaque corps qui bouge est marqué moved. Renvoie les
 * corps déplacés (sauf pinned).
 */
export function relax(
  bodies: SolverBodies,
  active: readonly BodyId[],
  world: SolverWorld,
  pinned: BodyId | readonly BodyId[] | null = null,
  iterations = ITERATIONS,
): BodyId[] {
  const held = new Set<BodyId>(
    pinned === null ? [] : typeof pinned === 'string' ? [pinned] : pinned,
  );
  const pushed = new Set<BodyId>();
  const boxes = active.map((id) => boxOf(bodies, id));
  const touch = (index: number) => {
    const id = active[index]!;
    bodies[id].moved = true;
    if (!held.has(id)) pushed.add(id);
  };
  for (let iteration = 0; iteration < iterations; iteration++) {
    let changed = false;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const hit = separate(boxes[i]!, boxes[j]!, CONTACT_MARGIN);
        if (!hit) continue;
        const wa = held.has(active[i]!) ? 0 : 1;
        const wb = held.has(active[j]!) ? 0 : 1;
        if (wa + wb === 0) continue;
        const { depth, nx, nz } = hit;
        const ka = (depth * wa) / (wa + wb);
        const kb = (depth * wb) / (wa + wb);
        if (ka > 0) {
          shift(bodies[active[i]!], boxes[i]!, nx * ka, nz * ka);
          touch(i);
        }
        if (kb > 0) {
          shift(bodies[active[j]!], boxes[j]!, -nx * kb, -nz * kb);
          touch(j);
        }
        changed = true;
      }
    }
    for (let i = 0; i < active.length; i++) {
      const body = bodies[active[i]!];
      const box = boxes[i]!;
      for (const obstacle of world.obstacles) {
        const hit = separate(box, obstacle, CONTACT_MARGIN);
        if (!hit) continue;
        shift(body, box, hit.nx * hit.depth, hit.nz * hit.depth);
        touch(i);
        changed = true;
      }
      const [dx, dz] = intoBounds(box, world.bounds);
      if (dx !== 0 || dz !== 0) {
        shift(body, box, dx, dz);
        touch(i);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return [...pushed];
}

/** Le recouvrement d'un seul corps avec les autres corps actifs, le décor et les bords. */
function bodyScore(
  bodies: SolverBodies,
  id: BodyId,
  active: readonly BodyId[],
  world: SolverWorld,
  margin: number,
): number {
  const box = boxOf(bodies, id);
  let score = outside(box, world.bounds);
  for (const other of active) {
    if (other === id) continue;
    const hit = separate(box, boxOf(bodies, other), margin);
    if (hit) score += hit.depth;
  }
  for (const obstacle of world.obstacles) {
    const hit = separate(box, obstacle, margin);
    if (hit) score += hit.depth;
  }
  return score;
}

/**
 * La place libre la plus proche pour un corps (les autres ne bougent pas) :
 * des cercles de plus en plus grands autour de sa place, seize directions
 * chacun, la première où il ne touche rien. Dernier recours quand la
 * relaxation ne suffit pas (un objet reposé sur une place prise). Le corps
 * reste où il est si rien n'est libre.
 */
export function findFreePlace(
  bodies: SolverBodies,
  id: BodyId,
  active: readonly BodyId[],
  world: SolverWorld,
): boolean {
  const body = bodies[id];
  const x0 = body.x;
  const z0 = body.z;
  for (let ring = 0; ring <= 80; ring++) {
    const radius = ring * 0.1;
    const directions = ring === 0 ? 1 : 16;
    for (let k = 0; k < directions; k++) {
      const angle = (k / directions) * Math.PI * 2;
      body.x = x0 + Math.cos(angle) * radius;
      body.z = z0 + Math.sin(angle) * radius;
      if (bodyScore(bodies, id, active, world, CONTACT_MARGIN) === 0) {
        if (ring > 0) body.moved = true;
        return true;
      }
    }
  }
  body.x = x0;
  body.z = z0;
  return false;
}

/**
 * Remet le plateau en ordre sans glisser en cours : relaxation, puis, pour
 * chaque corps encore en recouvrement (d'abord ceux de prefer, l'objet qui
 * vient d'être reposé), la place libre la plus proche. Renvoie les corps
 * déplacés.
 */
export function settleBodies(
  bodies: SolverBodies,
  active: readonly BodyId[],
  world: SolverWorld,
  prefer: readonly BodyId[] = [],
): BodyId[] {
  const initial = snapshot(bodies, active);
  const changed = () =>
    active.filter((id, index) => {
      const [x, z] = initial[index]!;
      return bodies[id].x !== x || bodies[id].z !== z;
    });
  const valid = () => overlapScore(bodies, active, world) === 0;
  const freeEach = (ids: readonly BodyId[]) => {
    for (const id of ids) {
      if (bodyScore(bodies, id, active, world, 0) <= TOLERANCE) continue;
      findFreePlace(bodies, id, active, world);
      if (valid()) return;
    }
  };
  const arrivals = prefer.filter((id) => active.includes(id));
  if (arrivals.length > 0) {
    // D'abord, seuls les nouveaux venus bougent : en les écartant, sinon en
    // leur trouvant une place libre ; les autres corps restent où on les a mis.
    relax(
      bodies,
      active,
      world,
      active.filter((id) => !arrivals.includes(id)),
      ITERATIONS * 2,
    );
    if (valid()) return changed();
    restore(bodies, active, initial);
    freeEach(arrivals);
    if (valid()) return changed();
  }
  // Puis tout le monde, et une place libre en dernier recours.
  relax(bodies, active, world, null, ITERATIONS * 2);
  if (!valid()) freeEach(active);
  return changed();
}

/** Ce qu'a donné un déplacement du corps glissé. */
export interface MoveResult {
  /** Le corps n'est pas allé jusqu'où on le demandait (il bute). */
  blocked: boolean;
  /** Distance parcourue. */
  travelled: number;
  /** Les corps poussés, et de combien chacun a bougé. */
  pushed: Map<BodyId, number>;
}

type Snapshot = [number, number, boolean][];

function snapshot(bodies: SolverBodies, active: readonly BodyId[]): Snapshot {
  return active.map((id) => [bodies[id].x, bodies[id].z, bodies[id].moved]);
}

function restore(bodies: SolverBodies, active: readonly BodyId[], saved: Snapshot): void {
  active.forEach((id, index) => {
    const [x, z, moved] = saved[index]!;
    bodies[id].x = x;
    bodies[id].z = z;
    bodies[id].moved = moved;
  });
}

/**
 * Essaie un pas (dx, dz) du corps id : le pousse, relaxe, et garde le
 * résultat seulement s'il ne crée aucun recouvrement de plus. Renvoie le
 * pas accepté, ou null.
 */
function tryStep(
  bodies: SolverBodies,
  id: BodyId,
  dx: number,
  dz: number,
  active: readonly BodyId[],
  world: SolverWorld,
  before: number,
): BodyId[] | null {
  const saved = snapshot(bodies, active);
  bodies[id].x += dx;
  bodies[id].z += dz;
  const pushed = relax(bodies, active, world, id);
  if (overlapScore(bodies, active, world) <= before + TOLERANCE) return pushed;
  restore(bodies, active, saved);
  return null;
}

/** Rayon du cercle qui contient un rectangle. */
const reach = (box: Obb) => Math.hypot(box.hw, box.hd);

/**
 * Ce qu'un pas de longueur step du corps id peut toucher : de proche en
 * proche, les corps qu'il peut pousser (et ceux qu'ils peuvent pousser), et
 * les obstacles à leur portée. Le reste du plateau ne bouge pas : inutile de
 * le relaxer ni de le vérifier.
 */
export function neighborhood(
  bodies: SolverBodies,
  id: BodyId,
  step: number,
  active: readonly BodyId[],
  world: SolverWorld,
): { active: BodyId[]; world: SolverWorld } {
  // Une poussée ne déplace pas plus loin que le pas (plus la marge) : on en prend le double.
  const pad = 2 * step + 4 * CONTACT_MARGIN;
  const boxes = new Map(active.map((other) => [other, boxOf(bodies, other)]));
  const near: BodyId[] = [id];
  const close = (a: Obb, b: Obb) => Math.hypot(a.x - b.x, a.z - b.z) < reach(a) + reach(b) + pad;
  for (let i = 0; i < near.length; i++) {
    const member = boxes.get(near[i]!) ?? boxOf(bodies, near[i]!);
    for (const other of active) {
      if (near.includes(other)) continue;
      if (close(member, boxes.get(other)!)) near.push(other);
    }
  }
  const members = near.map((member) => boxes.get(member) ?? boxOf(bodies, member));
  return {
    active: near,
    world: {
      obstacles: world.obstacles.filter((obstacle) => members.some((box) => close(box, obstacle))),
      bounds: world.bounds,
    },
  };
}

/**
 * Amène le corps id vers (tx, tz), par pas de MAX_STEP au plus, en poussant
 * les autres corps actifs et en butant sur le décor et les bords. active :
 * les corps posés sur le plateau (un objet présenté devant la caméra n'y est
 * pas) ; id doit y être. Le corps est marqué moved.
 */
export function moveBody(
  bodies: SolverBodies,
  id: BodyId,
  tx: number,
  tz: number,
  active: readonly BodyId[],
  world: SolverWorld,
): MoveResult {
  const body = bodies[id];
  const pushed = new Map<BodyId, number>();
  const start = snapshot(bodies, active);
  const startX = body.x;
  const startZ = body.z;
  const wantX = tx - body.x;
  const wantZ = tz - body.z;
  const length = Math.hypot(wantX, wantZ);
  if (!Number.isFinite(length)) return { blocked: true, travelled: 0, pushed };
  body.moved = true;
  let blocked = false;
  const steps = Math.max(1, Math.ceil(length / MAX_STEP));
  const stepX = wantX / steps;
  const stepZ = wantZ / steps;
  for (let step = 0; step < steps; step++) {
    // Seuls les corps et obstacles à portée de ce pas comptent.
    const near = neighborhood(bodies, id, Math.hypot(stepX, stepZ), active, world);
    const before = overlapScore(bodies, near.active, near.world);
    let accepted: BodyId[] | null = null;
    let full = false;
    for (const scale of RETRY_SCALES) {
      const sx = stepX * scale;
      const sz = stepZ * scale;
      accepted = tryStep(bodies, id, sx, sz, near.active, near.world, before);
      if (accepted) {
        full = scale === 1;
        break;
      }
      // Glisser le long de ce qui bloque : la composante libre seule.
      if (sx !== 0) accepted = tryStep(bodies, id, sx, 0, near.active, near.world, before);
      if (!accepted && sz !== 0) {
        accepted = tryStep(bodies, id, 0, sz, near.active, near.world, before);
      }
      if (accepted) break;
    }
    if (!full) blocked = true;
    if (!accepted) break;
  }
  // Si le corps a été repoussé par le décor ou les bords, il bute aussi.
  if (Math.hypot(tx - body.x, tz - body.z) > 1e-3) blocked = true;
  active.forEach((other, index) => {
    if (other === id) return;
    const [x, z] = start[index]!;
    const distance = Math.hypot(bodies[other].x - x, bodies[other].z - z);
    if (distance > 1e-6) pushed.set(other, distance);
  });
  return { blocked, travelled: Math.hypot(body.x - startX, body.z - startZ), pushed };
}
