import { describe, expect, it } from 'vitest';
import { clientKey, createMemoryRateLimiter } from './rate-limit';

const MINUTE = 60_000;

describe('limite de débit en mémoire', () => {
  it('permet 5 envois par 10 minutes et par IP, puis dit quand réessayer', () => {
    const limiter = createMemoryRateLimiter();
    for (let i = 0; i < 5; i++) expect(limiter.hit('1.2.3.4', i * MINUTE).ok).toBe(true);
    const refused = limiter.hit('1.2.3.4', 5 * MINUTE);
    expect(refused).toEqual({ ok: false, retryAfterSeconds: 300 });
    // Une autre IP n'est pas touchée.
    expect(limiter.hit('5.6.7.8', 5 * MINUTE).ok).toBe(true);
    // La fenêtre glisse : le premier envoi sort à 10 minutes.
    expect(limiter.hit('1.2.3.4', 10 * MINUTE).ok).toBe(true);
    expect(limiter.hit('1.2.3.4', 10 * MINUTE + 1).ok).toBe(false);
  });

  it('plafonne toute l’instance, toutes IP confondues', () => {
    const limiter = createMemoryRateLimiter({ global: { max: 3, windowMs: 60 * MINUTE } });
    expect(limiter.hit('a', 0).ok).toBe(true);
    expect(limiter.hit('b', 1).ok).toBe(true);
    expect(limiter.hit('c', 2).ok).toBe(true);
    expect(limiter.hit('d', 3)).toEqual({ ok: false, retryAfterSeconds: 3600 });
    expect(limiter.hit('d', 60 * MINUTE).ok).toBe(true);
  });

  it('un refus ne compte pas comme un envoi', () => {
    const limiter = createMemoryRateLimiter({ perKey: { max: 1, windowMs: MINUTE } });
    expect(limiter.hit('a', 0).ok).toBe(true);
    for (let i = 1; i < 10; i++) expect(limiter.hit('a', i).ok).toBe(false);
    expect(limiter.hit('a', MINUTE).ok).toBe(true);
  });

  it('borne la taille de sa table et purge les entrées expirées', () => {
    const limiter = createMemoryRateLimiter({
      perKey: { max: 5, windowMs: MINUTE },
      global: { max: 1_000_000, windowMs: MINUTE },
      maxKeys: 100,
    });
    for (let i = 0; i < 100; i++) limiter.hit(`ip-${i}`, 0);
    expect(limiter.size()).toBe(100);
    // Toutes expirées : la purge vide la table avant d'ajouter la nouvelle.
    limiter.hit('nouvelle', MINUTE);
    expect(limiter.size()).toBe(1);
    // Encore valides : les plus anciennes partent, la table reste bornée.
    for (let i = 0; i < 250; i++) limiter.hit(`ip-${i}`, MINUTE + 1);
    expect(limiter.size()).toBeLessThanOrEqual(100);
  });
});

describe('IP du visiteur', () => {
  it('prend le premier élément de x-forwarded-for, puis x-real-ip, puis « inconnu »', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientKey(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientKey(new Headers())).toBe('inconnu');
  });
});
