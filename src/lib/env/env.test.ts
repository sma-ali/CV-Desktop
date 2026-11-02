import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readContactConfig, readRateLimitMax } from './server';
import { loadSharedKeys, parseEnvFile } from './shared-keys';

// Des valeurs factices seulement : ces tests ne lisent jamais le vrai dossier
// des clés (CLES_DIR et dir pointent sur un dossier temporaire).

describe('fichier .env', () => {
  it('lit noms, guillemets, export et commentaires', () => {
    const values = parseEnvFile(
      [
        '# commentaire',
        'MAILJET_API_KEY=abc123',
        'export CONTACT_TO="boite@exemple.fr"',
        "CONTACT_FROM='site@exemple.fr'",
        'MAILJET_API_SECRET=def456 # note',
        'ligne illisible',
        '',
      ].join('\n'),
    );
    expect(Object.fromEntries(values)).toEqual({
      MAILJET_API_KEY: 'abc123',
      CONTACT_TO: 'boite@exemple.fr',
      CONTACT_FROM: 'site@exemple.fr',
      MAILJET_API_SECRET: 'def456',
    });
  });
});

describe('dossier des clés communes', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cles-'));
    writeFileSync(
      join(dir, 'mailjet.env'),
      'MAILJET_API_KEY=factice\nMAILJET_API_SECRET=factice2\n',
    );
    writeFileSync(join(dir, 'autre.env'), 'AUTRE_SERVICE_KEY=ne-pas-prendre\nCONTACT_TO=a@b.fr\n');
    writeFileSync(join(dir, 'notes.txt'), 'CONTACT_FROM=ignore@b.fr\n');
    mkdirSync(join(dir, 'sauvegardes.env'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('complète env avec les seules variables connues, sans écraser', () => {
    const env: Record<string, string | undefined> = { MAILJET_API_KEY: 'deja-posee' };
    const added = loadSharedKeys({ env, dir });
    expect(added.sort()).toEqual(['CONTACT_TO', 'MAILJET_API_SECRET']);
    expect(env.MAILJET_API_KEY).toBe('deja-posee');
    expect(env.MAILJET_API_SECRET).toBe('factice2');
    expect(env.AUTRE_SERVICE_KEY).toBeUndefined();
    expect(env.CONTACT_FROM).toBeUndefined();
  });

  it('suit CLES_DIR', () => {
    const env: Record<string, string | undefined> = { CLES_DIR: dir };
    expect(loadSharedKeys({ env })).toContain('MAILJET_API_KEY');
  });

  it('ne lit rien sur Vercel ni dans un dossier absent', () => {
    expect(loadSharedKeys({ env: { VERCEL: '1' }, dir })).toEqual([]);
    expect(loadSharedKeys({ env: {}, dir: '/nonexistent' })).toEqual([]);
  });
});

describe('configuration de l’envoi', () => {
  const complete = {
    CONTACT_TO: 'boite@exemple.fr',
    CONTACT_FROM: 'site@exemple.fr',
    MAILJET_API_KEY: 'k',
    MAILJET_API_SECRET: 's',
  };

  it('choisit Mailjet quand tout est là', () => {
    expect(readContactConfig(complete)).toEqual({
      mode: 'mailjet',
      to: 'boite@exemple.fr',
      from: 'site@exemple.fr',
      apiKey: 'k',
      apiSecret: 's',
    });
  });

  it('passe en dry run avec CONTACT_DRY_RUN=1, même sans clés', () => {
    expect(readContactConfig({ CONTACT_DRY_RUN: '1' })).toEqual({ mode: 'dry-run' });
    expect(readContactConfig({ CONTACT_DRY_RUN: '1', CONTACT_TO: 'pas une adresse' })).toEqual({
      mode: 'dry-run',
    });
    expect(readContactConfig({ ...complete, CONTACT_DRY_RUN: '0' }).mode).toBe('mailjet');
  });

  it('nomme les variables absentes ou invalides, jamais leurs valeurs', () => {
    expect(readContactConfig({ CONTACT_TO: 'boite@exemple.fr', MAILJET_API_KEY: '' })).toEqual({
      mode: 'unavailable',
      problems: ['CONTACT_FROM', 'MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    });
    const invalid = readContactConfig({ ...complete, CONTACT_TO: 'secret-pas-une-adresse' });
    expect(invalid).toEqual({ mode: 'unavailable', problems: ['CONTACT_TO'] });
    expect(JSON.stringify(invalid)).not.toContain('secret');
  });

  it('lit le maximum par IP, 5 par défaut', () => {
    expect(readRateLimitMax({})).toBe(5);
    expect(readRateLimitMax({ CONTACT_RATE_LIMIT_MAX: '200' })).toBe(200);
    expect(readRateLimitMax({ CONTACT_RATE_LIMIT_MAX: 'beaucoup' })).toBe(5);
    expect(readRateLimitMax({ CONTACT_RATE_LIMIT_MAX: '0' })).toBe(5);
  });
});
