import { describe, expect, it } from 'vitest';
import { SETTLE } from './constants';
import { parseTestParams } from './params';
import { sampleLifeSigns } from '@/lib/life-signs/sample';
import { homePlace, homePose } from './bodies';
import { createSilentSound } from './sound';
import { DROP } from './constants';
import { dropStart, DROP_END, DROP_ORDER } from './drop';
import { createSceneStore, REDUCED_START, settingsFromParams, updateFrame } from './store';

function started(search = '', reduced = false) {
  const store = createSceneStore();
  store.getState().init(settingsFromParams(parseTestParams(search), reduced), 'afternoon', false);
  return store;
}

describe('les réglages', () => {
  it('sautent la fin de l’arrivée en mouvement réduit et coupent le mode auto', () => {
    const settings = settingsFromParams(parseTestParams(''), true);
    expect(settings).toMatchObject({
      reducedMotion: true,
      startAt: REDUCED_START,
      autoAllowed: false,
    });
    expect(REDUCED_START).toBeGreaterThan(SETTLE);
  });

  it('suivent ?t=, ?fige et ?auto=0', () => {
    expect(settingsFromParams(parseTestParams('?t=4000&fige&auto=0'), false)).toMatchObject({
      startAt: 4,
      frozen: true,
      autoAllowed: false,
    });
  });
});

describe('le store de la scène', () => {
  it('démarre dans le noir, sans objet présenté', () => {
    const state = started().getState();
    expect(state).toMatchObject({
      initialized: true,
      ready: false,
      phase: 'dark',
      presented: null,
      autoOn: false,
    });
  });

  it('met la phase et le HUD à jour seulement quand ils changent', () => {
    const store = started();
    let changes = 0;
    store.subscribe(() => (changes += 1));
    store.getState().syncArrival(0.5);
    expect(changes).toBe(0);
    store.getState().syncArrival(4);
    expect(store.getState().phase).toBe('screen');
    expect(store.getState().hud.carton).toBe(true);
    store.getState().syncArrival(4.1);
    expect(changes).toBe(1);
  });

  it('présente un objet, et une action du visiteur coupe la visite', () => {
    const store = started();
    store.getState().setAutoOn(true);
    store.getState().present('book', 'auto');
    expect(store.getState()).toMatchObject({
      presented: 'book',
      presentedBy: 'auto',
      autoOn: true,
    });
    store.getState().present('card', 'chip');
    expect(store.getState()).toMatchObject({
      presented: 'card',
      presentedBy: 'chip',
      autoOn: false,
    });
    store.getState().putBack();
    expect(store.getState().presented).toBeNull();
  });

  it('repose l’objet de la visite quand le visiteur agit', () => {
    const store = started();
    store.getState().setAutoOn(true);
    store.getState().present('laptop', 'auto');
    store.getState().markUser();
    expect(store.getState()).toMatchObject({ presented: null, autoOn: false });
  });

  it('présente l’objet de ?prendre= et ne lance jamais la visite ensuite', () => {
    const store = started('?prendre=chest');
    expect(store.getState()).toMatchObject({ presented: 'chest', presentedBy: 'test' });
    expect(store.getState().lastUserAt).toBe(Infinity);
  });

  it('rejoue l’arrivée depuis le début', () => {
    const store = started('?t=11000&fige');
    store.getState().present('book', 'click');
    store.getState().replay(500);
    const state = store.getState();
    expect(state).toMatchObject({ phase: 'dark', presented: null, replays: 1 });
    expect(state.clock.frozen).toBe(false);
    state.clock.tick(502);
    expect(state.clock.t).toBe(2);
  });

  it('calcule les niveaux de l’image', () => {
    const store = started('?t=11000');
    const state = store.getState();
    state.clock.tick(1);
    const frame = updateFrame(state, true);
    expect(frame).toMatchObject({
      t: 11,
      lamp: 1,
      screen: 1,
      window: 1,
      camera: 1,
      portrait: true,
    });
  });

  it('éteint et rallume la lampe', () => {
    const store = started('?t=11000');
    store.getState().clock.tick(1);
    store.getState().toggleLamp();
    expect(updateFrame(store.getState(), false).lamp).toBe(0);
    store.getState().toggleLamp();
    expect(store.getState().lamp).toEqual({ on: true, switchedAt: 11 });
  });
});

describe('les gestes dans le store (étape 4)', () => {
  function withSound(search = '') {
    const sound = createSilentSound();
    const store = createSceneStore('afternoon', { sound });
    store.getState().init(settingsFromParams(parseTestParams(search), false), 'afternoon', false);
    return { store, sound };
  }

  it('présente un objet retourné, comme le prototype, sauf avec ?recto', () => {
    const store = started('?prendre=card');
    expect(store.getState().flipped).toBe(true);
    expect(started('?prendre=card&recto').getState().flipped).toBe(false);
    store.getState().putBack();
    expect(store.getState().flipped).toBe(false);
    store.getState().present('book', 'click');
    expect(store.getState().flipped).toBe(true);
  });

  it('retourne l’objet tenu et le remet à l’endroit, jamais l’écran', () => {
    const store = started();
    store.getState().toggleFlip();
    expect(store.getState().flipped).toBe(false);
    store.getState().present('badge', 'click');
    store.getState().toggleFlip();
    expect(store.getState()).toMatchObject({ presented: 'badge', flipped: false });
    store.getState().toggleFlip();
    expect(store.getState().flipped).toBe(true);
    // Présenter de nouveau le même objet ne le retourne pas.
    store.getState().toggleFlip();
    store.getState().present('badge', 'keyboard');
    expect(store.getState().flipped).toBe(false);
    // L'écran n'a pas de geste : jamais retourné, même après toggleFlip.
    store.getState().present('monitor', 'click');
    expect(store.getState().flipped).toBe(false);
    store.getState().toggleFlip();
    expect(store.getState().flipped).toBe(false);
  });

  it('garde l’objet de la visite quand le visiteur le retourne', () => {
    const store = started();
    store.getState().setAutoOn(true);
    store.getState().present('book', 'auto');
    store.getState().toggleFlip();
    expect(store.getState()).toMatchObject({
      presented: 'book',
      presentedBy: 'click',
      flipped: false,
      autoOn: false,
    });
  });

  it('suit un glisser et retient les places des objets déplacés', () => {
    const store = started('?t=11000');
    store.getState().setAutoOn(true);
    store.getState().startDrag('laptop');
    expect(store.getState()).toMatchObject({ dragging: 'laptop', autoOn: false });
    const { desk } = store.getState();
    desk.laptop.x = -0.3;
    desk.laptop.moved = true;
    expect(store.getState().places).toEqual({});
    store.getState().endDrag();
    expect(store.getState().dragging).toBeNull();
    expect(store.getState().places).toEqual({
      laptop: { x: -0.3, z: desk.laptop.z, ry: desk.laptop.ry },
    });
    // Poussé par un autre, le livre bouge aussi : commitPlaces le recopie.
    desk.book.moved = true;
    store.getState().commitPlaces();
    expect(Object.keys(store.getState().places)).toEqual(['book', 'laptop']);
  });

  it('remet tout en place à Rejouer', () => {
    const store = started('?t=11000');
    const { desk } = store.getState();
    desk.card.x = 3;
    desk.card.moved = true;
    store.getState().startDrag('card');
    store.getState().endDrag();
    store.getState().replay(10);
    expect(store.getState()).toMatchObject({ places: {}, dragging: null, flipped: false });
    expect(store.getState().desk.card).toMatchObject({ ...homePlace('card', false), moved: false });
  });

  it('cale les objets non déplacés sur leur place du format courant', () => {
    const store = started('?t=11000');
    const state = store.getState();
    state.desk.chest.x = 0;
    updateFrame(state, true);
    expect(state.desk.chest).toMatchObject(homePlace('chest', true));
  });

  it('fait tomber les objets un à un pendant l’arrivée, puis les laisse à leur place', () => {
    const store = started('?t=0&fige');
    const state = store.getState();
    const at = (t: number) => {
      state.clock.restart(0, t);
      updateFrame(state, false);
    };
    at(dropStart(0) - 0.01);
    expect(state.desk.book.waiting).toBe(true);
    at(dropStart(0) + DROP.fall / 2);
    expect(state.desk.book.waiting).toBe(false);
    expect(state.desk.book.y).toBeGreaterThan(homePose('book', false).y + 0.5);
    expect(state.desk.lamp.waiting).toBe(true);
    expect(state.desk.headset.waiting).toBe(false);
    at(DROP_END);
    for (const id of DROP_ORDER) {
      expect(state.desk[id].waiting, id).toBe(false);
      expect(state.desk[id], id).toMatchObject(homePlace(id, false));
    }
  });

  it('ne fait rien tomber en mouvement réduit', () => {
    const store = started('?fige', true);
    const state = store.getState();
    state.clock.restart(0, dropStart(0) + 0.1);
    updateFrame(state, false);
    expect(state.desk.book.waiting).toBe(false);
    expect(state.desk.book).toMatchObject(homePlace('book', false));
  });

  it('reste muet tant que le son n’est pas ouvert, puis joue chaque geste', () => {
    const { store, sound } = withSound();
    store.getState().present('book', 'click');
    store.getState().toggleFlip();
    store.getState().putBack();
    expect(sound.played).toEqual([]);
    expect(store.getState().soundOn).toBe(false);
    store.getState().setSound(true);
    expect(store.getState().soundOn).toBe(true);
    store.getState().present('card', 'click');
    store.getState().toggleFlip();
    store.getState().putBack();
    store.getState().toggleLamp();
    store.getState().startDrag('mug');
    expect(sound.played).toEqual(['pick', 'flip', 'putBack', 'switch', 'slide']);
    store.getState().setSound(false);
    store.getState().present('monitor', 'click');
    expect(sound.played).toHaveLength(5);
  });

  it('note ce qui sort du cadre seulement quand cela change', () => {
    const store = started();
    let changes = 0;
    store.subscribe(() => (changes += 1));
    store.getState().setOffscreen(['chest', 'mic']);
    store.getState().setOffscreen(['chest', 'mic']);
    expect(changes).toBe(1);
    expect(store.getState().offscreen).toEqual(['chest', 'mic']);
  });

  it('reçoit les signes de vie du serveur', () => {
    const signs = sampleLifeSigns(Date.UTC(2026, 9, 28));
    const store = createSceneStore('afternoon', { lifeSigns: signs });
    expect(store.getState().lifeSigns).toBe(signs);
    store.getState().setLifeSigns(null);
    expect(store.getState().lifeSigns).toBeNull();
  });

  it('ne lance jamais la visite avec ?glisse', () => {
    const store = started('?glisse');
    expect(store.getState().settings.initialDrag).toEqual({ item: 'laptop', x: -0.3, z: 2.15 });
    expect(store.getState().lastUserAt).toBe(Infinity);
  });
});
