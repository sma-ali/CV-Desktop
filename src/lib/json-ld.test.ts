import { describe, expect, it } from 'vitest';
import { getContent, locales } from '@/content';
import { buildProfilePageJsonLd, serializeJsonLd } from './json-ld';

describe.each(locales)('JSON-LD %s', (locale) => {
  const content = getContent(locale);
  const data = buildProfilePageJsonLd(content, locale);
  const person = data.mainEntity;

  it('décrit une page de profil dont le sujet est une personne', () => {
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('ProfilePage');
    expect(data.inLanguage).toBe(locale);
    expect(data.url).toBe(`https://alismaani.fr/${locale}/express`);
    expect(person['@type']).toBe('Person');
  });

  it('reprend le contenu du CV', () => {
    expect(person.name).toBe(content.profile.name);
    expect(person.jobTitle).toBe(content.profile.headline);
    expect(person.description).toBe(content.profile.summary);
    expect(person.url).toBe(content.contact.website);
    expect(person.email).toBe(`mailto:${content.contact.email}`);
    expect(person.sameAs).toEqual([content.contact.linkedin, content.contact.github]);
    expect(person.knowsAbout).toEqual(content.skills.flatMap((group) => group.items));
    expect(person.knowsLanguage).toEqual(
      content.languages.map((language) => ({ '@type': 'Language', name: language.name })),
    );
  });

  it('nomme chaque établissement comme une organisation éducative', () => {
    expect(person.alumniOf).toHaveLength(content.education.length);
    for (const school of person.alumniOf) {
      expect(school['@type']).toBe('EducationalOrganization');
      // Chaque nom figure tel quel sur la page.
      expect(content.education.some((item) => item.school.startsWith(school.name))).toBe(true);
    }
    expect(person.alumniOf.map((school) => school.name)).toContain('EPSI Paris La Défense');
  });

  it('ne donne ni téléphone ni date de naissance', () => {
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/telephone|birthDate|\+33|\b0[1-9](?:[\s.]?\d{2}){4}\b/);
  });
});

describe('serializeJsonLd', () => {
  it('échappe « < » pour ne jamais fermer la balise <script>', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
