import type { LegalContent } from './schema';

// Même contenu que fr.ts, en anglais.
export const legalEn = {
  title: 'Legal notice',
  intro: 'Who publishes this site, who hosts it, and what happens to your data.',
  updated: 'Updated on 6 November 2026.',
  sections: [
    {
      id: 'editeur',
      heading: 'Publisher',
      paragraphs: [
        'This site is the resume of Ali Smaani, published in a personal, non-professional capacity.',
        'Contact: smanali.pro@gmail.com, or the form on the business card.',
      ],
    },
    {
      id: 'hebergeur',
      heading: 'Host',
      paragraphs: [
        'Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States. Contact: privacy@vercel.com.',
        'The alismaani.fr domain name is registered with OVHcloud.',
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies and analytics',
      paragraphs: [
        'This site sets no cookies and runs no analytics. It stores nothing in your browser.',
      ],
    },
    {
      id: 'formulaire',
      heading: 'Contact form',
      paragraphs: [
        'The form asks for your name, your email and your message. They are only used to reply to you.',
        'The message is not stored on the site: it reaches me by email, sent through Mailjet (Sinch group). I keep it for the time of our exchange, then at most one year after your last message.',
        'To slow down automated sending, the site keeps the IP address of each submission in memory for one hour at most. Vercel also keeps technical logs of visits.',
        'Legal basis: the legitimate interest in replying to the messages received.',
      ],
    },
    {
      id: 'droits',
      heading: 'Your rights',
      paragraphs: [
        'You can ask to access, correct or erase your data, or object to its use, by writing to smanali.pro@gmail.com.',
        'You can also lodge a complaint with the CNIL, the French data protection authority (cnil.fr).',
      ],
    },
    {
      id: 'code',
      heading: 'Source code',
      paragraphs: ['The code of this site is public on GitHub: github.com/sma-ali/CV-Desktop.'],
    },
  ],
} satisfies LegalContent;
