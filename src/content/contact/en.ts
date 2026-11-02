import type { ContactFormContent } from './schema';

// Proposed texts, to be approved by Ali.
export const contactFormEn = {
  open: 'Write a message',
  intro: 'A question, an offer, a project? Write to me here and I will reply by email.',
  name: {
    label: 'Your name',
    errors: {
      required: 'Please enter your name.',
      too_long: 'Your name is longer than {max} characters.',
      invalid: 'Your name contains characters that are not accepted.',
    },
  },
  email: {
    label: 'Your email',
    hint: 'Only used to reply to you.',
    errors: {
      required: 'Please enter your email, so I can reply.',
      too_long: 'This address is longer than {max} characters.',
      invalid:
        'This email address looks incomplete. Please check it, for example name@example.com.',
    },
  },
  message: {
    label: 'Your message',
    hint: 'Between {min} and {max} characters.',
    counter: '{n} of {max}',
    errors: {
      required: 'Please write your message.',
      too_short: 'Your message is a little short: at least {min} characters.',
      too_long: 'Your message is longer than {max} characters. Please shorten it a little.',
      invalid: 'Your message contains characters that are not accepted.',
    },
  },
  honeypot: 'Leave this field empty',
  submit: 'Send',
  sending: 'Sending',
  privacy: 'Your message reaches me by email, through Mailjet. It is not stored on this site.',
  emailInstead: 'Write by email',
  status: {
    sent: 'Thank you, your message is on its way. I will reply soon.',
    validation: 'Your message was not sent. Please check the highlighted fields and send it again.',
    origin: 'Your message was not sent. Please reload the page and try again.',
    rate_limited:
      'You have sent several messages in a short time. Please try again in a few minutes.',
    too_large: 'Your message is too long to be sent. Please shorten it and try again.',
    unsupported: 'Your message was not sent. Please reload the page and try again.',
    unavailable: 'The form is unavailable right now. Please write to me directly by email.',
    send_failed: 'Your message was not sent. Please try again, or write to me directly by email.',
    network: 'The server is not responding. Please check your connection and try again.',
  },
} satisfies ContactFormContent;
