import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { getContent, locales, type Locale } from './index';
import { contentSchema, type Content } from './schema';

type Leaf = { path: string; value: string | number | boolean };

const contents: Record<Locale, Content> = { fr, en };

// Toutes les valeurs d'un objet, chacune avec son chemin (« experiences[0].role »).
function leaves(value: unknown, path = ''): Leaf[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ path, value }];
  }
  throw new Error(`valeur inattendue en ${path} : ${String(value)}`);
}

function textLeaves(content: Content) {
  return leaves(content).filter(
    (leaf): leaf is { path: string; value: string } => typeof leaf.value === 'string',
  );
}

// Ce qui ne se traduit pas : identifiants, dates, liens, nombres, booléens.
const untranslatedKeys = new Set(['id', 'start', 'end', 'url', 'email', 'linkedin', 'github']);

function isUntranslated({ path, value }: Leaf) {
  if (typeof value !== 'string') return true;
  const key =
    path
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/, '') ?? '';
  return (
    untranslatedKeys.has(key) ||
    path === 'contact.website' ||
    path === 'profile.name' ||
    /^projects\[\d+\]\.name$/.test(path)
  );
}

describe.each(locales)('contenu %s', (locale) => {
  const content = contents[locale];

  it('respecte le schéma', () => {
    const result = contentSchema.safeParse(content);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it("n'a aucun texte vide", () => {
    const empty = textLeaves(content).filter((leaf) => leaf.value.trim() === '');
    expect(empty.map((leaf) => leaf.path)).toEqual([]);
  });

  it("n'a aucun tiret cadratin ni demi-cadratin", () => {
    const dashed = textLeaves(content).filter((leaf) => /[\u2013\u2014]/.test(leaf.value));
    expect(dashed.map((leaf) => leaf.path)).toEqual([]);
  });

  it('ne donne ni numéro de téléphone ni âge', () => {
    const phone = /(?:\+33|\b0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/;
    const age = /\b\d{2}\s?(?:ans|years? old)\b/i;
    const exposed = textLeaves(content).filter(
      (leaf) => phone.test(leaf.value) || age.test(leaf.value),
    );
    expect(exposed.map((leaf) => leaf.path)).toEqual([]);
  });

  it('est servi tel quel par getContent', () => {
    expect(getContent(locale)).toEqual(content);
  });
});

describe('FR et EN', () => {
  it('ont exactement les mêmes clés, dans le même ordre', () => {
    expect(leaves(en).map((leaf) => leaf.path)).toEqual(leaves(fr).map((leaf) => leaf.path));
  });

  it('partagent les mêmes faits non traduits', () => {
    expect(leaves(en).filter(isUntranslated)).toEqual(leaves(fr).filter(isUntranslated));
  });
});

describe('faits du CV', () => {
  it('garde les dates exactes des expériences', () => {
    expect(fr.experiences.map(({ id, period }) => ({ id, ...period }))).toEqual([
      { id: 'dares', start: '2024-01', end: '2026-06' },
      { id: 'defi-metiers', start: '2020-09', end: '2023-08' },
    ]);
  });

  it('présente Netherbrain et Homelab', () => {
    expect(fr.projects.map((project) => project.id)).toEqual(['netherbrain', 'homelab']);
  });
});

describe('le schéma', () => {
  it('refuse un texte vide', () => {
    const broken = { ...fr, profile: { ...fr.profile, headline: '' } };
    expect(contentSchema.safeParse(broken).success).toBe(false);
  });

  it("refuse un texte entouré d'espaces", () => {
    const broken = { ...fr, profile: { ...fr.profile, headline: ' Développeur ' } };
    expect(contentSchema.safeParse(broken).success).toBe(false);
  });

  it('refuse une période qui finit avant de commencer', () => {
    const [first, ...rest] = fr.experiences;
    const broken = {
      ...fr,
      experiences: [{ ...first, period: { start: '2026-06', end: '2024-01' } }, ...rest],
    };
    expect(contentSchema.safeParse(broken).success).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    const broken = { ...fr, profile: { ...fr.profile, phone: '0600000000' } };
    expect(contentSchema.safeParse(broken).success).toBe(false);
  });
});
