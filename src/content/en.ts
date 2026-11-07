import { contactFormEn } from './contact/en';
import { legalEn } from './legal/en';
import type { Content } from './schema';
import { sceneEn } from './scene/en';
import { sheetsEn } from './sheets/en';
import { contact } from './shared';

// Source : le CV d'Ali « Full Stack + AI » en anglais (05/11/2026). Même structure que fr.ts.
export const en = {
  profile: {
    name: 'Ali Smaani',
    headline: 'Full-Stack & AI Developer',
    summary:
      'Full-stack developer (React / TypeScript, Python / FastAPI). I build applications that integrate generative AI end to end: React front end, FastAPI back end, PostgreSQL, and multi-provider LLMs with tool calling, structured outputs, RAG and streaming. I also run a self-hosted multi-agent automation platform in production. 3 years of web development, then 2.5 years of application engineering.',
    location: 'Paris, France · Open to remote',
    availability: 'Available immediately',
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
        'L1/L2 application support for ~300 users in a high-criticality environment: application deployment, access rights, remote database access (ODBC), statistical environments (R / RStudio).',
        'Secured sensitive data exchanges with INSEE (national statistics) and France Travail (employment agency) through the CASD secure enclaves; ~100 tickets a month, from business requirements to validation.',
      ],
    },
    {
      id: 'defi-metiers',
      role: 'Web Developer',
      organization: 'DEFI-METIERS',
      organizationDetail: 'Greater Paris public agency for vocational training',
      period: { start: '2020-09', end: '2023-08' },
      highlights: [
        "Developed and maintained the agency's public web platforms (Drupal / PHP) for training providers and career advisors.",
        'Migrated the regional training catalogue from Dokelio to Ofeli: redesigned and optimized SQL queries on high-volume data.',
      ],
    },
  ],
  projects: [
    {
      id: 'netherbrain',
      name: 'Netherbrain',
      tagline: 'LLM orchestration platform',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Netherbrain', public: false },
      highlights: [
        'Full-stack Python / React: FastAPI back end (Pydantic, SQLAlchemy, Alembic migrations), PostgreSQL + pgvector, React / TypeScript front end, real-time Server-Sent Events streaming.',
        'Multi-provider LLM integration: OpenAI SDK and any compatible API (local Ollama on GPU, OpenRouter, Groq), per-response metrics (time to first token, tokens/s).',
        'Tool-using agent: multi-turn tool calling loop (file reading, search, editing, git), with a diff shown and explicit user approval before every write.',
        'RAG over attached documents; 300+ automated tests (pytest, Vitest), GitHub Actions CI against a real PostgreSQL, multi-stage non-root Docker Compose.',
      ],
    },
    {
      id: 'homelab',
      name: 'Homelab',
      tagline: 'self-hosted infrastructure',
      year: 2026,
      repository: { url: 'https://github.com/sma-ali/Homelab-Demo', public: true },
      highlights: [
        'Dedicated server running Proxmox behind an OPNsense firewall, reachable only through a self-hosted WireGuard VPN; hardening: IPv4 + IPv6 host firewall, 2FA, key-only SSH.',
        'Automated VM backups with a tested restore path; architecture and procedures fully documented and version-controlled.',
      ],
    },
    {
      id: 'automation',
      name: 'Multi-agent automation platform',
      tagline: 'personal project in production',
      year: 2026,
      highlights: [
        'End-to-end LLM pipelines in Python: specialized agents, automated review, human validation before release, scheduling.',
        'Model chosen per task, cost tracking and automatic fallback between API and subscription; self-hosted server (Proxmox, OPNsense, WireGuard).',
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
        'REST API',
        'SSE',
        'PostgreSQL / pgvector',
        'Alembic',
        'Node.js / Express',
      ],
    },
    {
      id: 'ai',
      label: 'AI & LLM',
      items: [
        'Anthropic API',
        'OpenAI SDK',
        'Ollama',
        'Tool calling',
        'Structured outputs',
        'AI agents',
        'RAG',
        'Prompt engineering',
      ],
    },
    {
      id: 'devops',
      label: 'DevOps & quality',
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
      label: 'Other',
      items: ['SQL', 'PHP / Drupal', 'Agile / Scrum'],
    },
  ],
  softSkills: [
    'Self-directed & proactive',
    'Fast learner',
    'Turning business needs into software',
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
    pdf: 'Resume (PDF)',
    pdfFileName: 'Ali Smaani - Resume.pdf',
    languageNav: 'Language',
    emailLabel: 'Email',
    linkedinLabel: 'LinkedIn',
    githubLabel: 'GitHub',
    websiteLabel: 'Website',
    repositoryLabel: 'Repository',
    backToTop: 'Back to top',
    backToDesk: 'Back to the desk',
    legalLink: 'Legal notice',
  },
  desk: {
    canvasLabel: "Ali's desk seen from above. Each object is a step of the CV.",
    controlsLabel: 'Controls',
    arrivalKicker: 'Welcome to the desk of',
    glance: 'The CV at a glance',
    perso: { year: 2026, detail: 'The factory' },
    contactDetail: 'Business card',
    written: { title: 'CV', detail: 'Text version' },
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
  legal: legalEn,
} satisfies Content;
