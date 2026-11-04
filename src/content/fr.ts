import { contactFormFr } from './contact/fr';
import type { Content } from './schema';
import { sceneFr } from './scene/fr';
import { sheetsFr } from './sheets/fr';
import { contact } from './shared';

// Source : le CV d'Ali en français (septembre 2026). Ne rien reformuler ici
// sans l'avoir changé dans le CV.
export const fr = {
  profile: {
    name: 'Ali Smaani',
    headline: 'Développeur Full-Stack',
    summary:
      "Développeur full-stack (React, Node.js, TypeScript), doublé d'une expérience du support applicatif et de la gestion de données en environnement à forte criticité. Curieux, je fais le lien entre le code, l'infrastructure et la sécurité, de la conception au déploiement.",
    location: 'Île-de-France ou remote',
    availability: 'Disponible',
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
        "Support applicatif N1/N2 d'un parc de ~300 utilisateurs (statisticiens, économistes) en contexte à forte criticité : habilitations, déploiement applicatif, accès aux bases de données distantes (ODBC), environnements statistiques (R / RStudio).",
        'Sécurisation des échanges de données sensibles avec les partenaires (INSEE, France Travail) : chiffrement / déchiffrement via les bulles sécurisées du CASD (SD-Box).',
        'Gestion de ~100 tickets/mois : recueil et traduction des besoins métiers, qualification, suivi, validation et pilotage par KPI.',
      ],
    },
    {
      id: 'defi-metiers',
      role: 'Développeur Web',
      organization: 'DEFI-METIERS',
      organizationDetail: 'CARIF-OREF Île-de-France',
      period: { start: '2020-09', end: '2023-08' },
      highlights: [
        "Développement et maintenance (évolutive, corrective) des plateformes web du CARIF-OREF francilien (Drupal / PHP), au service des organismes de formation, des demandeurs d'emploi et des conseillers d'orientation.",
        "Migration du catalogue de formations d'Île-de-France de Dokelio vers Ofeli, les deux bases de données régionales de l'offre de formation : refonte et optimisation des requêtes SQL pour améliorer les temps de réponse sur une forte volumétrie.",
      ],
    },
  ],
  projects: [
    {
      id: 'netherbrain',
      name: 'Netherbrain',
      tagline: 'plateforme LLM auto-hébergée',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Netherbrain', public: false },
      highlights: [
        'Plateforme de chat orchestrant des LLM open source locaux (Ollama / GPU) et distants via API compatible OpenAI : FastAPI, PostgreSQL + pgvector, Next.js / React / TypeScript.',
        'Streaming temps réel (SSE), RAG sur documents joints, agent de code avec diff et validation avant chaque écriture.',
        '236 tests automatisés, CI GitHub Actions sur PostgreSQL réel, déploiement Docker Compose multi-étapes non-root, migrations Alembic.',
      ],
    },
    {
      id: 'homelab',
      name: 'Homelab',
      tagline: 'infrastructure auto-hébergée',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Homelab', public: false },
      highlights: [
        'Serveur dédié sous Proxmox, pare-feu OPNsense, accès exclusif par VPN WireGuard, durcissement CrowdSec / 2FA / SSH par clé.',
        'Sauvegardes automatiques des VM avec restauration testée ; architecture et procédures intégralement documentées et versionnées.',
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
    {
      id: 'paris-8',
      title: 'Développeur Web & Web Mobile',
      school: 'Université Paris 8 · CFA AFIA, Saint-Denis',
      from: 2019,
      to: 2020,
    },
    {
      id: 'baccalaureat',
      title: 'Baccalauréat Littéraire',
      school: 'Lycée Charles de Foucauld, Paris',
      from: 2017,
      to: 2017,
    },
  ],
  skills: [
    {
      id: 'languages',
      label: 'Langages',
      items: ['JavaScript', 'TypeScript', 'PHP', 'Python', 'SQL'],
    },
    {
      id: 'frontend',
      label: 'Front-end',
      items: ['React', 'Next.js', 'Tailwind', 'HTML5/CSS3'],
    },
    {
      id: 'backend',
      label: 'Back-end & BDD',
      items: [
        'Node.js',
        'Express',
        'FastAPI',
        'API REST',
        'Drupal',
        'PostgreSQL / pgvector',
        'MySQL/MariaDB',
      ],
    },
    {
      id: 'devops',
      label: 'DevOps / Infra',
      items: ['Git', 'Docker Compose', 'Linux', 'Nginx', 'CI/CD', 'GitHub Actions', 'Proxmox'],
    },
    {
      id: 'tools',
      label: 'Outils & méthodes',
      items: [
        'Postman',
        'Vitest / Jest',
        'pytest',
        'Jira',
        'Agile / Scrum',
        'IA générative',
        'Prompt engineering',
      ],
    },
  ],
  softSkills: [
    'Fast-learner',
    'Adaptabilité',
    'Autonomie',
    'Curiosité',
    "Esprit d'équipe",
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
    languageNav: 'Langue',
    emailLabel: 'E-mail',
    linkedinLabel: 'LinkedIn',
    githubLabel: 'GitHub',
    websiteLabel: 'Site',
    repositoryLabel: 'Dépôt',
    backToTop: 'Haut de page',
    backToDesk: 'Revenir au bureau',
  },
  desk: {
    canvasLabel: "Le bureau d'Ali vu d'en haut. Chaque objet est une étape du CV.",
    controlsLabel: 'Commandes',
    expressLink: 'Version express',
    replay: 'Rejouer',
    arrivalKicker: 'Bienvenue chez',
    glance: "Le CV en un coup d'œil",
    perso: { title: 'Projets perso', detail: 'Une usine à vidéos' },
    contactDetail: 'Carte de visite',
    clock: { visitorTime: 'Chez vous, il est {time}.', pinned: 'Lumière choisie.' },
    moodsLabel: 'Changer la lumière',
    moods: {
      morning: { name: 'Matin', light: 'Lumière du matin.' },
      afternoon: { name: 'Après-midi', light: "Lumière d'après-midi." },
      evening: { name: 'Soir', light: 'Lumière du soir.' },
      night: { name: 'Nuit', light: 'Nuit. La lampe veille.' },
    },
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
      skip: 'Lire le CV sans attendre',
      slow: 'Le bureau en 3D met trop de temps à se préparer. Voici le CV en version express.',
    },
  },
  scene: sceneFr,
  sheets: sheetsFr,
  contactForm: contactFormFr,
} satisfies Content;
