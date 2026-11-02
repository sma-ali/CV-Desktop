import type { ContactFormContent } from './schema';

// Propositions de textes, à valider par Ali.
export const contactFormFr = {
  open: 'Écrire un message',
  intro: 'Une question, une offre, un projet ? Écrivez-moi ici, je vous réponds par e-mail.',
  name: {
    label: 'Votre nom',
    errors: {
      required: 'Indiquez votre nom.',
      too_long: 'Votre nom dépasse {max} caractères.',
      invalid: 'Votre nom contient des caractères non acceptés.',
    },
  },
  email: {
    label: 'Votre e-mail',
    hint: 'Pour vous répondre, rien de plus.',
    errors: {
      required: 'Indiquez votre e-mail, pour que je puisse vous répondre.',
      too_long: 'Cette adresse dépasse {max} caractères.',
      invalid: 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple nom@exemple.fr.',
    },
  },
  message: {
    label: 'Votre message',
    hint: 'Entre {min} et {max} caractères.',
    counter: '{n} sur {max}',
    errors: {
      required: 'Écrivez votre message.',
      too_short: 'Votre message est un peu court : {min} caractères au moins.',
      too_long: 'Votre message dépasse {max} caractères. Raccourcissez-le un peu.',
      invalid: 'Votre message contient des caractères non acceptés.',
    },
  },
  honeypot: 'Laissez ce champ vide',
  submit: 'Envoyer',
  sending: 'Envoi en cours',
  privacy: "Votre message m'arrive par e-mail, via Mailjet. Il n'est pas conservé sur le site.",
  emailInstead: 'Écrire par e-mail',
  status: {
    sent: 'Merci, votre message est bien parti. Je vous réponds vite.',
    validation: "Le message n'est pas parti. Vérifiez les champs signalés, puis renvoyez-le.",
    origin: "Le message n'est pas parti. Rechargez la page, puis réessayez.",
    rate_limited:
      'Vous avez envoyé plusieurs messages en peu de temps. Réessayez dans quelques minutes.',
    too_large: 'Votre message est trop long pour partir. Raccourcissez-le, puis réessayez.',
    unsupported: "Le message n'est pas parti. Rechargez la page, puis réessayez.",
    unavailable:
      'Le formulaire est indisponible pour le moment. Écrivez-moi directement par e-mail.',
    send_failed: "Votre message n'est pas parti. Réessayez, ou écrivez-moi directement par e-mail.",
    network: 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.',
  },
} satisfies ContactFormContent;
