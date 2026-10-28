import type { SceneContent } from './schema';

// Même structure que fr.ts.
export const sceneEn = {
  labels: {
    book: { mark: '2020', text: 'DEFI-METIERS' },
    postit: { mark: '2024', text: 'DARES' },
    laptop: { mark: '2026', text: 'Projects' },
    card: { mark: 'Ali', text: 'Contact' },
    chest: { mark: 'Side projects', text: 'Sealed' },
  },
  screen: {
    fileName: 'career.ts',
    code: [
      '// career.ts',
      'export const ali = {',
      "  role: 'Full-Stack Developer',",
      '  available: true,',
      '} as const;',
    ],
  },
} satisfies SceneContent;
