import { describe, expect, it } from 'vitest';
import { getContent } from '@/content';
import { SHEET_ORDER } from '@/scene/core/ids';
import { LAPTOP_SCREEN, laptopScreenHeight, laptopSkills } from '@/scene/items/paint';
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
        id: 'netherbrain',
        item: 'netherbrain',
        title: '2026',
        detail: 'Netherbrain',
        href: '/fr/express#projects',
      },
      {
        id: 'homelab',
        item: 'homelab',
        title: '2026',
        detail: 'Homelab',
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
      headline: 'Dev FullStack | AI Engineer',
      availability: 'Disponible immédiatement',
      location: 'Île-de-France · remote possible',
      expressHref: '/fr/express',
      language: { label: 'EN', name: 'English', href: '/en', locale: 'en' },
    });
  });

  it('ne passent à la scène que ses propres textes', () => {
    const texts = buildSceneTexts(getContent('en'), 'en');
    expect(Object.keys(texts)).toEqual(['locale', 'canvasLabel', 'content', 'skills']);
    expect(texts.content).toEqual(getContent('en').scene);
  });

  it('donnent au portable toutes les compétences du CV, groupe par groupe', () => {
    for (const locale of ['fr', 'en'] as const) {
      const texts = buildSceneTexts(getContent(locale), locale);
      expect(texts.skills).toEqual(
        getContent(locale).skills.map(({ label, items }) => ({ label, items })),
      );
      // Toutes ne tiennent pas d'un coup : l'écran du portable défile.
      expect(laptopScreenHeight(texts.skills)).toBeGreaterThan(LAPTOP_SCREEN.visible);
      const flat = texts.skills.flatMap((group) => group.items);
      for (const sticker of laptopSkills(texts.content)) {
        expect(
          flat.some((skill) => skill === sticker || skill.split(/\s*\/\s*/).includes(sticker)),
          sticker,
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
        repository: project.repository && { ...project.repository, public: false },
      })),
    };
    const sheets = buildDeskSheets(closed, 'fr');
    for (const id of SHEET_ORDER) expect(sheets.items[id].repository, id).toBeNull();
  });
});
