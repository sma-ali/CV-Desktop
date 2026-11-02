import { describe, expect, it } from 'vitest';
import {
  clientKey,
  createMemoryRateLimiter,
  DEFAULT_GLOBAL,
  DEFAULT_GLOBAL_DAILY,
  DEFAULT_PER_KEY_HOURLY,
  defaultWindows,
  normalizeIp,
} from './rate-limit';

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

  it('limite aussi une IP à 10 envois par heure', () => {
    const limiter = createMemoryRateLimiter();
    // 5 envois toutes les 10 minutes et une seconde : jamais 5 dans une fenêtre de 10 minutes.
    const step = 10 * MINUTE + 1000;
    for (let i = 0; i < 10; i++) {
      const at = Math.floor(i / 5) * step + (i % 5);
      expect(limiter.hit('1.2.3.4', at).ok, `envoi ${i}`).toBe(true);
    }
    const refused = limiter.hit('1.2.3.4', 2 * step);
    expect(refused.ok).toBe(false);
    // Le premier envoi sort de l'heure à 60 minutes.
    expect(refused).toEqual({
      ok: false,
      retryAfterSeconds: Math.ceil((60 * MINUTE - 2 * step) / 1000),
    });
    expect(DEFAULT_PER_KEY_HOURLY.max).toBeLessThan(DEFAULT_GLOBAL.max);
  });

  it('une seule IP ne vide plus le plafond de l’instance', () => {
    const limiter = createMemoryRateLimiter();
    let accepted = 0;
    // Une IP qui envoie toutes les 2 minutes pendant une heure.
    for (let t = 0; t < 60 * MINUTE; t += 2 * MINUTE) if (limiter.hit('1.2.3.4', t).ok) accepted++;
    expect(accepted).toBe(DEFAULT_PER_KEY_HOURLY.max);
    // Un autre visiteur passe encore.
    expect(limiter.hit('203.0.113.7', 60 * MINUTE - 1).ok).toBe(true);
  });

  it('plafonne l’instance à 100 envois par jour', () => {
    const limiter = createMemoryRateLimiter({ perKey: { max: 1000, windowMs: MINUTE } });
    let accepted = 0;
    for (let i = 0; i < 200; i++) if (limiter.hit(`ip-${i}`, i * 3 * MINUTE).ok) accepted++;
    // 200 envois espacés de 3 minutes, sur 10 heures : 20 par heure, mais 100 par jour au plus.
    expect(accepted).toBe(DEFAULT_GLOBAL_DAILY.max);
  });

  it('relève toutes les limites avec le maximum des tests de bout en bout', () => {
    const windows = defaultWindows(1000);
    for (const window of [...windows.perKey, ...windows.global]) expect(window.max).toBe(1000);
    expect(defaultWindows().perKey[0]).toEqual({ max: 5, windowMs: 10 * MINUTE });
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

  it('ramène une IPv6 à son préfixe /64', () => {
    const key = (ip: string) => clientKey(new Headers({ 'x-forwarded-for': ip }));
    expect(key('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(key('2001:db8::30')).toBe(key('2001:db8::1'));
    expect(key('2001:0DB8:0000:0000:ffff:1:2:3')).toBe('2001:db8:0:0::/64');
    expect(key('2001:db8:0:1::1')).not.toBe(key('2001:db8::1'));
    expect(key('[2001:db8:aa:bb:cc::1]')).toBe('2001:db8:aa:bb::/64');
    expect(key('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(key('::1')).toBe('0:0:0:0::/64');
  });

  it('garde une IPv4, même transcrite en IPv6', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('64:ff9b::203.0.113.7')).toBe('64:ff9b:0:0::/64');
  });

  it('laisse telle quelle une valeur illisible', () => {
    expect(normalizeIp('pas:une:ip')).toBe('pas:une:ip');
    expect(normalizeIp('1::2::3')).toBe('1::2::3');
  });

  it('une IPv6 qui tourne dans son /64 garde la même limite', () => {
    const limiter = createMemoryRateLimiter();
    const results = Array.from(
      { length: 6 },
      (_, i) =>
        limiter.hit(clientKey(new Headers({ 'x-forwarded-for': `2001:db8::${i + 1}` })), i).ok,
    );
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});
