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

// Les couches de la scène (src/scene), de la plus basse à la plus haute. Un
// dossier n'importe que des couches plus basses, jamais une voisine de la
// même couche ni Scene.tsx, qui assemble le tout :
// 1. core : le noyau (store, horloge, identifiants, constantes, corps du
//    plateau, contrat du moteur physique, outils de dessin communs) ;
// 2. gestures : le moyeu des gestes et l'appui sur un corps ;
// 3. decor, items : ce qui se dessine, le décor et les objets du CV ;
// 4. stage : la mise en scène (lumières, caméra, cadrage du décor) ;
// 5. physics, rotation : le moteur physique, la rotation de l'objet tenu ;
// 6. tidy : le rangement, qui pilote le moteur physique.
// Les tests (*.test.ts) peuvent croiser les couches.
const SCENE_LAYERS = [
  ['core'],
  ['gestures'],
  ['decor', 'items'],
  ['stage'],
  ['physics', 'rotation'],
  ['tidy'],
];

const sceneLayerRules = SCENE_LAYERS.flatMap((layer, index) => {
  const above = SCENE_LAYERS.slice(index).flat();
  return layer.map((folder) => {
    const forbidden = above.filter((other) => other !== folder);
    return {
      files: [`src/scene/${folder}/**/*.{ts,tsx}`],
      ignores: ['src/scene/**/*.test.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              serverOnlyContent,
              {
                group: [
                  ...forbidden.flatMap((other) => [`../${other}/*`, `@/scene/${other}/*`]),
                  '../Scene',
                  '@/scene/Scene',
                ],
                message: `${folder}/ n'importe que les couches plus basses de la scène (voir SCENE_LAYERS).`,
              },
            ],
          },
        ],
      },
    };
  });
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier s'occupe de la mise en forme : on coupe les règles ESLint qui la touchent.
  prettier,
  {
    files: [
      'src/scene/**/*.{ts,tsx}',
      'src/components/desk/**/*.{ts,tsx}',
      'src/components/contact/**/*.{ts,tsx}',
      'src/lib/contact/rules.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: [serverOnlyContent] }],
    },
  },
  ...sceneLayerRules,
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
