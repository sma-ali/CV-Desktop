import type { TextPageContent } from '../text-page';

// Same facts as fr.ts, checked on 07/11/2026.
export const makingOfEn = {
  title: 'How this site is built',
  intro: 'The technical choices behind the 3D desk, for anyone who wants to look under the hood.',
  updated: 'Updated on 7 November 2026.',
  sections: [
    {
      id: 'pile',
      heading: 'The stack',
      paragraphs: [
        'Next.js (App Router) and strict TypeScript. The scene is built with React Three Fiber on three.js, with the Rapier physics engine in WebAssembly. The site is hosted on Vercel.',
        'Every text, in French and in English, lives in a single content module, validated by zod at build time. The desk, the express version and the PDF resume read the same source: invalid content fails the build.',
      ],
    },
    {
      id: 'bureau',
      heading: 'The 3D desk',
      paragraphs: [
        'The page shows up before the 3D: the server already sends the interface and the full resume, readable by search engines. three.js arrives in a separate file, and Rapier even later, once the objects have landed.',
        "Every object is a physics body: you can slide it, throw it, tip it over and stack it. At rest, everything sleeps and nothing is computed. The light follows the visitor's time of day, and the sounds are synthesised in the browser, with no audio file.",
        'Without WebGL, or if the scene crashes or takes too long, the express version takes its place.',
      ],
    },
    {
      id: 'securite',
      heading: 'Security',
      paragraphs: [
        'A strict Content Security Policy: nothing loads from another origin, and no eval. So the texts in the scene are painted into textures, with fonts hosted by the site.',
        'The contact form is validated on the server, with rate limiting, a bot trap and a Vercel firewall rule. Messages arrive by email, from a signed domain (SPF, DKIM, DMARC). No key lives in the code.',
      ],
    },
    {
      id: 'usine',
      heading: 'The factory figures',
      paragraphs: [
        'Every morning, my server exports a public summary of its activity. The site reads it, validates it and rounds everything down before showing it. The summary holds no name, no host, no address.',
      ],
    },
    {
      id: 'tests',
      heading: 'Tests',
      paragraphs: [
        'More than 600 Vitest tests cover the logic and the content: physics, framing, gestures, the form, rounding, and the match between the resume and the texts painted in the scene.',
        'Playwright replays real journeys on the production build, on desktop and on a phone: picking up an object, flipping it, sliding it, tidying the desk, sending the form, switching language. The 3D is drawn there without a graphics card.',
        'axe checks accessibility (WCAG 2.2 AA) in both light and dark themes. Everything runs on every change on GitHub Actions.',
      ],
    },
    {
      id: 'accessibilite',
      heading: 'Accessibility',
      paragraphs: [
        'Everything works with a keyboard: the chips to pick an object, the arrows to turn it, R to flip it, Escape to put it down. If you prefer less motion, the scene arrives already settled, with no tour and no momentum.',
      ],
    },
    {
      id: 'code',
      heading: 'The code',
      paragraphs: [
        'The repository is public: github.com/sma-ali/CV-Desktop. Its README gets the site running locally in a few minutes.',
      ],
    },
  ],
} satisfies TextPageContent;
