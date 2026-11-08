import { describe, expect, it } from 'vitest';
import { formatMonthPeriod, periodText } from '@/lib/dates';
import { SHEET_ORDER } from '@/scene/core/ids';
import { en } from '../en';
import { fr } from '../fr';
import type { Locale } from '../locales';
import type { Content } from '../schema';
import { sheetsEn } from './en';
import { sheetsFr } from './fr';
import { sheetsSchema, type SheetsContent } from './schema';

// Les fiches disent ce que dit le CV : chaque valeur est comparée au contenu,
// pour qu'un changement du CV se voie ici.

const cases: [Locale, Content, SheetsContent][] = [
  ['fr', fr, sheetsFr],
  ['en', en, sheetsEn],
];

function experience(content: Content, id: string) {
  const found = content.experiences.find((entry) => entry.id === id);
  if (!found) throw new Error(`expérience absente : ${id}`);
  return found;
}

function project(content: Content, id: string) {
  const found = content.projects.find((entry) => entry.id === id);
  if (!found) throw new Error(`projet absent : ${id}`);
  return found;
}

const period = (content: Content, id: string, locale: Locale) =>
  periodText(formatMonthPeriod(experience(content, id).period, locale));

/** Tout le texte du CV où une valeur de fiche peut être reprise. */
function cvText(content: Content): string {
  const { profile, contact } = content;
  return [
    profile.name,
    profile.headline,
    profile.summary,
    profile.location,
    profile.availability,
    contact.email,
    contact.linkedin,
    ...content.experiences.flatMap((entry) => [
      entry.role,
      entry.organization,
      entry.organizationDetail,
      ...entry.highlights,
    ]),
    ...content.projects.flatMap((entry) => [
      entry.name,
      entry.tagline,
      String(entry.year),
      ...entry.highlights,
    ]),
    ...content.skills.flatMap((group) => [group.label, ...group.items]),
  ]
    .join('\n')
    .toLowerCase();
}

describe.each(cases)('fiches %s', (locale, content, sheets) => {
  const { items } = sheets;

  it('respectent le schéma', () => {
    expect(sheetsSchema.safeParse(sheets).error?.issues ?? []).toEqual([]);
  });

  it('sont celles du contenu', () => {
    expect(content.sheets).toBe(sheets);
  });

  it('couvrent chaque objet, dans l’ordre des fiches', () => {
    expect(Object.keys(items)).toEqual([...SHEET_ORDER]);
  });

  it('datent les postes au mois près, comme la version express', () => {
    for (const id of ['book', 'badge'] as const) {
      expect(items[id].kicker).toBe(period(content, 'defi-metiers', locale));
    }
    for (const id of ['postit', 'headset'] as const) {
      expect(items[id].kicker).toBe(period(content, 'dares', locale));
    }
    expect(items.book.title).toBe(experience(content, 'defi-metiers').role);
    expect(items.postit.title).toBe(experience(content, 'dares').role);
    expect(items.book.meta[0]?.value).toBe(experience(content, 'defi-metiers').organization);
    expect(items.postit.meta[0]?.value).toBe(experience(content, 'dares').organization);
  });

  it('présentent Netherbrain et Homelab tels quels', () => {
    for (const id of ['netherbrain', 'homelab'] as const) {
      const entry = project(content, id);
      expect(items[id].title).toBe(entry.name);
      expect(items[id].kicker).toBe(String(entry.year));
      expect(items[id].meta[0]?.value).toBe(entry.tagline);
      const highlights = entry.highlights.join(' ').toLowerCase();
      for (const { value } of items[id].meta.slice(1)) {
        expect(highlights).toContain(value.toLowerCase());
      }
    }
  });

  it('donnent les compétences du CV, groupe par groupe', () => {
    expect(items.laptop.title).toBe(content.profile.headline);
    expect(items.laptop.kicker).toBe(content.sections.skills);
    expect(items.laptop.meta).toEqual(
      content.skills.map((group) => ({ term: group.label, value: group.items.join(', ') })),
    );
  });

  it('résument le profil sur l’écran', () => {
    expect(items.monitor.title).toBe(content.profile.headline);
    expect(items.monitor.body).toBe(content.profile.summary);
    expect(items.monitor.meta.map((entry) => entry.value)).toEqual([
      period(content, 'defi-metiers', locale),
      period(content, 'dares', locale),
      String(Math.max(...content.projects.map((entry) => entry.year))),
      content.profile.availability,
    ]);
  });

  it('mettent le contact sur la carte, avec ses liens', () => {
    const { card } = items;
    const { profile, contact } = content;
    expect(card.title).toBe(profile.name);
    expect(card.meta.map((entry) => entry.value).slice(0, 3)).toEqual([
      profile.headline,
      profile.location,
      profile.availability,
    ]);
    const links = card.meta.flatMap((entry) => (entry.href ? [entry] : []));
    expect(links).toEqual([
      expect.objectContaining({ value: contact.email, href: `mailto:${contact.email}` }),
      expect.objectContaining({ href: contact.linkedin }),
    ]);
    expect(`https://www.${links[1]?.value}`).toBe(contact.linkedin);
  });

  it('ne citent que des faits du CV', () => {
    const text = cvText(content);
    const periods = [period(content, 'defi-metiers', locale), period(content, 'dares', locale)];
    // Le coffret ne dit rien de ce qu'il contient : aucun fait à comparer.
    // Les compétences du portable ont leur propre test (groupe par groupe).
    const facts = SHEET_ORDER.filter((id) => id !== 'chest' && id !== 'laptop');
    for (const id of facts) {
      for (const { value } of items[id].meta) {
        // L'alternance vient du CV anglais (formations « Apprenticeship », 2020 - 2023).
        if (value === 'Alternance' || value === 'Apprenticeship') continue;
        if (periods.includes(value)) continue;
        expect(text, `${id} : ${value}`).toContain(value.toLowerCase());
      }
    }
  });

  it('ne lient aucun dépôt (les liens publics viennent de src/lib/desk.ts)', () => {
    const repositories = content.projects.flatMap((entry) =>
      entry.repository ? [entry.repository.url] : [],
    );
    const hrefs = Object.values(items).flatMap((item) => item.meta.map((entry) => entry.href));
    for (const href of hrefs) {
      if (!href) continue;
      expect(repositories).not.toContain(href);
      expect(href).not.toMatch(/github\.com/);
    }
  });

  it("n'arrondissent aucune durée", () => {
    // Le résumé de l'écran est celui du CV, mot pour mot (ses durées comprises).
    const { body: _summary, ...monitor } = items.monitor;
    expect(_summary).toBe(content.profile.summary);
    expect(JSON.stringify({ ...items, monitor })).not.toMatch(/\b\d+\s*(ans|an|years?)\b/i);
  });
});
