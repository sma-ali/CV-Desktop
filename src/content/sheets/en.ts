import type { SheetsContent } from './schema';

// Les fiches en anglais. Même structure que fr.ts ; source : le CV anglais.
export const sheetsEn = {
  ui: {
    label: 'Object card',
    prev: 'Prev.',
    prevLabel: 'previous object',
    next: 'Next',
    nextLabel: 'next object',
    close: 'Put back',
    flip: 'Turn over',
    flipKey: 'R',
    upright: 'Set upright',
    contact: 'Get in touch',
    repository: 'View the repository',
    factory: {
      circuitLabel: 'The pipeline',
      circuit: [
        {
          label: 'Creation',
          detail:
            'Specialised agents share the work: topic, script, images, and voice for some channels. Editing is automatic. Each one runs the model that fits its task, and costs are tracked. If the API credits run out, the pipeline switches to the subscription on its own.',
        },
        {
          label: 'Agent review',
          detail:
            'A judge agent watches the edited video. Whatever falls short goes back for repair, without redoing everything.',
        },
        {
          label: 'Human approval',
          detail:
            'I approve the stories and the philosophy videos myself before each upload. The marbles and the quizzes go out on their own.',
        },
        {
          label: 'Publishing',
          detail:
            'Once ready or approved, videos leave my server on their own, at fixed times, several times a day.',
        },
        {
          label: 'Analytics',
          detail:
            'Views and likes for every video are collected automatically. This card reads a rounded public summary, updated every morning.',
        },
      ],
      status: 'Running',
      sample: 'Sample data',
      last: 'last video {ago}',
      ago: {
        today: 'today',
        yesterday: 'yesterday',
        days: { one: '{n} day ago', other: '{n} days ago' },
      },
      more: 'over {n}',
      since: 'since {date}',
      figures: {
        channels: { one: 'channel', other: 'channels' },
        videos: { one: 'video', other: 'videos' },
        perDay: 'per day on average',
        views: 'views since the start',
        likes: 'likes',
      },
      tabsLabel: 'Examples',
      chart: 'Videos published over the last {days} days, all channels, oldest to today: {values}',
      axisStart: '{days} days ago',
      axisEnd: 'Today',
      genres: {
        fantasy: {
          tab: 'Tales',
          title: 'Fantasy tales',
          body: 'Short tales set in a fantasy world, told in voice-over.',
          rows: [
            { term: 'Agents', value: 'topic, scriptwriter, iconographer' },
            { term: 'Publishing', value: 'human approval before every upload' },
          ],
        },
        philosophy: {
          tab: 'Philosophy',
          title: 'Philosophy in a minute',
          body: "A thinker's lessons in one minute: text, artworks, voice.",
          rows: [
            { term: 'Agents', value: 'strategist, iconographer, judge' },
            { term: 'Publishing', value: 'human approval before every upload' },
          ],
        },
        marbles: {
          tab: '3D marbles',
          title: 'Marble races',
          body: 'Marble races in 3D, simulated then rendered without a graphics card.',
          rows: [
            { term: 'Engine', value: 'three.js, Rapier physics, software rendering' },
            { term: 'Publishing', value: 'automatic' },
          ],
        },
        quiz: {
          tab: 'Quizzes',
          title: 'Quizzes',
          body: 'One shared engine for several quizzes, each with its own art direction.',
          rows: [
            { term: 'Engine', value: 'shared, one art direction per quiz' },
            { term: 'Data', value: 'public APIs' },
          ],
        },
      },
    },
  },
  items: {
    book: {
      kicker: 'Sep 2020 - Aug 2023',
      step: 'Step 1 of 3',
      title: 'Web Developer',
      meta: [
        { term: 'At', value: 'DEFI-METIERS' },
        { term: 'Agency', value: 'Greater Paris public agency for vocational training' },
        { term: 'Stack', value: 'Drupal / PHP' },
        { term: 'Contract', value: 'Apprenticeship' },
      ],
      body: "Developed and maintained the agency's public web platforms for training providers and career advisors.",
      note: 'Open, the book shows a page of Drupal / PHP code.',
    },
    badge: {
      kicker: 'Sep 2020 - Aug 2023',
      step: 'Step 1 of 3',
      title: 'Training catalogue migration',
      meta: [
        { term: 'From', value: 'Dokelio' },
        { term: 'To', value: 'Ofeli' },
        { term: 'Lever', value: 'Optimized SQL queries' },
        { term: 'Volume', value: 'High-volume data' },
      ],
      body: 'Migrated the regional training catalogue from Dokelio to Ofeli. SQL queries were redesigned and optimized to handle high-volume data.',
    },
    postit: {
      kicker: 'Jan 2024 - Jun 2026',
      step: 'Step 2 of 3',
      title: 'Application & Data Management Engineer',
      meta: [
        { term: 'At', value: 'DARES' },
        { term: 'Under', value: 'French Ministry of Labour' },
        { term: 'Volume', value: '~100 tickets a month' },
        { term: 'Scope', value: 'from business requirements to validation' },
      ],
      body: 'Each ticket followed end to end, from the business need to validation.',
    },
    headset: {
      kicker: 'Jan 2024 - Jun 2026',
      step: 'Step 2 of 3',
      title: 'L1/L2 support',
      meta: [
        { term: 'Users', value: '~300 users' },
        { term: 'Context', value: 'high-criticality environment' },
        { term: 'Tools', value: 'R / RStudio' },
        { term: 'Access', value: 'ODBC' },
      ],
      body: 'Application deployment, access rights, remote database access and statistical environments, in a high-criticality environment.',
    },
    casd: {
      kicker: 'Jan 2024 - Jun 2026',
      step: 'Step 2 of 3',
      title: 'Sensitive data | CASD',
      meta: [
        { term: 'Data', value: 'sensitive data exchanges' },
        { term: 'Access', value: 'SD-Box terminal' },
        { term: 'Authentication', value: 'card, code and fingerprint' },
        { term: 'Environment', value: 'no Internet access' },
      ],
      body: 'Sensitive data exchanges with INSEE and France Travail go through the CASD secure enclaves. Day-to-day support for their users: SD-Box terminal, strong authentication, no Internet access.',
    },
    netherbrain: {
      kicker: '2026',
      step: 'Step 3 of 3',
      title: 'Netherbrain',
      meta: [
        { term: 'Project', value: 'LLM orchestration platform' },
        { term: 'Models', value: 'local Ollama on GPU, OpenRouter, Groq' },
        { term: 'Server', value: 'FastAPI back end (Pydantic, SQLAlchemy, Alembic migrations)' },
        { term: 'Database', value: 'PostgreSQL + pgvector' },
        { term: 'Interface', value: 'React / TypeScript' },
        { term: 'Quality', value: '300+ automated tests' },
      ],
      body: 'A platform orchestrating LLMs from several providers, locally or through any OpenAI-compatible API. Real-time streaming, RAG over attached documents, and a tool-using agent that shows its diff and waits for user approval before every write.',
    },
    homelab: {
      kicker: '2026',
      step: 'Step 3 of 3',
      title: 'Homelab',
      meta: [
        { term: 'Project', value: 'self-hosted infrastructure' },
        { term: 'Server', value: 'Proxmox' },
        { term: 'Firewall', value: 'OPNsense' },
        { term: 'Access', value: 'WireGuard VPN' },
        { term: 'Hardening', value: 'IPv4 + IPv6 host firewall, 2FA, key-only SSH' },
      ],
      body: 'A dedicated server reachable only through a VPN. Automated VM backups with a tested restore path; architecture and procedures fully documented and version-controlled.',
    },
    laptop: {
      kicker: 'Skills',
      step: 'The tools',
      title: 'Dev FullStack | AI Engineer',
      meta: [
        { term: 'Front-end', value: 'React, TypeScript, Next.js, Vite, Tailwind, Three.js' },
        {
          term: 'Back-end',
          value:
            'Python, FastAPI, Pydantic, REST API, SSE, PostgreSQL / pgvector, Alembic, Node.js / Express',
        },
        {
          term: 'AI & LLM',
          value:
            'Anthropic API, OpenAI SDK, Ollama, AI agents, Multi-agent systems, Tool calling, Structured outputs, RAG, Prompt engineering, Prompt caching, LLM-as-judge, Benchmarking, Vision (multimodal), Claude Code',
        },
        {
          term: 'Voice & audio',
          value:
            'Whisper (speech-to-text), Forced alignment (MMS), Text-to-speech (ElevenLabs), ffmpeg',
        },
        { term: 'Machine learning', value: 'PyTorch, Neural networks, Hyperparameter tuning' },
        {
          term: 'DevOps & quality',
          value:
            'Docker Compose, GitHub Actions, CI/CD, Git, pytest, Vitest, Linux, Nginx, Proxmox',
        },
        { term: 'Other', value: 'SQL, PHP / Drupal, Agile / Scrum, Jira' },
      ],
      body: 'The skills from the CV, from frontend to infrastructure.',
    },
    chest: {
      kicker: '2026',
      step: 'Step 3 of 3',
      title: 'The factory',
      meta: [{ term: 'Pipeline', value: 'end to end' }],
      body: 'Video channels produced end to end by AI agents, on my own server. I design the pipeline, the agents do the rest.',
    },
    card: {
      kicker: 'Business card',
      step: 'Contact',
      title: 'Ali Smaani',
      meta: [
        { term: 'Role', value: 'Dev FullStack | AI Engineer' },
        { term: 'Area', value: 'Paris, France · Open to remote' },
        { term: 'Status', value: 'Available immediately' },
        { term: 'Email', value: 'smanali.pro@gmail.com', href: 'mailto:smanali.pro@gmail.com' },
        {
          term: 'LinkedIn',
          value: 'linkedin.com/in/smaali',
          href: 'https://www.linkedin.com/in/smaali',
        },
      ],
      body: 'Looking for a full-stack developer with an AI focus, on site or remote? Write to me.',
    },
    monitor: {
      kicker: 'The journey',
      step: 'Profile',
      title: 'Dev FullStack | AI Engineer',
      meta: [
        { term: 'DEFI-METIERS', value: 'Sep 2020 - Aug 2023' },
        { term: 'DARES', value: 'Jan 2024 - Jun 2026' },
        { term: 'Projects', value: '2026' },
        { term: 'Status', value: 'Available immediately' },
      ],
      body: 'Full-stack developer (React / TypeScript, Python / FastAPI). I build applications that integrate generative AI end to end: React front end, FastAPI back end, PostgreSQL, and multi-provider LLMs with tool calling, structured outputs, RAG and streaming. I also run a self-hosted multi-agent automation platform in production. 3 years of web development, then 2.5 years of application engineering.',
    },
  },
} satisfies SheetsContent;
