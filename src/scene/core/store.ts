import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  ambientLevel,
  arrivalPhase,
  cameraProgress,
  hudFlags,
  keyboardLedLevel,
  lampFlash,
  lampLevel,
  screenLevel,
  typedChars,
  windowLevel,
  type ArrivalPhase,
  type HudFlags,
} from './arrival';
import type { LifeSigns } from '@/lib/life-signs/types';
import {
  createDeskBodies,
  movedPlaces,
  syncDeskBodies,
  resetDeskBodies,
  type DeskBodies,
  type DeskPlaces,
} from './bodies';
import { createClock, type Clock } from './clock';
import { ARRIVAL, SETTLE, TYPING_END_DEFAULT } from './constants';
import type { BodyId, ItemId, MoodId } from './ids';
import { moodValues, type MoodValues } from './mood-values';
import type { TestDrag, TestParams } from './params';
import { createSilentSound, type SoundPlayer } from './sound';

// L'état partagé de la scène et du HUD (zustand, sans React : le store se
// crée et se teste hors de tout composant). Deux sortes de valeurs :
//
// - l'état réactif (phase, ambiance, objet présenté...) : il change rarement,
//   le HUD et les composants s'y abonnent avec useSceneStore(selector) ;
// - clock et frame : des objets mutables lus à chaque image dans useFrame,
//   avec useSceneStoreApi().getState(). Ne jamais s'y abonner ni les copier
//   dans un état React ; les relire à chaque image (init() remplace clock).

/**
 * D'où vient la demande de présenter un objet : visite automatique, clic dans
 * la scène, puce, étiquette, clavier, fiche (Préc. et Suiv.), adresse (?prendre=).
 */
export type PresentSource = 'auto' | 'click' | 'chip' | 'tag' | 'keyboard' | 'sheet' | 'test';

/** Réglages fixés au démarrage, d'après l'adresse et les préférences du visiteur. */
export interface SceneSettings {
  /** prefers-reduced-motion ou ?reduit : ni arrivée, ni mode auto, ni mouvement de caméra. */
  reducedMotion: boolean;
  /** ?fige : horloge gelée. */
  frozen: boolean;
  /** T de départ (secondes) : ?t=, ou la fin de l'arrivée en mouvement réduit. */
  startAt: number;
  /** Décalage de l'heure du visiteur (?heure=), en ms. */
  hourOffsetMs: number;
  /** Le mode auto peut-il démarrer (ni ?auto=0, ni mouvement réduit) ? */
  autoAllowed: boolean;
  /** Objet présenté d'office (?prendre=). */
  initialPresent: ItemId | null;
  /** ?recto : l'objet de ?prendre= reste à l'endroit. */
  recto: boolean;
  /** ?glisse= : un glisser à jouer dès le départ (partie gestes). */
  initialDrag: TestDrag | null;
  /** ?noshadow et ?nopost, pour les mesures et les machines lentes. */
  noShadow: boolean;
  noPost: boolean;
}

export const DEFAULT_SETTINGS: SceneSettings = {
  reducedMotion: false,
  frozen: false,
  startAt: 0,
  hourOffsetMs: 0,
  autoAllowed: true,
  initialPresent: null,
  recto: false,
  initialDrag: null,
  noShadow: false,
  noPost: false,
};

/** Instant où l'arrivée est finie, en mouvement réduit. */
export const REDUCED_START = SETTLE + 0.6;

export function settingsFromParams(
  params: TestParams,
  prefersReducedMotion: boolean,
  hourOffsetMs = 0,
): SceneSettings {
  const reducedMotion = params.reduced || prefersReducedMotion;
  const t = params.t ?? 0;
  return {
    reducedMotion,
    frozen: params.frozen,
    startAt: reducedMotion ? Math.max(t, REDUCED_START) : t,
    hourOffsetMs,
    autoAllowed: params.auto && !reducedMotion,
    initialPresent: params.present,
    recto: params.recto,
    initialDrag: params.drag,
    noShadow: params.noShadow,
    noPost: params.noPost,
  };
}

/**
 * Valeurs recalculées à chaque image par le socle (ClockDriver), avant tous
 * les autres useFrame. Les parties les lisent ; seules les valeurs marquées
 * « écrit par » sont écrites ailleurs.
 */
export interface FrameState {
  /** Secondes depuis le début de l'arrivée, et durée de l'image. */
  t: number;
  dt: number;
  /** La lampe (0 à 1, un peu plus au scintillement), interrupteur compris. */
  lamp: number;
  /** L'éclat de l'allumage (0 en mouvement réduit). */
  lampFlash: number;
  /** L'écran principal (0 à 1). */
  screen: number;
  /** La LED du clavier (0 à 1). */
  keyboardLed: number;
  /** Caractères tapés à l'écran, sans borne : chaque objet borne à sa longueur. */
  typed: number;
  /** La lumière de la fenêtre (0 à 1). */
  window: number;
  /** La lumière d'ambiance (0 à 1). */
  ambient: number;
  /** La montée de caméra (0 à 1, 1 en mouvement réduit). */
  camera: number;
  /** L'ambiance courante, interpolée pendant les transitions. */
  mood: MoodValues;
  /** La fenêtre est-elle en portrait (largeur / hauteur < 0.9) ? */
  portrait: boolean;
  /** Écrit par les objets : avancement de la présentation de l'objet tenu (0 à 1). */
  presentLevel: number;
  /**
   * Écrit par les objets : T où le code de l'écran est entièrement tapé (sa
   * longueur divisée par ARRIVAL.typingRate). Le clavier du décor s'y cale.
   */
  typingEnd: number;
}

export interface SceneState {
  // --- Réglages et horloge ---
  /** init() a été appelé (côté client, après lecture de l'adresse). */
  initialized: boolean;
  settings: SceneSettings;
  /** Horloge mutable : lire clock.t dans useFrame, jamais s'y abonner. */
  clock: Clock;
  /** Valeurs par image, mutables (voir FrameState). */
  frame: FrameState;
  /**
   * Les corps du plateau (places, soulèvement, inclinaison), mutables : écrits
   * par les gestes à chaque image, lus par les objets et le décor dans
   * useFrame. Le socle cale ceux qui n'ont pas bougé sur leur place de repos
   * du format courant (syncDeskBodies), avant tout le monde.
   */
  desk: DeskBodies;
  /** Le son : play(cue) ne fait rien tant qu'il est coupé (voir sound.ts). */
  sound: SoundPlayer;

  // --- État réactif ---
  /** La scène a dessiné ses premières images. */
  ready: boolean;
  phase: ArrivalPhase;
  hud: HudFlags;
  mood: MoodId;
  /** L'ambiance a été choisie par le visiteur (ou ?ambiance=), pas déduite de son heure. */
  moodPinned: boolean;
  /** La visite automatique est en cours. */
  autoOn: boolean;
  /** L'objet présenté devant la caméra (ou l'écran regardé de près). */
  presented: ItemId | null;
  presentedBy: PresentSource | null;
  /**
   * L'objet présenté a fait son geste (retourné, ouvert, tourné) : vrai dès
   * qu'il est présenté, comme dans le prototype, sauf avec ?recto. Un clic sur
   * l'objet tenu, le bouton « Retourner » ou son raccourci l'inversent.
   */
  flipped: boolean;
  /** Le corps que le visiteur fait glisser (null : aucun glisser en cours). */
  dragging: BodyId | null;
  /** Places des corps déplacés, copiées à la fin de chaque glisser (data-places). */
  places: DeskPlaces;
  /** Le son est ouvert (bouton « Son » du HUD). */
  soundOn: boolean;
  /** Ce qui sort du cadre au repos (identifiants d'objets ou de décor), vu par la caméra. */
  offscreen: readonly string[];
  /** Les signes de vie du coffret (données d'exemple à l'étape 4). */
  lifeSigns: LifeSigns | null;
  /** L'objet sous le pointeur. */
  hovered: ItemId | null;
  /** T de la dernière action du visiteur (-Infinity : aucune ; Infinity : jamais de mode auto). */
  lastUserAt: number;
  /** L'interrupteur de la lampe, et l'instant (T) où elle a été allumée. */
  lamp: { on: boolean; switchedAt: number };
  /** Nombre de « Rejouer » : les parties qui gardent un état d'arrivée s'y abonnent pour le remettre à zéro. */
  replays: number;

  // --- Actions ---
  /** Applique les réglages au démarrage (côté client). */
  init(settings: SceneSettings, mood: MoodId, moodPinned: boolean): void;
  /** Appelée par le socle quand la scène a dessiné. */
  markReady(): void;
  /** Appelée par le socle à chaque image : met phase et hud à jour s'ils changent. */
  syncArrival(t: number): void;
  setMood(mood: MoodId, pinned: boolean): void;
  /** Présente un objet ; toute source autre que 'auto' compte comme une action du visiteur. */
  present(item: ItemId, source: PresentSource): void;
  /** Repose l'objet présenté. */
  putBack(): void;
  /** Retourne l'objet présenté, ou le remet à l'endroit (sans effet sur l'écran). */
  toggleFlip(): void;
  /** Un glisser commence (partie gestes) : compte comme une action du visiteur. */
  startDrag(body: BodyId): void;
  /** Le glisser finit : places reprend les corps déplacés (desk). */
  endDrag(): void;
  /** Recopie dans places les corps déplacés (après une poussée, sans glisser en cours). */
  commitPlaces(): void;
  /** Ouvre ou coupe le son ; appelée seulement par un clic du visiteur. */
  toggleSound(): void;
  /** Réservé au cadrage (partie objets) : ce qui sort du cadre. */
  setOffscreen(ids: readonly string[]): void;
  /** Les signes de vie reçus du serveur (étape 5 : rafraîchis par /api/signes-de-vie). */
  setLifeSigns(signs: LifeSigns | null): void;
  setHovered(item: ItemId | null): void;
  /** Note une action du visiteur : coupe le mode auto et repose ce qu'il tenait. */
  markUser(): void;
  /** Réservé au mode auto (mise en scène). */
  setAutoOn(on: boolean): void;
  toggleLamp(): void;
  /** Rejoue l'arrivée depuis le début ; now en secondes (performance.now() / 1000). */
  replay(now: number): void;
}

export type SceneStore = StoreApi<SceneState>;

function initialFrame(mood: MoodId): FrameState {
  return {
    t: 0,
    dt: 0,
    lamp: 0,
    lampFlash: 0,
    screen: 0,
    keyboardLed: 0,
    typed: 0,
    window: 0,
    ambient: 0,
    camera: 0,
    mood: moodValues(mood),
    portrait: false,
    presentLevel: 0,
    typingEnd: TYPING_END_DEFAULT,
  };
}

/** Recalcule les niveaux de l'arrivée dans frame, d'après l'horloge. */
export function updateFrame(state: SceneState, portrait: boolean): FrameState {
  const { clock, frame, lamp, settings } = state;
  const t = clock.t;
  frame.t = t;
  frame.dt = clock.dt;
  frame.lamp = lampLevel(t, lamp.switchedAt, lamp.on);
  frame.lampFlash = settings.reducedMotion ? 0 : lampFlash(t, lamp.switchedAt, lamp.on);
  frame.screen = screenLevel(t);
  frame.keyboardLed = keyboardLedLevel(t);
  frame.typed = typedChars(t);
  frame.window = windowLevel(t);
  frame.ambient = ambientLevel(t);
  frame.camera = settings.reducedMotion ? 1 : cameraProgress(t);
  frame.portrait = portrait;
  syncDeskBodies(state.desk, portrait);
  return frame;
}

const sameFlags = (a: HudFlags, b: HudFlags) =>
  (Object.keys(a) as (keyof HudFlags)[]).every((key) => a[key] === b[key]);

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export interface SceneStoreOptions {
  /** Le lecteur de sons (DeskShell passe la synthèse WebAudio ; muet par défaut). */
  sound?: SoundPlayer;
  /** Les signes de vie reçus du serveur. */
  lifeSigns?: LifeSigns | null;
}

export function createSceneStore(
  mood: MoodId = 'afternoon',
  options: SceneStoreOptions = {},
): SceneStore {
  const sound = options.sound ?? createSilentSound();
  return createStore<SceneState>()((set, get) => ({
    initialized: false,
    settings: DEFAULT_SETTINGS,
    clock: createClock(),
    frame: initialFrame(mood),
    desk: createDeskBodies(),
    sound,

    ready: false,
    phase: arrivalPhase(0),
    hud: hudFlags(0),
    mood,
    moodPinned: false,
    autoOn: false,
    presented: null,
    presentedBy: null,
    flipped: false,
    dragging: null,
    places: {},
    soundOn: false,
    offscreen: [],
    lifeSigns: options.lifeSigns ?? null,
    hovered: null,
    lastUserAt: -Infinity,
    lamp: { on: true, switchedAt: ARRIVAL.lampOn },
    replays: 0,

    init(settings, nextMood, moodPinned) {
      const { initialPresent, startAt, frozen, recto } = settings;
      set({
        initialized: true,
        settings,
        clock: createClock({ startAt, frozen }),
        phase: arrivalPhase(startAt),
        hud: hudFlags(startAt),
        mood: nextMood,
        moodPinned,
        autoOn: false,
        presented: initialPresent,
        presentedBy: initialPresent ? 'test' : null,
        flipped: initialPresent !== null && !recto,
        // Un objet présenté d'office ou un glisser demandé (capture, test) ne
        // laisse jamais démarrer le mode auto.
        lastUserAt: initialPresent || settings.initialDrag ? Infinity : -Infinity,
      });
    },

    markReady() {
      if (!get().ready) set({ ready: true });
    },

    syncArrival(t) {
      const { phase, hud } = get();
      const nextPhase = arrivalPhase(t);
      const nextHud = hudFlags(t);
      if (nextPhase !== phase || !sameFlags(nextHud, hud)) set({ phase: nextPhase, hud: nextHud });
    },

    setMood(nextMood, pinned) {
      set({ mood: nextMood, moodPinned: pinned });
    },

    present(item, source) {
      if (source !== 'auto') get().markUser();
      const same = get().presented === item;
      if (!same) sound.play(item === 'monitor' ? 'hum' : 'pick');
      set({ presented: item, presentedBy: source, flipped: same ? get().flipped : true });
    },

    putBack() {
      if (get().presented === null) return;
      sound.play('putBack');
      set({ presented: null, presentedBy: null, flipped: false });
    },

    toggleFlip() {
      const { presented, flipped } = get();
      if (presented === null || presented === 'monitor') return;
      // L'objet de la visite passe au visiteur au lieu d'être reposé par markUser.
      if (get().presentedBy === 'auto') set({ presentedBy: 'click' });
      get().markUser();
      sound.play('flip');
      set({ flipped: !flipped });
    },

    startDrag(body) {
      get().markUser();
      sound.play('slide');
      if (get().dragging !== body) set({ dragging: body });
    },

    endDrag() {
      if (get().dragging === null) return;
      set({ dragging: null, places: movedPlaces(get().desk) });
    },

    commitPlaces() {
      set({ places: movedPlaces(get().desk) });
    },

    toggleSound() {
      const next = sound.setEnabled(!get().soundOn);
      set({ soundOn: next });
      if (next) sound.play('blip');
    },

    setOffscreen(ids) {
      if (!sameList(get().offscreen, ids)) set({ offscreen: [...ids] });
    },

    setLifeSigns(signs) {
      set({ lifeSigns: signs });
    },

    setHovered(item) {
      if (get().hovered !== item) set({ hovered: item });
    },

    markUser() {
      const { clock, autoOn, presentedBy, lastUserAt } = get();
      const next: Partial<SceneState> = {};
      if (lastUserAt !== Infinity) next.lastUserAt = clock.t;
      if (autoOn) next.autoOn = false;
      if (presentedBy === 'auto') {
        next.presented = null;
        next.presentedBy = null;
        next.flipped = false;
      }
      set(next);
    },

    setAutoOn(on) {
      if (get().autoOn !== on) set({ autoOn: on });
    },

    toggleLamp() {
      const { lamp, clock } = get();
      sound.play('switch');
      if (!lamp.on) sound.play('lampOn');
      set({ lamp: lamp.on ? { ...lamp, on: false } : { on: true, switchedAt: clock.t } });
    },

    replay(now) {
      const { clock, settings, replays, desk, frame } = get();
      // Les objets déplacés reprennent leur place de repos.
      resetDeskBodies(desk, frame.portrait);
      // En mouvement réduit, rien ne bouge : l'arrivée reste finie.
      const startAt = settings.reducedMotion ? REDUCED_START : 0;
      clock.restart(now, startAt);
      set({
        phase: arrivalPhase(startAt),
        hud: hudFlags(startAt),
        autoOn: false,
        presented: null,
        presentedBy: null,
        flipped: false,
        dragging: null,
        places: {},
        hovered: null,
        lastUserAt: -Infinity,
        lamp: { on: true, switchedAt: ARRIVAL.lampOn },
        replays: replays + 1,
      });
    },
  }));
}
