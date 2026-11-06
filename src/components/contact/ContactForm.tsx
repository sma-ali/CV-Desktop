'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useHydrated } from '@/components/hooks/useHydrated';
import type { ContactFormContent } from '@/content';
import type { Locale } from '@/content/locales';
import {
  checkContactFields,
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  CONTACT_REDIRECT_STATES,
  HONEYPOT_FIELD,
  messageLength,
  type ContactErrorCode,
  type ContactField,
  type ContactSource,
  type ContactValues,
  type FieldErrorCode,
} from '@/lib/contact/rules';
import styles from './ContactForm.module.css';
import { postContact, type FieldErrors } from './postContact';

export interface ContactFormProps {
  texts: ContactFormContent;
  locale: Locale;
  /** La page où revenir après un envoi sans JavaScript. */
  from: ContactSource;
  /** L'adresse proposée quand l'envoi échoue. */
  email: string;
  /** « page » : aux couleurs du thème ; « sheet » : sur le papier clair de la fiche du bureau. */
  variant: 'page' | 'sheet';
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

const EMPTY: ContactValues = { name: '', email: '', message: '' };

/** Remplace {min}, {max} et {n} dans un texte du contenu. */
function fill(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
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
    if (first) document.getElementById(fieldId(first))?.focus();
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
    const result = await postContact({
      ...values,
      locale,
      from,
      [HONEYPOT_FIELD]: honeypot.current?.value ?? '',
      typingMs: Date.now() - (shownAt.current ?? Date.now()),
    });

    if (result.ok) {
      setValues(EMPTY);
      shownAt.current = Date.now();
      setStatus({ kind: 'sent' });
      return;
    }
    setErrors(result.fields);
    setStatus({ kind: 'error', code: result.code });
    focusFirst(result.fields);
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

  /** Ce que les trois champs ont en commun : nom, limite, valeur, erreur. */
  const control = (field: ContactField, hint: boolean) => ({
    id: fieldId(field),
    name: field,
    required: true,
    maxLength: CONTACT_LIMITS[field].max,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(field, event.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': describedBy(field, hint),
  });

  const fieldError = (field: ContactField) => {
    const code = errors[field];
    return code ? { id: errorId(field), text: errorText(field, code) } : null;
  };

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

      <Field label={texts.name.label} controlId={fieldId('name')} error={fieldError('name')}>
        <input {...control('name', false)} type="text" autoComplete="name" />
      </Field>

      <Field label={texts.email.label} controlId={fieldId('email')} error={fieldError('email')}>
        <input
          {...control('email', true)}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
        />
        <p id={hintId('email')} className={styles.hint}>
          {texts.email.hint}
        </p>
      </Field>

      <Field
        label={texts.message.label}
        controlId={fieldId('message')}
        error={fieldError('message')}
      >
        <textarea {...control('message', true)} rows={6} minLength={CONTACT_LIMITS.message.min} />
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
      </Field>

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
    <div className={`${styles.root} ${variant === 'sheet' ? styles.onSheet : ''}`}>
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

/** Un champ du formulaire : son libellé, le champ et ses aides, son erreur. */
function Field({
  label,
  controlId,
  error,
  children,
}: {
  label: string;
  controlId: string;
  error: { id: string; text: string } | null;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={controlId}>{label}</label>
      {children}
      {error ? (
        <p id={error.id} className={styles.error}>
          {error.text}
        </p>
      ) : null}
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
