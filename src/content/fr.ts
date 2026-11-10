import { contactFormFr } from './contact/fr';
import { legalFr } from './legal/fr';
import { makingOfFr } from './making-of/fr';
import type { Content } from './schema';
import { sceneFr } from './scene/fr';
import { sheetsFr } from './sheets/fr';
import { contact } from './shared';

// Source : le CV d'Ali « Développeur Full-Stack IA » en français (09/11/2026). Ne rien
// reformuler ici sans l'avoir changé dans le CV. Les compétences réunissent celles de ce CV
// et du CV « AI Engineer » : le site est son portfolio, il les montre toutes.
export const fr = {
  profile: {
    name: 'Ali Smaani',
    headline: 'AI Engineer | Dev FullStack',
    summary:
      "Développeur full-stack React / TypeScript et Python / FastAPI. Je conçois des applications testées et déployées qui intègrent l'IA générative : LLM multi-fournisseurs, tool calling, structured outputs, RAG et streaming. En parallèle, je fais tourner en production une plateforme d'automatisation multi-agents. 3 ans de développement web, puis 2,5 ans d'ingénierie applicative.",
    location: 'Île-de-France · télétravail possible',
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
        'Support applicatif N1/N2 de ~300 utilisateurs en contexte critique : déploiement, habilitations, accès aux bases distantes (ODBC), environnements R / RStudio.',
        "Sécurisation des échanges de données sensibles avec l'INSEE et France Travail via les environnements cloisonnés du CASD (SD-Box, carte, code et empreinte, hors Internet), support quotidien des utilisateurs ; ~100 tickets/mois, du besoin métier à la validation.",
      ],
    },
    {
      id: 'defi-metiers',
      role: 'Développeur Web',
      organization: 'DEFI-METIERS',
      organizationDetail: 'CARIF-OREF Île-de-France',
      period: { start: '2020-09', end: '2023-08' },
      highlights: [
        "Développement et maintenance des plateformes web régionales (Drupal / PHP), au service des organismes de formation et des conseillers d'orientation.",
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
      repository: { url: 'https://github.com/sma-ali/Netherbrain', public: true },
      highlights: [
        'Full-stack : API FastAPI (Pydantic, Alembic), PostgreSQL + pgvector, front React / TypeScript, streaming SSE ; plus de 300 tests automatisés, CI GitHub Actions, Docker Compose.',
        'Intégration LLM multi-fournisseurs : OpenAI API et API compatibles (Ollama en local sur GPU, OpenRouter, Groq), RAG sur documents joints.',
        "Agent outillé : boucle de tool calling multi-tours (fichiers, git), diff présenté et accord de l'utilisateur avant chaque écriture.",
      ],
    },
    {
      id: 'cv-desktop',
      name: 'alismaani.fr',
      tagline: 'CV interactif en 3D',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/CV-Desktop', public: true },
      highlights: [
        'Next.js / TypeScript strict : bureau 3D manipulable (React Three Fiber, physique Rapier), version HTML pour le SEO, contenu FR / EN validé par zod.',
        "Routes serveur TypeScript : formulaire de contact validé côté serveur, limite de débit, piège à robots, envoi d'e-mails ; en-têtes de sécurité, déployé sur Vercel.",
        'Plus de 600 tests Vitest et 150 tests Playwright (mobile, accessibilité) en CI.',
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
      ],
    },
    {
      id: 'automation',
      name: "Plateforme d'automatisation multi-agents",
      tagline: 'projet personnel en production',
      year: 2026,
      highlights: [
        'Pipelines LLM en Python sur une VM auto-hébergée (Proxmox, OPNsense, WireGuard) : agents spécialisés, relecture (LLM-as-judge), validation humaine puis publication automatique ; optimisation des coûts et des modèles.',
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
      items: ['React', 'TypeScript', 'Next.js', 'Vite', 'Tailwind', 'Three.js (React Three Fiber)'],
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
        'SQL',
        'PostgreSQL / pgvector',
        'Alembic',
        'Node.js / Express',
        'PHP / Drupal',
      ],
    },
    {
      id: 'ai',
      label: 'IA générative & LLM',
      items: [
        'Claude API (Anthropic)',
        'OpenAI API',
        'Hugging Face',
        'Ollama / GGUF',
        'Agents IA',
        'Multi-agents',
        'Tool calling',
        'Structured outputs',
        'RAG',
        'Base vectorielle (pgvector)',
        'Prompt engineering',
        'Cache de prompt',
        'LLM-as-judge',
        "Bancs d'essai",
        'Multimodal (vision)',
        'Claude Code',
      ],
    },
    {
      id: 'audio',
      label: 'Voix & vidéo',
      items: [
        'Speech-to-text (Whisper)',
        'Alignement forcé (MMS)',
        'Text-to-speech (ElevenLabs)',
        'FFmpeg',
      ],
    },
    {
      id: 'ml',
      label: 'Machine learning',
      items: ['PyTorch', 'Réseaux de neurones', 'Hyperparamètres'],
    },
    {
      id: 'devops',
      label: 'DevOps & qualité',
      items: [
        'Docker / Docker Compose',
        'GitHub Actions',
        'CI/CD',
        'Git',
        'pytest',
        'Vitest',
        'Playwright (E2E)',
        'Vercel',
        'Linux',
        'Nginx',
        'Proxmox',
      ],
    },
    {
      id: 'other',
      label: 'Méthodes',
      items: ['Agile / Scrum', 'Jira'],
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
    'Esport compétitif (League of Legends, top 0,1 %)',
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
