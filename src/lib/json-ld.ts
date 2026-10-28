import type { Content } from '@/content';
import type { Locale } from '@/content/locales';
import { absoluteUrl, expressPath } from './site';

// Données structurées de la version express : une page de profil (ProfilePage)
// dont le sujet est une personne (Person), selon la documentation de Google
// (https://developers.google.com/search/docs/appearance/structured-data/profile-page).
// Tout ce qui figure ici est aussi visible sur la page.
export function buildProfilePageJsonLd(content: Content, locale: Locale) {
  const { profile, contact, skills, languages, education } = content;

  // « EPSI Paris La Défense · Apprenticeship » : seule la première partie
  // nomme l'établissement.
  const schools = [
    ...new Set(education.map((item) => item.school.split(' · ')[0]?.trim() ?? item.school)),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: absoluteUrl(expressPath(locale)),
    inLanguage: locale,
    mainEntity: {
      '@type': 'Person',
      name: profile.name,
      jobTitle: profile.headline,
      description: profile.summary,
      url: contact.website,
      email: `mailto:${contact.email}`,
      sameAs: [contact.linkedin, contact.github],
      knowsAbout: [...new Set(skills.flatMap((group) => group.items))],
      knowsLanguage: languages.map((language) => ({ '@type': 'Language', name: language.name })),
      alumniOf: schools.map((name) => ({ '@type': 'EducationalOrganization', name })),
    },
  };
}

// JSON pour un <script type="application/ld+json"> : « < » devient \u003c pour
// qu'aucune valeur ne puisse fermer la balise.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
