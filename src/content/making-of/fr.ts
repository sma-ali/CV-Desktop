import type { TextPageContent } from '../text-page';

// Faits vérifiés le 07/11/2026 dans le dépôt : package.json, next.config.ts
// (CSP), docs/architecture.md, docs/routes-serveur.md, .github/workflows/ci.yml,
// nombre de tests Vitest (601).
export const makingOfFr = {
  title: 'Comment ce site est fait',
  intro: 'Les choix techniques derrière le bureau en 3D, pour qui veut ouvrir le capot.',
  updated: 'Mis à jour le 7 novembre 2026.',
  sections: [
    {
      id: 'pile',
      heading: 'La pile',
      paragraphs: [
        'Next.js (App Router) et TypeScript strict. La scène est en React Three Fiber, sur three.js, avec le moteur physique Rapier en WebAssembly. Le site est hébergé sur Vercel.',
        'Tous les textes, en français et en anglais, vivent dans un seul module de contenu, validé par zod au build. Le bureau, la version express et le CV en PDF lisent la même source : un contenu invalide fait échouer le build.',
      ],
    },
    {
      id: 'bureau',
      heading: 'Le bureau en 3D',
      paragraphs: [
        "La page s'affiche avant la 3D : le serveur envoie déjà l'interface et le CV complet, lisible par un moteur de recherche. three.js arrive dans un fichier à part, et Rapier encore après, une fois les objets posés.",
        "Chaque objet est un corps physique : on le glisse, on le lance, il bascule et s'empile. Au repos, tout dort et rien ne se calcule. La lumière suit l'heure du visiteur, et les sons sont synthétisés dans le navigateur, sans aucun fichier.",
        'Sans WebGL, si la scène plante ou si elle tarde, la version express prend sa place.',
      ],
    },
    {
      id: 'securite',
      heading: 'Sécurité',
      paragraphs: [
        'Une politique de sécurité du contenu (CSP) stricte : rien ne se charge depuis une autre origine, et aucun eval. Les textes de la scène sont donc peints dans des textures, avec des polices hébergées par le site.',
        "Le formulaire de contact est validé côté serveur, avec une limite de débit, un piège à robots et une règle du pare-feu de Vercel. Les messages arrivent par e-mail, depuis un domaine signé (SPF, DKIM, DMARC). Aucune clé n'est dans le code.",
      ],
    },
    {
      id: 'usine',
      heading: "Les chiffres de l'usine",
      paragraphs: [
        "Mon serveur exporte chaque matin un résumé public de son activité. Le site le relit, le valide et arrondit tout vers le bas avant de l'afficher. Le résumé ne contient aucun nom, aucun hôte, aucune adresse.",
      ],
    },
    {
      id: 'tests',
      heading: 'Tests',
      paragraphs: [
        'Plus de 600 tests Vitest couvrent la logique et le contenu : physique, cadrage, gestes, formulaire, arrondis, et la cohérence entre le CV et les textes peints dans la scène.',
        'Playwright rejoue les parcours réels sur le build de production, sur ordinateur et sur téléphone : prendre un objet, le retourner, le glisser, ranger le bureau, envoyer le formulaire, changer de langue. La 3D y est dessinée sans carte graphique.',
        "axe vérifie l'accessibilité (WCAG 2.2 AA) en thème clair et en thème sombre. Tout tourne à chaque modification sur GitHub Actions.",
      ],
    },
    {
      id: 'accessibilite',
      heading: 'Accessibilité',
      paragraphs: [
        "Tout se fait au clavier : les puces pour choisir un objet, les flèches pour le tourner, R pour le retourner, Échap pour le reposer. Si vous préférez moins d'animations, la scène arrive déjà posée, sans visite ni élan.",
      ],
    },
    {
      id: 'code',
      heading: 'Le code',
      paragraphs: [
        'Le dépôt est public : github.com/sma-ali/CV-Desktop. Son README lance le site en local en quelques minutes.',
      ],
    },
  ],
} satisfies TextPageContent;
