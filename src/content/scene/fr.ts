import type { SceneContent } from './schema';

// Squelette : la partie « objets » le complète. Les repères viennent du CV
// (début de chaque expérience, année des projets).
export const sceneFr = {
  labels: {
    book: { mark: '2020', text: 'DEFI-METIERS' },
    postit: { mark: '2024', text: 'DARES' },
    laptop: { mark: '2026', text: 'Projets' },
    card: { mark: 'Ali', text: 'Contact' },
    chest: { mark: 'Projets perso', text: 'Scellé' },
  },
  screen: {
    fileName: 'parcours.ts',
    code: [
      '// parcours.ts',
      'export const ali = {',
      "  metier: 'Développeur Full-Stack',",
      '  disponible: true,',
      '} as const;',
    ],
  },
} satisfies SceneContent;
