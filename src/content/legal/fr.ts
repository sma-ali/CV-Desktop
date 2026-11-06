import type { LegalContent } from './schema';

// Faits vérifiés le 06/11/2026 : adresse de Vercel (vercel.com/legal/privacy-policy),
// aucun cookie ni stockage dans le navigateur (recherche dans src), limite de
// débit gardée en mémoire une heure au plus (src/lib/contact/rate-limit.ts).
export const legalFr = {
  title: 'Mentions légales',
  intro: "Qui édite ce site, qui l'héberge, et ce que deviennent vos données.",
  updated: 'Mis à jour le 6 novembre 2026.',
  sections: [
    {
      id: 'editeur',
      heading: 'Éditeur',
      paragraphs: [
        "Ce site est le CV d'Ali Smaani, édité à titre personnel et non professionnel.",
        'Contact : smanali.pro@gmail.com, ou le formulaire de la carte de visite.',
      ],
    },
    {
      id: 'hebergeur',
      heading: 'Hébergeur',
      paragraphs: [
        'Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis. Contact : privacy@vercel.com.',
        'Le nom de domaine alismaani.fr est enregistré chez OVHcloud.',
      ],
    },
    {
      id: 'cookies',
      heading: "Cookies et mesure d'audience",
      paragraphs: [
        'Ce site ne dépose aucun cookie et ne mesure pas son audience. Il ne garde rien dans votre navigateur.',
      ],
    },
    {
      id: 'formulaire',
      heading: 'Formulaire de contact',
      paragraphs: [
        'Le formulaire demande votre nom, votre e-mail et votre message. Ils servent seulement à vous répondre.',
        "Le message n'est pas conservé sur le site : il m'arrive par e-mail, envoyé par Mailjet (groupe Sinch). Je le garde le temps de l'échange, puis au plus un an après votre dernier message.",
        "Pour freiner les envois automatiques, le site garde en mémoire l'adresse IP de l'envoi pendant une heure au plus. Vercel tient aussi des journaux techniques des visites.",
        "Base légale : l'intérêt légitime à répondre aux messages reçus.",
      ],
    },
    {
      id: 'droits',
      heading: 'Vos droits',
      paragraphs: [
        'Vous pouvez demander à consulter, corriger ou effacer vos données, ou vous opposer à leur usage, en écrivant à smanali.pro@gmail.com.',
        'Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).',
      ],
    },
    {
      id: 'code',
      heading: 'Code source',
      paragraphs: ['Le code du site est public sur GitHub : github.com/sma-ali/CV-Desktop.'],
    },
  ],
} satisfies LegalContent;
