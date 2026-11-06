'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useHydrated } from '@/components/hooks/useHydrated';
import type { ContactFormContent } from '@/content';
import type { Locale } from '@/content/locales';
import {
  checkContactFields,
  CONTACT_ERROR_CODES,
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  CONTACT_REDIRECT_STATES,
  HONEYPOT_FIELD,
  messageLength,
  type ContactErrorCode,
  type ContactField,
  type ContactResponse,
  type ContactSource,
  type ContactValues,
  type FieldErrorCode,
} from '@/lib/contact/rules';
import styles from './ContactForm.module.css';

export interface ContactFormProps {
  texts: ContactFormContent;
  locale: Locale;
  /** La page où revenir après un envoi sans JavaScript. */
  from: ContactSource;
  /** L'adresse proposée quand l'envoi échoue. */
  email: string;
  /** « page » : aux couleurs du thème ; « bristol » : sur le papier clair de la fiche. */
  variant: 'page' | 'bristol';
  /**
   * Prépare les messages d'état d'un envoi sans JavaScript, affichés par
   * :target (#contact-envoye...). Une seule fois par page : la version express.
   */
  noScriptStatus?: boolean;
  /** Replié derrière un bouton « Écrire un message » (version express). */
  collapsible?: boolean;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; code: ContactErrorCode | 'network' };

type FieldErrors = Partial<Record<ContactField, FieldErrorCode>>;

const EMPTY: ContactValues = { name: '', email: '', message: '' };

/** Remplace {min}, {max} et {n} dans un texte du contenu. */
function fill(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

function isErrorCode(value: unknown): value is ContactErrorCode {
  return (CONTACT_ERROR_CODES as readonly unknown[]).includes(value);
}

/** Le code d'une réponse sans corps lisible, d'après son statut. */
function codeOfStatus(status: number): ContactErrorCode {
  if (status === 400) return 'validation';
  if (status === 403) return 'origin';
  if (status === 413) return 'too_large';
  if (status === 415 || status === 405) return 'unsupported';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  return 'send_failed';
}

// Le formulaire de contact, dans la version express et dans la fiche de la
// carte de visite. Avec JavaScript, il vérifie les champs avec les règles du
// serveur (src/lib/contact/rules.ts), envoie en JSON et annonce l'état dans
// une région aria-live. Sans JavaScript, c'est un formulaire HTML classique :
// la validation native du navigateur, puis la route répond par une
// redirection 303 vers la page, dont l'ancre affiche l'état.
export function ContactForm({
  texts,
  locale,
  from,
  email,
  variant,
  noScriptStatus,
  collapsible,
}: ContactFormProps) {
  const id = useId();
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const hydrated = useHydrated();
  const fields = useRef<Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>>({
    name: null,
    email: null,
    message: null,
  });
  const honeypot = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  /**
   * Instant où le formulaire est affiché (horloge du navigateur). La durée
   * envoyée part de là, pas de la première frappe : un message collé et des
   * champs remplis par le navigateur ne doivent pas passer pour un robot.
   */
  const shownAt = useRef<number | null>(null);

  // Hydraté, le formulaire valide lui-même (noValidate) et envoie par fetch.
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  // Arrivé par le lien du contact (#contact), le formulaire replié s'ouvre.
  useEffect(() => {
    if (details.current && window.location.hash === '#contact') details.current.open = true;
  }, []);

  const fieldId = (field: ContactField) => `${id}-${field}`;
  const errorId = (field: ContactField) => `${id}-${field}-error`;
  const hintId = (field: ContactField) => `${id}-${field}-hint`;

  const errorText = (field: ContactField, code: FieldErrorCode): string => {
    const messages: Partial<Record<FieldErrorCode, string>> = texts[field].errors;
    const limits = CONTACT_LIMITS[field];
    return fill(messages[code] ?? messages.invalid ?? '', {
      min: 'min' in limits ? limits.min : 0,
      max: limits.max,
    });
  };

  const focusFirst = (found: FieldErrors) => {
    const first = CONTACT_FIELDS.find((field) => found[field]);
    if (first) fields.current[first]?.focus();
  };

  const onChange = (field: ContactField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (status.kind === 'sent') setStatus({ kind: 'idle' });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.kind === 'sending') return;

    const found = checkContactFields(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus({ kind: 'error', code: 'validation' });
      focusFirst(found);
      return;
    }

    setErrors({});
    setStatus({ kind: 'sending' });
    const body = {
      ...values,
      locale,
      from,
      [HONEYPOT_FIELD]: honeypot.current?.value ?? '',
      typingMs: Date.now() - (shownAt.current ?? Date.now()),
    };

    let response: Response;
    try {
      response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      setStatus({ kind: 'error', code: 'network' });
      return;
    }

    let result: ContactResponse | null = null;
    try {
      result = (await response.json()) as ContactResponse;
    } catch {
      result = null;
    }

    if (response.ok && result?.ok) {
      setValues(EMPTY);
      shownAt.current = Date.now();
      setStatus({ kind: 'sent' });
      return;
    }

    const code =
      result && !result.ok && isErrorCode(result.error)
        ? result.error
        : codeOfStatus(response.status);
    const returned: FieldErrors = {};
    if (result && !result.ok && result.fields) {
      for (const field of CONTACT_FIELDS) {
        const fieldCode = result.fields[field];
        if (fieldCode) returned[field] = fieldCode;
      }
    }
    setErrors(returned);
    setStatus({ kind: 'error', code });
    focusFirst(returned);
  };

  // Échap dans un champ rempli ne ferme pas la fiche (et ne perd pas la saisie).
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target;
    if (
      event.key === 'Escape' &&
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      target.value !== ''
    ) {
      event.stopPropagation();
    }
  };

  const sending = status.kind === 'sending';
  const statusText =
    status.kind === 'sent'
      ? texts.status.sent
      : status.kind === 'error'
        ? texts.status[status.code]
        : status.kind === 'sending'
          ? texts.sending
          : '';
  const offerEmail =
    status.kind === 'error' && (status.code === 'unavailable' || status.code === 'send_failed');
  const length = messageLength(values.message);

  const describedBy = (field: ContactField, hint: boolean) =>
    [hint ? hintId(field) : null, errors[field] ? errorId(field) : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const form = (
    <form
      className={styles.form}
      action="/api/contact"
      method="post"
      noValidate={hydrated}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      aria-busy={sending}
      data-contact-form={from}
    >
      <p className={styles.intro}>{texts.intro}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="from" value={from} />

      <div className={styles.field}>
        <label htmlFor={fieldId('name')}>{texts.name.label}</label>
        <input
          ref={(element) => {
            fields.current.name = element;
          }}
          id={fieldId('name')}
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={CONTACT_LIMITS.name.max}
          value={values.name}
          onChange={(event) => onChange('name', event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name', false)}
        />
        {errors.name ? (
          <p id={errorId('name')} className={styles.error}>
            {errorText('name', errors.name)}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={fieldId('email')}>{texts.email.label}</label>
        <input
          ref={(element) => {
            fields.current.email = element;
          }}
          id={fieldId('email')}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={CONTACT_LIMITS.email.max}
          value={values.email}
          onChange={(event) => onChange('email', event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', true)}
        />
        <p id={hintId('email')} className={styles.hint}>
          {texts.email.hint}
        </p>
        {errors.email ? (
          <p id={errorId('email')} className={styles.error}>
            {errorText('email', errors.email)}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={fieldId('message')}>{texts.message.label}</label>
        <textarea
          ref={(element) => {
            fields.current.message = element;
          }}
          id={fieldId('message')}
          name="message"
          rows={6}
          required
          minLength={CONTACT_LIMITS.message.min}
          maxLength={CONTACT_LIMITS.message.max}
          value={values.message}
          onChange={(event) => onChange('message', event.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message', true)}
        />
        <p className={styles.hintRow}>
          <span id={hintId('message')} className={styles.hint}>
            {fill(texts.message.hint, CONTACT_LIMITS.message)}
          </span>
          {hydrated ? (
            <span
              className={styles.counter}
              data-over={length > CONTACT_LIMITS.message.max ? '' : undefined}
              data-contact-counter=""
            >
              {fill(texts.message.counter, { n: length, max: CONTACT_LIMITS.message.max })}
            </span>
          ) : null}
        </p>
        {errors.message ? (
          <p id={errorId('message')} className={styles.error}>
            {errorText('message', errors.message)}
          </p>
        ) : null}
      </div>

      {/* Le piège à robots : hors de l'écran, hors de l'ordre de tabulation,
          caché aux lecteurs d'écran. Un humain ne le remplit jamais. */}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>{texts.honeypot}</label>
        <input
          ref={honeypot}
          id={`${id}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={sending}>
          {sending ? texts.sending : texts.submit}
        </button>
        <p
          className={styles.status}
          role="status"
          aria-live="polite"
          data-contact-status={status.kind === 'error' ? status.code : status.kind}
        >
          {statusText}
          {offerEmail ? (
            <>
              {' '}
              <a href={`mailto:${email}`}>{texts.emailInstead}</a>
            </>
          ) : null}
        </p>
      </div>

      <p className={styles.privacy}>{texts.privacy}</p>
    </form>
  );

  return (
    <div className={`${styles.root} ${variant === 'bristol' ? styles.bristol : ''}`}>
      {noScriptStatus ? <NoScriptStatus texts={texts} email={email} /> : null}
      {collapsible ? (
        <details ref={details} className={styles.details}>
          <summary className={styles.summary}>{texts.open}</summary>
          {form}
        </details>
      ) : (
        form
      )}
    </div>
  );
}

/**
 * Les messages d'un envoi sans JavaScript : la route redirige vers
 * « ?contact=envoye#contact-envoye », et seul le message visé par l'ancre
 * s'affiche (:target). Avec JavaScript, l'état passe par la région aria-live.
 */
function NoScriptStatus({ texts, email }: { texts: ContactFormContent; email: string }) {
  return CONTACT_REDIRECT_STATES.map((state) => {
    const code = state === 'envoye' ? null : (state.slice('erreur-'.length) as ContactErrorCode);
    return (
      <p
        key={state}
        id={`contact-${state}`}
        className={styles.targetStatus}
        data-error={code ? '' : undefined}
        tabIndex={-1}
      >
        {code ? texts.status[code] : texts.status.sent}
        {code === 'unavailable' || code === 'send_failed' ? (
          <>
            {' '}
            <a href={`mailto:${email}`}>{texts.emailInstead}</a>
          </>
        ) : null}
      </p>
    );
  });
}
