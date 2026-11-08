import { describe, expect, it } from 'vitest';
import { formatMonthPeriod, periodText } from '@/lib/dates';
import { ITEM_POSES } from '@/scene/core/constants';
import { ITEM_IDS } from '@/scene/core/ids';
import { en } from '../en';
import { fr } from '../fr';
import type { Locale } from '../locales';
import type { Content } from '../schema';
import { sceneEn } from './en';
import { sceneFr } from './fr';
import { sceneContentSchema, type SceneContent } from './schema';
import { buildScreenCode } from './screen-code';

// Les textes peints dans la scène disent la même chose que le CV : chaque
// fait est comparé au contenu, pour qu'un changement du CV se voie ici.

const cases: [Locale, Content, SceneContent][] = [
  ['fr', fr, sceneFr],
  ['en', en, sceneEn],
];

function experience(content: Content, id: string) {
  const found = content.experiences.find((entry) => entry.id === id);
  if (!found) throw new Error(`expérience absente : ${id}`);
  return found;
}

/** Tout le texte du CV où un chiffre ou un outil peut être cité. */
function cvText(content: Content): string {
  return [
    ...content.experiences.flatMap((entry) => entry.highlights),
    ...content.projects.flatMap((project) => project.highlights),
    ...content.skills.flatMap((group) => group.items),
  ].join('\n');
}

describe.each(cases)('scène %s', (locale, content, scene) => {
  const { facts } = scene;

  it('respecte le schéma', () => {
    expect(sceneContentSchema.safeParse(scene).error?.issues ?? []).toEqual([]);
  });

  it('est celle du contenu', () => {
    expect(content.scene).toBe(scene);
  });

  it('affiche le code généré depuis le CV', () => {
    expect(scene.screen.code).toEqual(buildScreenCode(content, scene.screen.words));
  });

  it('reprend le profil et le contact', () => {
    expect(facts.name).toBe(content.profile.name);
    expect(facts.headline).toBe(content.profile.headline);
    expect(facts.location).toBe(content.profile.location);
    expect(facts.availability).toBe(content.profile.availability);
    expect(facts.email).toBe(content.contact.email);
    expect(`https://www.${facts.linkedin}`).toBe(content.contact.linkedin);
  });

  it('reprend DEFI-METIERS tel quel', () => {
    const job = experience(content, 'defi-metiers');
    const { defiMetiers } = facts;
    expect(defiMetiers.organization).toBe(job.organization);
    expect(defiMetiers.detail).toBe(job.organizationDetail);
    expect(defiMetiers.role).toBe(job.role);
    expect(defiMetiers.year).toBe(job.period.start.slice(0, 4));
    expect(defiMetiers.period).toBe(periodText(formatMonthPeriod(job.period, locale)));
    expect(defiMetiers.years).toBe(
      `${job.period.start.slice(0, 4)} - ${job.period.end.slice(0, 4)}`,
    );
    expect(job.highlights.join(' ')).toContain(defiMetiers.stack);
    expect(job.highlights.join(' ')).toContain(defiMetiers.migration.from);
    expect(job.highlights.join(' ')).toContain(defiMetiers.migration.to);
    // L'alternance vient du CV anglais (formations « Apprenticeship » de 2020 à 2023).
    expect(defiMetiers.kind).toBe(locale === 'fr' ? 'Alternance' : 'Apprenticeship');
  });

  it('reprend DARES tel quel', () => {
    const job = experience(content, 'dares');
    const { dares } = facts;
    const highlights = job.highlights.join(' ');
    expect(dares.organization).toBe(job.organization);
    expect(dares.role).toBe(job.role);
    expect(dares.period).toBe(periodText(formatMonthPeriod(job.period, locale)));
    expect(highlights).toContain(dares.support.replace(/^Support |support$/, '').trim());
    expect(highlights).toContain(dares.tickets.split(' ')[0]);
    expect(highlights).toContain(dares.users);
    expect(highlights).toContain(dares.tools);
  });

  it('reprend les projets tels quels', () => {
    const { projects } = facts;
    expect(projects.year).toBe(String(Math.max(...content.projects.map((p) => p.year))));
    // Les deux projets posés sur le bureau ; la plateforme d'automatisation,
    // elle, est l'usine (coffret) et ne s'écrit pas sur l'ordinateur.
    const onDesk = content.projects.filter((p) => p.id === 'netherbrain' || p.id === 'homelab');
    expect(projects.items).toEqual(onDesk.map(({ name, tagline }) => ({ name, tagline })));
    const names = content.projects.map((project) => project.name);
    const skills = content.skills.flatMap((group) => group.items);
    for (const sticker of projects.stickers) {
      expect([...names, ...skills]).toContain(sticker);
    }
    const projectText = content.projects.flatMap((project) => project.highlights).join(' ');
    for (const chip of projects.chips) expect(projectText).toContain(chip);
    expect(projectText).toContain(projects.tests);
  });

  it('peint Netherbrain et Homelab tels que le CV les décrit', () => {
    const project = (id: string) => {
      const found = content.projects.find((entry) => entry.id === id);
      if (!found) throw new Error(`projet absent : ${id}`);
      return found;
    };
    const netherbrain = project('netherbrain');
    const { label } = scene.netherbrain;
    expect(label.name).toBe(netherbrain.name);
    expect(label.tagline).toBe(netherbrain.tagline);
    expect(label.year).toBe(String(netherbrain.year));
    for (const line of [...label.stack, label.tests]) {
      expect(netherbrain.highlights.join(' ')).toContain(line);
    }
    const homelab = project('homelab');
    expect(scene.homelab.name).toBe(homelab.name);
    for (const line of [...Object.values(scene.homelab.units), scene.homelab.access]) {
      expect(homelab.highlights.join(' ')).toContain(line);
    }
  });

  it('étiquette les deux projets et les compétences', () => {
    const { labels } = scene;
    // Une étiquette par objet qui a un point d'accroche (TagLayer les pose d'office).
    expect(Object.keys(labels)).toEqual(ITEM_IDS.filter((id) => ITEM_POSES[id].tag !== null));
    for (const project of content.projects) {
      if (project.id !== 'netherbrain' && project.id !== 'homelab') continue;
      const key = project.id;
      expect(labels[key]).toEqual({ mark: String(project.year), text: project.name });
    }
    expect(labels.laptop.text).toBe(content.sections.skills);
  });

  it('ne cite sur les objets que des outils du CV', () => {
    const text = cvText(content);
    for (const tool of scene.screen.words.stackItems) {
      expect(text).toContain(tool);
    }
  });

  it("n'arrondit aucune durée", () => {
    const all = JSON.stringify(scene);
    expect(all).not.toMatch(/\b\d+\s*(ans|an|years?)\b/i);
  });
});
