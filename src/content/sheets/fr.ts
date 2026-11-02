import type { SheetsContent } from './schema';

// Les fiches en français. Source : le CV (septembre 2026) ; sheets.test.ts
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
    contact: 'Me contacter',
    repository: 'Voir le dépôt',
    sound: 'Son',
    live: {
      title: 'Signes de vie',
      sample: "Données d'exemple",
      running: 'Projets en marche',
      last: 'Dernière activité',
      since: 'En route depuis',
      chart: "Activité des {days} derniers jours, du plus ancien à aujourd'hui : {values}",
      axisStart: 'Il y a {days} jours',
      axisEnd: "Aujourd'hui",
      ago: {
        now: "à l'instant",
        minutes: 'il y a {n} min',
        hours: 'il y a {h} h',
        hoursMinutes: 'il y a {h} h {mm}',
        days: { one: 'il y a {n} jour', other: 'il y a {n} jours' },
      },
      age: { one: '{n} jour', other: '{n} jours' },
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
        { term: 'Pile', value: 'Drupal / PHP' },
        { term: 'Contrat', value: 'Alternance' },
      ],
      body: "Développement et maintenance des plateformes web du CARIF-OREF francilien, au service des organismes de formation, des demandeurs d'emploi et des conseillers d'orientation.",
      note: 'Ouvert, le livre montre la migration de Dokelio vers Ofeli.',
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
      body: "Le catalogue de formations d'Île-de-France est passé de Dokelio à Ofeli, les deux bases de données régionales de l'offre de formation. Les requêtes SQL ont été refondues pour améliorer les temps de réponse.",
    },
    postit: {
      kicker: 'Janv. 2024 - Juin 2026',
      step: 'Étape 2 sur 3',
      title: 'Ingénieur applicatif & gestion de données',
      meta: [
        { term: 'Chez', value: 'DARES' },
        { term: 'Rattachement', value: 'Ministère du Travail' },
        { term: 'Volume', value: '~100 tickets/mois' },
        { term: 'Suivi', value: 'Pilotage par KPI' },
      ],
      body: 'Recueil et traduction des besoins métiers, qualification, suivi et validation de chaque ticket.',
    },
    headset: {
      kicker: 'Janv. 2024 - Juin 2026',
      step: 'Étape 2 sur 3',
      title: 'Support applicatif N1/N2',
      meta: [
        { term: 'Parc', value: '~300 utilisateurs' },
        { term: 'Public', value: 'statisticiens, économistes' },
        { term: 'Outils', value: 'R / RStudio' },
        { term: 'Accès', value: 'ODBC' },
      ],
      body: "Habilitations, déploiement applicatif, accès aux bases de données distantes et environnements statistiques, en contexte à forte criticité. Les échanges de données sensibles avec l'INSEE et France Travail passent par les bulles sécurisées du CASD.",
    },
    netherbrain: {
      kicker: '2026',
      step: 'Étape 3 sur 3',
      title: 'Netherbrain',
      meta: [
        { term: 'Projet', value: 'plateforme LLM auto-hébergée' },
        { term: 'Modèles', value: 'Ollama / GPU' },
        { term: 'Serveur', value: 'FastAPI, PostgreSQL + pgvector' },
        { term: 'Interface', value: 'Next.js / React / TypeScript' },
        { term: 'Qualité', value: '236 tests automatisés' },
      ],
      body: 'Une plateforme de chat qui orchestre des LLM open source, locaux ou distants via une API compatible OpenAI. Streaming temps réel (SSE), RAG sur documents joints, agent de code avec diff et validation avant chaque écriture.',
      note: 'Retourné, le bocal montre son étiquette.',
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
        { term: 'Durcissement', value: 'CrowdSec / 2FA / SSH par clé' },
      ],
      body: 'Un serveur dédié joignable seulement par VPN. Sauvegardes automatiques des VM avec restauration testée ; architecture et procédures intégralement documentées et versionnées.',
    },
    laptop: {
      kicker: 'Compétences',
      step: 'La pile',
      title: 'Développeur Full-Stack',
      meta: [
        { term: 'Langages', value: 'JavaScript, TypeScript, PHP, Python, SQL' },
        { term: 'Front-end', value: 'React, Next.js, Tailwind, HTML5/CSS3' },
        {
          term: 'Back-end & BDD',
          value:
            'Node.js, Express, FastAPI, API REST, Drupal, PostgreSQL / pgvector, MySQL/MariaDB',
        },
        {
          term: 'DevOps / Infra',
          value: 'Git, Docker Compose, Linux, Nginx, CI/CD, GitHub Actions, Proxmox',
        },
        {
          term: 'Outils & méthodes',
          value:
            'Postman, Vitest / Jest, pytest, Jira, Agile / Scrum, IA générative, Prompt engineering',
        },
      ],
      body: "Les compétences du CV, du front-end à l'infrastructure.",
    },
    chest: {
      kicker: 'Projets perso',
      step: 'Scellé',
      title: "Ça tourne. C'est scellé.",
      meta: [{ term: 'Contenu', value: 'Scellé' }],
      body: "Le contenu ne s'ouvre pas ici. Le coffret, lui, donne des signes de vie.",
      note: 'Le contenu se raconte en entretien.',
    },
    card: {
      kicker: 'Carte de visite',
      step: 'Contact',
      title: 'Ali Smaani',
      meta: [
        { term: 'Poste', value: 'Développeur Full-Stack' },
        { term: 'Zone', value: 'Île-de-France ou remote' },
        { term: 'Statut', value: 'Disponible' },
        { term: 'E-mail', value: 'smanali.pro@gmail.com', href: 'mailto:smanali.pro@gmail.com' },
        {
          term: 'LinkedIn',
          value: 'linkedin.com/in/smaali',
          href: 'https://www.linkedin.com/in/smaali',
        },
      ],
      body: 'Vous cherchez un développeur full-stack, sur place ou à distance ? Écrivez-moi.',
    },
    monitor: {
      kicker: 'Le parcours',
      step: 'Profil',
      title: 'Développeur Full-Stack',
      meta: [
        { term: 'DEFI-METIERS', value: 'Sept. 2020 - Août 2023' },
        { term: 'DARES', value: 'Janv. 2024 - Juin 2026' },
        { term: 'Projets', value: '2026' },
        { term: 'Statut', value: 'Disponible' },
      ],
      body: "Développeur full-stack (React, Node.js, TypeScript), doublé d'une expérience du support applicatif et de la gestion de données en environnement à forte criticité. Curieux, je fais le lien entre le code, l'infrastructure et la sécurité, de la conception au déploiement.",
    },
  },
} satisfies SheetsContent;
