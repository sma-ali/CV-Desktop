import type { SheetsContent } from './schema';

// Les fiches en français. Source : le CV (novembre 2026) ; sheets.test.ts
// compare chaque fait au contenu. Vouvoiement, phrases courtes.
export const sheetsFr = {
  ui: {
    label: "Fiche de l'objet",
    prev: 'Préc.',
    prevLabel: 'objet précédent',
    next: 'Suiv.',
    nextLabel: 'objet suivant',
    close: 'Reposer',
    flip: 'Retourner',
    flipKey: 'R',
    upright: 'Remettre droit',
    contact: 'Me contacter',
    repository: 'Voir le dépôt',
    factory: {
      circuitLabel: 'Le circuit',
      circuit: [
        {
          label: 'Création',
          detail:
            "Des agents spécialisés se partagent le travail : sujet, script, images, voix pour certaines chaînes. Le montage est automatique. Chacun a le modèle qui convient à sa tâche, et les coûts sont suivis. Si les crédits d'API s'épuisent, le circuit passe seul sur l'abonnement.",
        },
        {
          label: 'Relecture par agents',
          detail:
            'Un agent juge regarde la vidéo montée. Ce qui coince repart en réparation, sans tout refaire.',
        },
        {
          label: 'Validation humaine',
          detail:
            'Je valide moi-même les récits et la philosophie avant chaque envoi. Les billes et les quiz partent seuls.',
        },
        {
          label: 'Publication',
          detail:
            'Une fois prêtes ou validées, les vidéos partent seules depuis mon serveur, à heure fixe, plusieurs fois par jour.',
        },
        {
          label: 'Statistiques',
          detail:
            "Les vues et les j'aime de chaque vidéo sont relevés automatiquement. Cette fiche en lit un résumé public, arrondi, mis à jour chaque matin.",
        },
      ],
      status: 'En marche',
      sample: "Données d'exemple",
      last: 'dernière vidéo {ago}',
      ago: {
        today: "aujourd'hui",
        yesterday: 'hier',
        days: { one: 'il y a {n} jour', other: 'il y a {n} jours' },
      },
      more: 'plus de {n}',
      since: 'depuis {date}',
      figures: {
        channels: { one: 'chaîne', other: 'chaînes' },
        videos: { one: 'vidéo', other: 'vidéos' },
        perDay: 'par jour en moyenne',
        views: 'vues depuis le début',
        likes: "j'aime",
      },
      tabsLabel: 'Exemples',
      chart:
        "Vidéos publiées ces {days} derniers jours, toutes chaînes, du plus ancien à aujourd'hui : {values}",
      axisStart: 'Il y a {days} jours',
      axisEnd: "Aujourd'hui",
      genres: {
        fantasy: {
          tab: 'Récits',
          title: 'Récits de fantasy',
          body: 'Des récits courts dans un univers de fantasy, racontés en voix off.',
          rows: [
            { term: 'Agents', value: 'sujet, scénariste, iconographe' },
            { term: 'Publication', value: 'validation humaine avant chaque envoi' },
          ],
        },
        philosophy: {
          tab: 'Philosophie',
          title: 'Philosophie en une minute',
          body: "Les leçons d'un penseur en une minute : texte, œuvres d'art, voix.",
          rows: [
            { term: 'Agents', value: 'stratège, iconographe, juge' },
            { term: 'Publication', value: 'validation humaine avant chaque envoi' },
          ],
        },
        marbles: {
          tab: 'Billes 3D',
          title: 'Courses de billes',
          body: 'Des courses de billes en 3D, simulées puis rendues sans carte graphique.',
          rows: [
            { term: 'Moteur', value: 'three.js, physique Rapier, rendu logiciel' },
            { term: 'Publication', value: 'automatique' },
          ],
        },
        quiz: {
          tab: 'Quiz',
          title: 'Quiz',
          body: 'Un moteur commun pour plusieurs quiz, chacun avec sa direction artistique.',
          rows: [
            { term: 'Moteur', value: 'commun, une DA par quiz' },
            { term: 'Données', value: 'API publiques' },
          ],
        },
      },
    },
  },
  items: {
    book: {
      kicker: 'Sept. 2020 - Août 2023',
      step: 'Étape 1 sur 3',
      title: 'Développeur Web',
      meta: [
        { term: 'Chez', value: 'DEFI-METIERS' },
        { term: 'Structure', value: 'CARIF-OREF Île-de-France' },
        { term: 'Technos', value: 'Drupal / PHP' },
        { term: 'Contrat', value: 'Alternance' },
      ],
      body: "Développement et maintenance des plateformes web régionales, au service des organismes de formation et des conseillers d'orientation.",
      note: 'Ouvert, le livre montre une page de code Drupal / PHP.',
    },
    badge: {
      kicker: 'Sept. 2020 - Août 2023',
      step: 'Étape 1 sur 3',
      title: 'Migration du catalogue de formations',
      meta: [
        { term: 'De', value: 'Dokelio' },
        { term: 'Vers', value: 'Ofeli' },
        { term: 'Levier', value: 'Optimisation des requêtes SQL' },
        { term: 'Volume', value: 'Forte volumétrie' },
      ],
      body: 'Le catalogue régional de formations est passé de Dokelio à Ofeli. Les requêtes SQL ont été refondues et optimisées pour tenir une forte volumétrie.',
    },
    postit: {
      kicker: 'Janv. 2024 - Juin 2026',
      step: 'Étape 2 sur 3',
      title: 'Ingénieur applicatif & gestion de données',
      meta: [
        { term: 'Chez', value: 'DARES' },
        { term: 'Rattachement', value: 'Ministère du Travail' },
        { term: 'Volume', value: '~100 tickets/mois' },
        { term: 'Parcours', value: 'du besoin métier à la validation' },
      ],
      body: "Chaque ticket est suivi de bout en bout, du besoin exprimé par le métier jusqu'à la validation.",
    },
    headset: {
      kicker: 'Janv. 2024 - Juin 2026',
      step: 'Étape 2 sur 3',
      title: 'Support applicatif N1/N2',
      meta: [
        { term: 'Parc', value: '~300 utilisateurs' },
        { term: 'Contexte', value: 'contexte critique' },
        { term: 'Outils', value: 'R / RStudio' },
        { term: 'Accès', value: 'ODBC' },
      ],
      body: 'Déploiement applicatif, habilitations, accès aux bases distantes et environnements R / RStudio, en contexte critique.',
    },
    casd: {
      kicker: 'Janv. 2024 - Juin 2026',
      step: 'Étape 2 sur 3',
      title: 'Données sensibles | CASD',
      meta: [
        { term: 'Avec', value: 'INSEE et France Travail' },
        { term: 'Accès', value: 'SD-Box' },
        { term: 'Authentification', value: 'carte, code et empreinte' },
        { term: 'Environnement', value: 'hors Internet' },
      ],
      body: "Les échanges de données sensibles avec l'INSEE et France Travail passent par les environnements cloisonnés du CASD. Support au quotidien des utilisateurs : boîtier SD-Box, authentification forte, hors Internet.",
    },
    netherbrain: {
      kicker: '2026',
      step: 'Étape 3 sur 3',
      title: 'Netherbrain',
      meta: [
        { term: 'Projet', value: "plateforme d'orchestration de LLM" },
        { term: 'Modèles', value: 'Ollama en local sur GPU, OpenRouter, Groq' },
        { term: 'Serveur', value: 'FastAPI (Pydantic, Alembic)' },
        { term: 'Base', value: 'PostgreSQL + pgvector' },
        { term: 'Interface', value: 'React / TypeScript' },
        { term: 'Qualité', value: 'plus de 300 tests automatisés' },
      ],
      body: "Une plateforme qui orchestre des LLM de plusieurs fournisseurs, en local ou via toute API compatible OpenAI. Streaming temps réel, RAG sur documents joints, et un agent outillé qui montre son diff et attend l'accord de l'utilisateur avant chaque écriture.",
    },
    homelab: {
      kicker: '2026',
      step: 'Étape 3 sur 3',
      title: 'Homelab',
      meta: [
        { term: 'Projet', value: 'infrastructure auto-hébergée' },
        { term: 'Serveur', value: 'Proxmox' },
        { term: 'Pare-feu', value: 'OPNsense' },
        { term: 'Accès', value: 'VPN WireGuard' },
        { term: 'Durcissement', value: 'Pare-feu IPv4 + IPv6, 2FA, SSH par clé' },
      ],
      body: 'Un serveur dédié joignable seulement par VPN. Sauvegardes automatiques des VM avec restauration testée ; architecture et procédures intégralement documentées et versionnées.',
    },
    laptop: {
      kicker: 'Compétences',
      step: 'Les outils',
      title: 'AI Engineer | Dev FullStack',
      meta: [
        {
          term: 'Front-end',
          value: 'React, TypeScript, Next.js, Vite, Tailwind, Three.js (React Three Fiber)',
        },
        {
          term: 'Back-end',
          value:
            'Python, FastAPI, Pydantic, API REST, SSE, SQL, PostgreSQL / pgvector, Alembic, Node.js / Express, PHP / Drupal',
        },
        {
          term: 'IA générative & LLM',
          value:
            "Claude API (Anthropic), OpenAI API, Hugging Face, Ollama / GGUF, Agents IA, Multi-agents, Tool calling, Structured outputs, RAG, Base vectorielle (pgvector), Prompt engineering, Cache de prompt, LLM-as-judge, Bancs d'essai, Multimodal (vision), Claude Code",
        },
        {
          term: 'Voix & vidéo',
          value:
            'Speech-to-text (Whisper), Alignement forcé (MMS), Text-to-speech (ElevenLabs), FFmpeg',
        },
        { term: 'Machine learning', value: 'PyTorch, Réseaux de neurones, Hyperparamètres' },
        {
          term: 'DevOps & qualité',
          value:
            'Docker / Docker Compose, GitHub Actions, CI/CD, Git, pytest, Vitest, Playwright (E2E), Vercel, Linux, Nginx, Proxmox',
        },
        { term: 'Méthodes', value: 'Agile / Scrum, Jira' },
      ],
      body: "Les compétences du CV, du front-end à l'IA et à l'infrastructure.",
    },
    chest: {
      kicker: '2026',
      step: 'Étape 3 sur 3',
      title: "L'usine",
      meta: [{ term: 'Circuit', value: 'de bout en bout' }],
      body: 'Des chaînes vidéo produites de bout en bout par des agents IA, sur mon propre serveur. Je conçois le circuit, les agents font le reste.',
    },
    card: {
      kicker: 'Carte de visite',
      step: 'Contact',
      title: 'Ali Smaani',
      meta: [
        { term: 'Poste', value: 'AI Engineer | Dev FullStack' },
        { term: 'Zone', value: 'Île-de-France · télétravail possible' },
        { term: 'Statut', value: 'Disponible immédiatement' },
        { term: 'E-mail', value: 'smanali.pro@gmail.com', href: 'mailto:smanali.pro@gmail.com' },
        {
          term: 'LinkedIn',
          value: 'linkedin.com/in/smaali',
          href: 'https://www.linkedin.com/in/smaali',
        },
      ],
      body: 'Vous cherchez un développeur full-stack orienté IA, sur place ou à distance ? Écrivez-moi.',
    },
    monitor: {
      kicker: 'Le parcours',
      step: 'Profil',
      title: 'AI Engineer | Dev FullStack',
      meta: [
        { term: 'DEFI-METIERS', value: 'Sept. 2020 - Août 2023' },
        { term: 'DARES', value: 'Janv. 2024 - Juin 2026' },
        { term: 'Projets', value: '2026' },
        { term: 'Statut', value: 'Disponible immédiatement' },
      ],
      body: "Développeur full-stack React / TypeScript et Python / FastAPI. Je conçois des applications testées et déployées qui intègrent l'IA générative : LLM multi-fournisseurs, tool calling, structured outputs, RAG et streaming. En parallèle, je fais tourner en production une plateforme d'automatisation multi-agents. 3 ans de développement web, puis 2,5 ans d'ingénierie applicative.",
    },
  },
} satisfies SheetsContent;
