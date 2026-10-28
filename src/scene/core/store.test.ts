import { describe, expect, it } from 'vitest';
import { SETTLE } from './constants';
import { parseTestParams } from './params';
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
    store.getState().syncArrival(3);
    expect(store.getState().phase).toBe('screen');
    expect(store.getState().hud.carton).toBe(true);
    store.getState().syncArrival(3.1);
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
