import { contactFormEn } from './contact/en';
import type { Content } from './schema';
import { sceneEn } from './scene/en';
import { sheetsEn } from './sheets/en';
import { contact } from './shared';

// Source : le CV d'Ali en anglais (septembre 2026). Même structure que fr.ts.
export const en = {
  profile: {
    name: 'Ali Smaani',
    headline: 'Full-Stack Developer',
    summary:
      'Full-stack developer (React, Node.js, TypeScript) with hands-on experience in application support and data management for high-criticality environments. Curious by nature, comfortable bridging code, infrastructure and security, from design to deployment.',
    location: 'Paris, France · Open to remote',
    availability: 'Available',
  },
  contact,
  sections: {
    summary: 'Profile',
    experience: 'Professional experience',
    projects: 'Technical projects',
    education: 'Education',
    skills: 'Skills',
    softSkills: 'Strengths',
    languages: 'Languages',
    interests: 'Interests',
    contact: 'Contact',
  },
  experiences: [
    {
      id: 'dares',
      role: 'Application & Data Management Engineer',
      organization: 'DARES',
      organizationDetail: 'French Ministry of Labour, statistics & research directorate',
      period: { start: '2024-01', end: '2026-06' },
      highlights: [
        'Delivered L1/L2 support to ~300 users (statisticians, economists) in a high-criticality environment: access rights, application deployment, remote database access (ODBC), statistical environments (R / RStudio).',
        "Secured sensitive data exchanges with France's national statistics institute (INSEE) and national employment agency (France Travail): encryption and decryption through the CASD secure data enclaves (SD-Box).",
        'Owned ~100 tickets per month end to end: gathering and translating business requirements, qualification, tracking, validation and KPI reporting.',
      ],
    },
    {
      id: 'defi-metiers',
      role: 'Web Developer',
      organization: 'DEFI-METIERS',
      organizationDetail: 'Greater Paris public agency for vocational training',
      period: { start: '2020-09', end: '2023-08' },
      highlights: [
        "Developed and maintained the agency's public web platforms (Drupal / PHP) for training providers, jobseekers and career advisors.",
        "Migrated the regional training catalogue from Dokelio to Ofeli, the region's two public training databases: redesigned and optimized SQL queries to cut response times on high-volume data.",
      ],
    },
  ],
  projects: [
    {
      id: 'netherbrain',
      name: 'Netherbrain',
      tagline: 'self-hosted LLM platform',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Netherbrain', public: false },
      highlights: [
        'Chat platform orchestrating open-source LLMs, both local (Ollama / GPU) and remote through any OpenAI-compatible API: FastAPI, PostgreSQL + pgvector, Next.js / React / TypeScript.',
        'Real-time SSE streaming, RAG across attached documents, and a coding agent that runs tools with a diff and user approval before every write.',
        '236 automated tests, GitHub Actions CI against a real PostgreSQL service, multi-stage non-root Docker Compose deployment, Alembic migrations.',
      ],
    },
    {
      id: 'homelab',
      name: 'Homelab',
      tagline: 'self-hosted infrastructure',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Homelab-Demo', public: true },
      highlights: [
        'Dedicated server running Proxmox behind an OPNsense firewall, reachable only through a self-hosted WireGuard VPN; hardened with CrowdSec, 2FA and key-based SSH.',
        'Automated VM backups with a tested restore path; architecture and procedures fully documented and version-controlled.',
      ],
    },
  ],
  education: [
    {
      id: 'epsi',
      title: "Master's Degree | Computer Science & Information Systems",
      school: 'EPSI Paris La Défense · Apprenticeship',
      from: 2021,
      to: 2023,
    },
    {
      id: 'my-digital-school',
      title: "Bachelor's Degree | Web Development",
      school: 'My Digital School, Paris · Apprenticeship',
      from: 2020,
      to: 2021,
    },
    {
      id: 'paris-8',
      title: 'Professional Diploma | Web & Mobile Developer',
      school: 'Université Paris 8 · CFA AFIA, Saint-Denis',
      from: 2019,
      to: 2020,
    },
    {
      id: 'baccalaureat',
      title: 'French Baccalauréat | Humanities',
      school: 'Lycée Charles de Foucauld, Paris',
      from: 2017,
      to: 2017,
    },
  ],
  skills: [
    {
      id: 'languages',
      label: 'Programming languages',
      items: ['JavaScript', 'TypeScript', 'PHP', 'Python', 'SQL'],
    },
    {
      id: 'frontend',
      label: 'Frontend',
      items: ['React', 'Next.js', 'Tailwind', 'HTML5/CSS3'],
    },
    {
      id: 'backend',
      label: 'Backend & databases',
      items: [
        'Node.js',
        'Express',
        'FastAPI',
        'REST APIs',
        'Drupal',
        'PostgreSQL / pgvector',
        'MySQL/MariaDB',
      ],
    },
    {
      id: 'devops',
      label: 'DevOps / Infrastructure',
      items: ['Git', 'Docker Compose', 'Linux', 'Nginx', 'CI/CD', 'GitHub Actions', 'Proxmox'],
    },
    {
      id: 'tools',
      label: 'Tools & methods',
      items: [
        'Postman',
        'Vitest / Jest',
        'pytest',
        'Jira',
        'Agile / Scrum',
        'Generative AI',
        'Prompt engineering',
      ],
    },
  ],
  softSkills: [
    'Fast learner',
    'Adaptable',
    'Self-directed',
    'Curious',
    'Team player',
    'Strong written & verbal communication',
  ],
  languages: [
    { id: 'fr', name: 'French', level: 'Native' },
    { id: 'en', name: 'English', level: 'Bilingual (C2)' },
  ],
  interests: [
    'Theatre (6 years, performed at the Odéon national theatre)',
    'Football / Grappling / Weight training',
    'Competitive esports (League of Legends, top 0.1%)',
  ],
  ui: {
    kicker: 'Express version',
    kickerDetail: 'The CV on one page',
    skipToContent: 'Skip to content',
    print: 'Print',
    languageNav: 'Language',
    emailLabel: 'Email',
    linkedinLabel: 'LinkedIn',
    githubLabel: 'GitHub',
    websiteLabel: 'Website',
    repositoryLabel: 'Repository',
    backToTop: 'Back to top',
    backToDesk: 'Back to the desk',
  },
  desk: {
    canvasLabel: "Ali's desk seen from above. Each object is a step of the CV.",
    controlsLabel: 'Controls',
    arrivalKicker: 'Welcome to the desk of',
    glance: 'The CV at a glance',
    perso: { year: 2026, detail: 'The factory' },
    contactDetail: 'Business card',
    hint: {
      pointer: 'Click an object to take a closer look. Drag it to move it.',
      touch: 'Tap an object to take a closer look. Drag it to move it.',
      auto: 'Guided tour. Tap an object to take over.',
      presented: 'Object shown up close. Press Escape to put it back.',
      held: {
        pointer: 'Drag to rotate, click to turn over, Escape to put back.',
        touch: 'Drag to rotate, tap to turn over.',
      },
    },
    fallback: {
      noScript: 'The 3D desk needs JavaScript. Here is the CV in its express version.',
      noWebgl: 'Your browser cannot display the 3D desk. Here is the CV in its express version.',
      crashed: 'The 3D desk could not start. Here is the CV in its express version.',
      contextLost: 'The 3D desk stopped. Here is the CV in its express version.',
      expressLink: 'Open the express version',
    },
    tidy: {
      offer: 'Oops, you broke everything. Shall I tidy up?',
      tidying: 'Tidying up the desk.',
      done: 'Desk tidied up.',
    },
    intro: {
      preparing: 'Setting up the desk',
      slow: 'The 3D desk is taking too long to set up. Here is the CV in its express version.',
      steps: {
        code: 'Delivering the desk',
        assets: 'Painting the objects',
        shaders: 'Setting the lights',
        frame: 'Final touch',
      },
      done: 'Ready',
    },
  },
  scene: sceneEn,
  sheets: sheetsEn,
  contactForm: contactFormEn,
} satisfies Content;
