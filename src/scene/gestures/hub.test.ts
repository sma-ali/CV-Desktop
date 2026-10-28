import { describe, expect, it } from 'vitest';
import { createSceneStore } from '../core/store';
import { gestureHub, GestureHub } from './hub';

// L'appui en cours, partagé par le canvas et l'objet sous le pointeur.

describe('GestureHub', () => {
  it('un par store, donc un par page', () => {
    const a = createSceneStore();
    const b = createSceneStore();
    expect(gestureHub(a)).toBe(gestureHub(a));
    expect(gestureHub(a)).not.toBe(gestureHub(b));
  });

  it('garde le corps désigné par l’objet pour le même appui', () => {
    const hub = new GestureHub();
    hub.down(1, 'mouse', 100, 200);
    hub.claim(1, 'mouse', 100, 200, 'book');
    expect(hub.press).toMatchObject({ pointerId: 1, x: 100, y: 200, body: 'book', travel: 0 });
  });

  it('remplace un appui resté en plan (relâché hors de la fenêtre)', () => {
    const hub = new GestureHub();
    hub.claim(1, 'mouse', 100, 200, 'book');
    hub.press!.travel = 3;
    hub.down(1, 'mouse', 400, 300);
    expect(hub.press).toMatchObject({ x: 400, y: 300, body: null, travel: 0 });
  });

  it('ignore un second doigt pendant un glisser', () => {
    const hub = new GestureHub();
    hub.claim(1, 'touch', 100, 200, 'card');
    hub.down(2, 'touch', 300, 300, true);
    expect(hub.press).toMatchObject({ pointerId: 1, body: 'card' });
  });

  it('oublie le clic à avaler au prochain appui', () => {
    const hub = new GestureHub();
    hub.swallowClick = true;
    hub.down(1, 'mouse', 0, 0);
    expect(hub.swallowClick).toBe(false);
  });
});
