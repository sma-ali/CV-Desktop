import { contactFormFr } from './contact/fr';
import { legalFr } from './legal/fr';
import { makingOfFr } from './making-of/fr';
import type { Content } from './schema';
import { sceneFr } from './scene/fr';
import { sheetsFr } from './sheets/fr';
import { contact } from './shared';

// Source : le CV d'Ali « Full Stack + IA » en français (05/11/2026). Ne rien reformuler ici
// sans l'avoir changé dans le CV.
export const fr = {
  profile: {
    name: 'Ali Smaani',
    headline: 'Dev FullStack | AI Engineer',
    summary:
      "Développeur full-stack React / TypeScript et Python / FastAPI. Je conçois des applications qui intègrent l'IA générative de bout en bout : interface React, API FastAPI, PostgreSQL, et LLM multi-fournisseurs avec tool calling, sorties structurées, RAG et streaming. En parallèle, je fais tourner en production une plateforme d'automatisation multi-agents auto-hébergée. 3 ans de développement web puis 2 ans et demi d'ingénierie applicative.",
    location: 'Île-de-France · remote possible',
    availability: 'Disponible immédiatement',
  },
  contact,
  sections: {
    summary: 'Profil',
    experience: 'Expériences professionnelles',
    projects: 'Projets & réalisations techniques',
    education: 'Formations',
    skills: 'Compétences',
    softSkills: 'Soft skills',
    languages: 'Langues',
    interests: "Centres d'intérêt",
    contact: 'Contact',
  },
  experiences: [
    {
      id: 'dares',
      role: 'Ingénieur applicatif & gestion de données',
      organization: 'DARES',
      organizationDetail: 'Ministère du Travail',
      period: { start: '2024-01', end: '2026-06' },
      highlights: [
        "Support applicatif N1/N2 d'un parc de ~300 utilisateurs en contexte à forte criticité : déploiement applicatif, habilitations, accès aux bases distantes (ODBC), environnements statistiques R / RStudio.",
        "Sécurisation des échanges de données sensibles avec l'INSEE et France Travail via les bulles sécurisées du CASD (boîtier SD-Box, carte, code et empreinte, environnement coupé d'Internet), support quotidien de leurs utilisateurs ; ~100 tickets/mois, du recueil du besoin métier à la validation.",
      ],
    },
    {
      id: 'defi-metiers',
      role: 'Développeur Web',
      organization: 'DEFI-METIERS',
      organizationDetail: 'CARIF-OREF Île-de-France',
      period: { start: '2020-09', end: '2023-08' },
      highlights: [
        "Développement et maintenance évolutive et corrective des plateformes web du CARIF-OREF francilien (Drupal / PHP), au service des organismes de formation et des conseillers d'orientation.",
        'Migration du catalogue régional de formations de Dokelio vers Ofeli : refonte et optimisation des requêtes SQL sur une forte volumétrie.',
      ],
    },
  ],
  projects: [
    {
      id: 'netherbrain',
      name: 'Netherbrain',
      tagline: "plateforme d'orchestration de LLM",
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Netherbrain', public: false },
      highlights: [
        'Full-stack Python / React : backend FastAPI (Pydantic, SQLAlchemy, migrations Alembic), PostgreSQL + pgvector, front React / TypeScript, streaming temps réel en Server-Sent Events.',
        'Intégration LLM multi-fournisseurs : SDK OpenAI et toute API compatible (Ollama en local sur GPU, OpenRouter, Groq), métriques par réponse (latence du 1er token, tokens/s).',
        "Agent outillé : boucle de tool calling multi-tours (lecture, recherche, édition de fichiers, git), diff présenté et accord explicite de l'utilisateur avant chaque écriture.",
        'RAG sur documents joints ; plus de 300 tests automatisés (pytest, Vitest), CI GitHub Actions sur PostgreSQL réel, Docker Compose multi-étapes non-root.',
      ],
    },
    {
      id: 'homelab',
      name: 'Homelab',
      tagline: 'infrastructure auto-hébergée',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Homelab-Demo', public: true },
      highlights: [
        'Serveur dédié sous Proxmox, pare-feu OPNsense, accès exclusif par VPN WireGuard, durcissement : pare-feu IPv4 + IPv6, 2FA, SSH par clé.',
        'Sauvegardes automatiques des VM avec restauration testée ; architecture et procédures intégralement documentées et versionnées.',
      ],
    },
    {
      id: 'automation',
      name: "Plateforme d'automatisation multi-agents",
      tagline: 'projet personnel en production',
      year: 2026,
      highlights: [
        'Pipelines LLM de bout en bout en Python : agents spécialisés, relecture automatique, validation humaine avant diffusion, planification.',
        'Choix du modèle selon la tâche, suivi des coûts et repli automatique entre API et abonnement ; serveur auto-hébergé (Proxmox, OPNsense, WireGuard).',
      ],
    },
  ],
  education: [
    {
      id: 'epsi',
      title: "Master | Expert en Informatique & Systèmes d'Information",
      school: 'EPSI Paris La Défense',
      from: 2021,
      to: 2023,
    },
    {
      id: 'my-digital-school',
      title: 'Bachelor Développeur Web',
      school: 'My Digital School, Paris',
      from: 2020,
      to: 2021,
    },
  ],
  skills: [
    {
      id: 'frontend',
      label: 'Front-end',
      items: ['React', 'TypeScript', 'Next.js', 'Vite', 'Tailwind', 'Three.js'],
    },
    {
      id: 'backend',
      label: 'Back-end',
      items: [
        'Python',
        'FastAPI',
        'Pydantic',
        'API REST',
        'SSE',
        'PostgreSQL / pgvector',
        'Alembic',
        'Node.js / Express',
      ],
    },
    {
      id: 'ai',
      label: 'IA & LLM',
      items: [
        'API Anthropic',
        'SDK OpenAI',
        'Ollama',
        'Tool calling',
        'Sorties structurées',
        'Agents IA',
        'RAG',
        'Prompt engineering',
      ],
    },
    {
      id: 'devops',
      label: 'DevOps & qualité',
      items: [
        'Docker Compose',
        'GitHub Actions',
        'CI/CD',
        'Git',
        'pytest',
        'Vitest',
        'Linux',
        'Nginx',
        'Proxmox',
      ],
    },
    {
      id: 'other',
      label: 'Autres',
      items: ['SQL', 'PHP / Drupal', 'Agile / Scrum'],
    },
  ],
  softSkills: [
    'Autonomie & force de proposition',
    'Fast-learner',
    'Traduction du besoin métier en solution logicielle',
    'Aisance écrite & orale',
  ],
  languages: [
    { id: 'fr', name: 'Français', level: 'natif' },
    { id: 'en', name: 'Anglais', level: 'bilingue' },
  ],
  interests: [
    "Théâtre (6 ans, spectacle à l'Odéon)",
    'Football / Grappling / Musculation',
    'Esport compétitif (League of Legends, top 0.1%)',
  ],
  ui: {
    kicker: 'Version express',
    kickerDetail: 'Le CV en une page',
    skipToContent: 'Aller au contenu',
    print: 'Imprimer',
    pdf: 'CV en PDF',
    pdfFileName: 'Ali Smaani - CV.pdf',
    languageNav: 'Langue',
    emailLabel: 'E-mail',
    linkedinLabel: 'LinkedIn',
    githubLabel: 'GitHub',
    websiteLabel: 'Site',
    repositoryLabel: 'Dépôt',
    backToTop: 'Haut de page',
    backToDesk: 'Revenir au bureau',
    legalLink: 'Mentions légales',
    makingOfLink: 'Comment ce site est fait',
  },
  desk: {
    canvasLabel: "Le bureau d'Ali vu d'en haut. Chaque objet est une étape du CV.",
    controlsLabel: 'Commandes',
    arrivalKicker: 'Bienvenue chez',
    glance: "Le CV en un coup d'œil",
    perso: { year: 2026, detail: "L'usine" },
    contactDetail: 'Carte de visite',
    written: { title: 'CV', detail: 'Version écrite' },
    hint: {
      pointer: 'Cliquez sur un objet pour le voir de près. Glissez-le pour le déplacer.',
      touch: 'Touchez un objet pour le voir de près. Glissez-le pour le déplacer.',
      auto: 'Visite automatique. Touchez un objet pour prendre la main.',
      presented: 'Objet vu de près. Échap pour le reposer.',
      held: {
        pointer: 'Glissez pour tourner, cliquez pour retourner, Échap pour reposer.',
        touch: 'Glissez pour tourner, touchez pour retourner.',
      },
    },
    fallback: {
      noScript: 'Le bureau en 3D a besoin de JavaScript. Voici le CV en version express.',
      noWebgl:
        'Votre navigateur ne peut pas afficher le bureau en 3D. Voici le CV en version express.',
      crashed: "Le bureau en 3D n'a pas pu démarrer. Voici le CV en version express.",
      contextLost: "Le bureau en 3D s'est interrompu. Voici le CV en version express.",
      expressLink: 'Ouvrir la version express',
    },
    tidy: {
      offer: 'Oulala, vous avez tout cassé. Je range pour vous ?',
      tidying: 'Je range le bureau.',
      done: 'Bureau rangé.',
    },
    intro: {
      preparing: 'Préparation du bureau',
      slow: 'Le bureau en 3D met trop de temps à se préparer. Voici le CV en version express.',
      steps: {
        code: 'Livraison du bureau',
        assets: 'Peinture des objets',
        shaders: 'Réglage de la lumière',
        frame: 'Dernière touche',
      },
      done: 'Prêt',
    },
  },
  scene: sceneFr,
  sheets: sheetsFr,
  contactForm: contactFormFr,
  legal: legalFr,
  makingOf: makingOfFr,
} satisfies Content;
