import { describe, expect, it } from 'vitest';
import { getContent } from '@/content';
import { SHEET_ORDER } from '@/scene/core/ids';
import { laptopChips, laptopSkills } from '@/scene/items/paint';
import { buildDeskSheets, buildDeskSteps, buildDeskTexts, buildSceneTexts } from './desk';

describe('les étapes du bureau', () => {
  it('suivent le CV en français', () => {
    const steps = buildDeskSteps(getContent('fr'), 'fr');
    expect(
      steps.map(({ id, item, title, detail, href }) => ({ id, item, title, detail, href })),
    ).toEqual([
      {
        id: 'defi-metiers',
        item: 'book',
        title: '2020',
        detail: 'DEFI-METIERS',
        href: '/fr/express#defi-metiers',
      },
      { id: 'dares', item: 'postit', title: '2024', detail: 'DARES', href: '/fr/express#dares' },
      {
        id: 'projects',
        item: 'netherbrain',
        title: '2026',
        detail: 'Netherbrain | Homelab',
        href: '/fr/express#projects',
      },
      {
        id: 'perso',
        item: 'chest',
        title: '2026',
        detail: "L'usine",
        href: '/fr/express#projects',
      },
      {
        id: 'contact',
        item: 'card',
        title: 'Contact',
        detail: 'Carte de visite',
        href: '/fr/express#contact',
      },
    ]);
    expect(steps.filter((step) => step.live).map((step) => step.id)).toEqual(['perso']);
  });

  it('mènent à la version express anglaise en anglais', () => {
    const steps = buildDeskSteps(getContent('en'), 'en');
    expect(steps.map((step) => step.href)).toEqual([
      '/en/express#defi-metiers',
      '/en/express#dares',
      '/en/express#projects',
      '/en/express#projects',
      '/en/express#contact',
    ]);
    expect(steps.at(-1)?.detail).toBe('Business card');
  });
});

describe('les textes du bureau', () => {
  it('donnent identité, disponibilité et liens', () => {
    const texts = buildDeskTexts(getContent('fr'), 'fr');
    expect(texts).toMatchObject({
      name: 'Ali Smaani',
      firstName: 'Ali',
      headline: 'Développeur Full-Stack',
      availability: 'Disponible',
      location: 'Île-de-France ou remote',
      expressHref: '/fr/express',
      language: { label: 'EN', name: 'English', href: '/en', locale: 'en' },
    });
  });

  it('ne passent à la scène que ses propres textes', () => {
    const texts = buildSceneTexts(getContent('en'), 'en');
    expect(Object.keys(texts)).toEqual(['locale', 'canvasLabel', 'content', 'skills']);
    expect(texts.content).toEqual(getContent('en').scene);
  });

  it('donnent au portable une pile tirée de la section compétences du CV', () => {
    for (const locale of ['fr', 'en'] as const) {
      const texts = buildSceneTexts(getContent(locale), locale);
      expect(texts.skills).toEqual(getContent(locale).skills.flatMap((group) => group.items));
      const chips = laptopChips(texts.content, texts.skills);
      expect(chips.length).toBeGreaterThanOrEqual(5);
      for (const chip of [...chips, ...laptopSkills(texts.content)]) {
        expect(
          texts.skills.some((skill) => skill === chip || skill.split(/\s*\/\s*/).includes(chip)),
          chip,
        ).toBe(true);
      }
    }
  });
});

describe('les fiches du bureau', () => {
  it('couvrent chaque objet et mènent au contact de la version express', () => {
    const sheets = buildDeskSheets(getContent('fr'), 'fr');
    expect(Object.keys(sheets.items)).toEqual([...SHEET_ORDER]);
    expect(sheets.contactHref).toBe('/fr/express#contact');
    expect(buildDeskSheets(getContent('en'), 'en').contactHref).toBe('/en/express#contact');
  });

  it('ne lient que le dépôt public, la vitrine Homelab', () => {
    // État au 05/11/2026 : la vitrine Homelab-Demo est publique, Netherbrain reste privé.
    const sheets = buildDeskSheets(getContent('fr'), 'fr');
    for (const id of SHEET_ORDER) {
      if (id === 'homelab') continue;
      expect(sheets.items[id].repository, id).toBeNull();
    }
    expect(sheets.items.homelab.repository).toEqual({
      label: 'Voir le dépôt',
      href: 'https://github.com/sma-ali/Homelab-Demo',
    });
  });

  it('ne lient pas un dépôt marqué privé', () => {
    const content = getContent('fr');
    const closed = {
      ...content,
      projects: content.projects.map((project) => ({
        ...project,
        repository: { ...project.repository, public: false },
      })),
    };
    const sheets = buildDeskSheets(closed, 'fr');
    for (const id of SHEET_ORDER) expect(sheets.items[id].repository, id).toBeNull();
  });
});
