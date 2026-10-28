import { describe, expect, it } from 'vitest';
import { getContent } from '@/content';
import { SHEET_ORDER } from '@/scene/core/ids';
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
        title: 'Projets perso',
        detail: 'Scellés, mais vivants',
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
      express: { label: 'Version express', href: '/fr/express' },
      language: { label: 'English', href: '/en', locale: 'en' },
    });
    expect(Object.keys(texts.moods)).toEqual(['morning', 'afternoon', 'evening', 'night']);
  });

  it('ne passent à la scène que ses propres textes', () => {
    const texts = buildSceneTexts(getContent('en'), 'en');
    expect(Object.keys(texts)).toEqual(['locale', 'canvasLabel', 'content']);
    expect(texts.content).toEqual(getContent('en').scene);
  });
});

describe('les fiches du bureau', () => {
  it('couvrent chaque objet et mènent au contact de la version express', () => {
    const sheets = buildDeskSheets(getContent('fr'), 'fr');
    expect(Object.keys(sheets.items)).toEqual([...SHEET_ORDER]);
    expect(sheets.contactHref).toBe('/fr/express#contact');
    expect(buildDeskSheets(getContent('en'), 'en').contactHref).toBe('/en/express#contact');
  });

  it('ne lient pas un dépôt privé', () => {
    const content = getContent('fr');
    expect(content.projects.every((project) => !project.repository.public)).toBe(true);
    const sheets = buildDeskSheets(content, 'fr');
    for (const id of SHEET_ORDER) expect(sheets.items[id].repository, id).toBeNull();
  });

  it('lient le dépôt d’un projet public', () => {
    const content = getContent('fr');
    const opened = {
      ...content,
      projects: content.projects.map((project) =>
        project.id === 'homelab'
          ? { ...project, repository: { ...project.repository, public: true } }
          : project,
      ),
    };
    const sheets = buildDeskSheets(opened, 'fr');
    expect(sheets.items.homelab.repository).toEqual({
      label: 'Voir le dépôt',
      href: 'https://github.com/sma-ali/Homelab',
    });
    expect(sheets.items.netherbrain.repository).toBeNull();
  });
});
