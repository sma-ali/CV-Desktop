import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Ce qui ne doit pas entrer dans le JavaScript du navigateur : zod et le
// module de contenu (les textes arrivent en props depuis le serveur). Les
// imports de types restent permis.
const serverOnlyContent = {
  group: ['@/content', '@/content/index', '@/content/schema', '@/content/*/schema', 'zod'],
  allowTypeImports: true,
  message: 'Le navigateur reçoit ses textes en props : ni zod ni le module de contenu côté client.',
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier s'occupe de la mise en forme : on coupe les règles ESLint qui la touchent.
  prettier,
  {
    files: ['src/scene/**/*.{ts,tsx}', 'src/components/desk/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [serverOnlyContent] }],
    },
  },
  {
    // Le HUD part dans le JavaScript initial : pas de three, et seulement les
    // modules du socle qui n'en dépendent pas (jamais le fichier d'index).
    files: ['src/components/desk/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            '@/scene/core',
            '@/scene/core/index',
            '@/scene/core/geometry',
            '@/scene/core/textures',
            '@/scene/core/materials',
            '@/scene/core/SceneCanvas',
            '@/scene/core/ClockDriver',
          ].map((name) => ({
            name,
            allowTypeImports: true,
            message: 'Le HUD importe seulement les modules du socle sans three.',
          })),
          patterns: [
            serverOnlyContent,
            {
              group: ['three', 'three/*', '@react-three/*', 'postprocessing'],
              allowTypeImports: true,
              message: 'three reste dans le fichier de la scène, chargé à part.',
            },
            {
              group: ['@/scene/decor/*', '@/scene/items/*', '@/scene/stage/*'],
              allowTypeImports: true,
              message: 'Le HUD importe seulement les modules du socle sans three.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'prototype/**',
    '.claude/**',
  ]),
]);
