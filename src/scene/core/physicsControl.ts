import type { DeskBodies, DeskPose } from './bodies';
import type { BodyId } from './ids';

// Le contrat du moteur physique (physics/world.ts, DeskPhysics) vu par ceux
// qui s'en servent : les gestes, le rangement et le moyeu des gestes, qui le
// tient une fois chargé (gestureHub(store).physics). Le noyau ne porte que
// ces types : Rapier reste dans physics/, chargé à part.

/** Ce que le monde signale après avoir avancé. */
export interface PhysicsEvents {
  /** Le bureau vient de se poser : plus aucun corps éveillé (recopier les places). */
  settled: boolean;
  /** Chocs de l'image, de 0 à 1 (le son thud). Réutilisé d'une image à l'autre. */
  thuds: number[];
}

/**
 * Ce que les autres parties peuvent demander au monde (via gestureHub(store).physics) :
 * le glisser, le retour et le rangement.
 */
export interface PhysicsControl {
  /** Le format courant (le bureau resserré en portrait). */
  readonly portrait: boolean;
  /** Le corps glissé, ou null. */
  readonly grabbed: BodyId | null;
  /** Commence un glisser : le corps saisi au point (x, z) du plateau. false s'il n'est pas libre. */
  grab(id: BodyId, x: number, z: number): boolean;
  /** Le point du plateau que vise le pointeur. */
  aim(x: number, z: number): void;
  /** Lâche le corps glissé ; withThrow : il garde son élan (jamais en mouvement réduit). */
  release(withThrow: boolean): void;
  /** Le corps est-il éveillé (il bouge encore) ? */
  isAwake(id: BodyId): boolean;
  /**
   * Reprend un corps en main (retour et rangement) : il ne subit
   * plus rien et se déplace par drive(), jusqu'à handBack(). Sans effet sur
   * le corps glissé ou présenté.
   */
  takeOver(id: BodyId): boolean;
  /** Pose un corps repris en main (pose complète : place, hauteur, orientation). */
  drive(id: BodyId, pose: DeskPose & { qx?: number; qy?: number; qz?: number; qw?: number }): void;
  /** Rend un corps au monde ; asleep : endormi sur place (sa place d'origine). */
  handBack(id: BodyId, asleep: boolean): void;
  /** Remet aussitôt un corps à sa place d'origine, endormi. */
  sendHome(id: BodyId): void;
  /** Quelques pas d'un coup, hors de l'horloge (sous &fige : ?glisse joué en une image). */
  stepMany(desk: DeskBodies, steps: number): PhysicsEvents;
}
