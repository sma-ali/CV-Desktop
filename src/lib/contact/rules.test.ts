import { describe, expect, it } from 'vitest';
import {
  checkContactFields,
  checkEmail,
  checkMessage,
  checkName,
  cleanMessage,
  cleanName,
  CONTACT_LIMITS,
  CONTACT_REDIRECT_STATES,
  messageLength,
  redirectState,
} from './rules';
import { contactRequestSchema, fieldErrors } from './schema';

const valid = {
  name: 'Camille Martin',
  email: 'camille@exemple.fr',
  message: 'Bonjour, une question sur votre parcours.',
  locale: 'fr',
};

describe('règles des champs', () => {
  it('nettoie le nom et refuse les caractères de contrôle', () => {
    expect(cleanName('  Camille   Martin ')).toBe('Camille Martin');
    expect(checkName('  Camille  ')).toBeNull();
    expect(checkName('   ')).toBe('required');
    expect(checkName('a'.repeat(CONTACT_LIMITS.name.max))).toBeNull();
    expect(checkName('a'.repeat(CONTACT_LIMITS.name.max + 1))).toBe('too_long');
    expect(checkName('Camille\nBcc: x@y.fr')).toBe('invalid');
    expect(checkName('Camille\u0000')).toBe('invalid');
    expect(checkName('Camille ‮emmoc')).toBe('invalid');
  });

  it('refuse les caractères invisibles et les marques de direction dans le nom', () => {
    for (const mark of ['\u200b', '\u200e', '\u200f', '\u061c', '\u2060', '\ufeff', '\u{e0041}']) {
      expect(checkName(`Bo${mark}b`), mark.codePointAt(0)!.toString(16)).toBe('invalid');
    }
    // Les liants restent permis : certaines écritures en ont besoin.
    expect(checkName('Mohammad\u200cReza')).toBeNull();
    expect(checkName('Zoé Ørsted-Łukasz')).toBeNull();
  });

  it('veut une adresse en ASCII imprimable', () => {
    expect(checkEmail('a\u0001x@b.fr')).toBe('invalid');
    expect(checkEmail('a\u007fx@b.fr')).toBe('invalid');
    expect(checkEmail('a\u202ex@b.fr')).toBe('invalid');
    expect(checkEmail('a\u200bx@b.fr')).toBe('invalid');
    expect(checkEmail('camille.martin+cv@exemple.fr')).toBeNull();
  });

  it('vérifie le format et la longueur de l’e-mail', () => {
    expect(checkEmail(' camille@exemple.fr ')).toBeNull();
    expect(checkEmail('')).toBe('required');
    expect(checkEmail('camille')).toBe('invalid');
    expect(checkEmail('camille@exemple')).toBe('invalid');
    expect(checkEmail('a b@exemple.fr')).toBe('invalid');
    expect(checkEmail('camille@exemple.fr\nBcc: x@y.fr')).toBe('invalid');
    expect(checkEmail('"x"<a@b.fr>')).toBe('invalid');
    expect(checkEmail(`${'a'.repeat(250)}@b.fr`)).toBe('too_long');
  });

  it('compte le message comme le navigateur, retours à la ligne compris', () => {
    expect(cleanMessage('  Ligne 1\r\nLigne 2\r\n ')).toBe('Ligne 1\nLigne 2');
    expect(messageLength('a\r\nb')).toBe(3);
    expect(checkMessage('')).toBe('required');
    expect(checkMessage('Trop court')).toBeNull(); // 10 caractères tout juste
    expect(checkMessage('Court')).toBe('too_short');
    expect(checkMessage('a'.repeat(CONTACT_LIMITS.message.max))).toBeNull();
    expect(checkMessage('a'.repeat(CONTACT_LIMITS.message.max + 1))).toBe('too_long');
    // 5000 caractères avec des \r\n : la même longueur que dans le navigateur.
    expect(checkMessage(`${'a'.repeat(2499)}\r\n${'b'.repeat(2500)}`)).toBeNull();
    expect(checkMessage('Bonjour,\n\tun message\u0007')).toBe('invalid');
  });

  it('rend les erreurs dans l’ordre du formulaire', () => {
    expect(checkContactFields({ name: '', email: 'x', message: 'court' })).toEqual({
      name: 'required',
      email: 'invalid',
      message: 'too_short',
    });
    expect(checkContactFields(valid)).toEqual({});
  });

  it('nomme les états d’un envoi sans JavaScript', () => {
    expect(redirectState(null)).toBe('envoye');
    expect(redirectState('rate_limited')).toBe('erreur-rate_limited');
    expect(CONTACT_REDIRECT_STATES).toContain('erreur-validation');
    expect(CONTACT_REDIRECT_STATES).toHaveLength(8);
  });
});

describe('schéma de la route', () => {
  it('accepte un envoi valide et le nettoie', () => {
    const result = contactRequestSchema.parse({ ...valid, name: '  Camille  Martin ' });
    expect(result).toMatchObject({ name: 'Camille Martin', locale: 'fr' });
    expect(result.typingMs).toBeUndefined();
  });

  it('lit la durée de saisie et la source, même en texte (formulaire HTML)', () => {
    const result = contactRequestSchema.parse({ ...valid, typingMs: '4200', from: 'desk' });
    expect(result.typingMs).toBe(4200);
    expect(result.from).toBe('desk');
    expect(contactRequestSchema.parse({ ...valid, typingMs: '', from: '' }).typingMs).toBe(
      undefined,
    );
  });

  it('rend un code par champ fautif', () => {
    const result = contactRequestSchema.safeParse({
      name: 'a'.repeat(101),
      email: 42,
      message: 'court',
      locale: 'de',
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      name: 'too_long',
      email: 'invalid',
      message: 'too_short',
      locale: 'invalid',
    });
  });

  it('traite un champ absent comme vide', () => {
    const result = contactRequestSchema.safeParse({ locale: 'en' });
    expect(fieldErrors(result.error!)).toEqual({
      name: 'required',
      email: 'required',
      message: 'required',
    });
  });

  it('refuse une durée de saisie illisible', () => {
    const result = contactRequestSchema.safeParse({ ...valid, typingMs: 'vite' });
    expect(fieldErrors(result.error!)).toEqual({ typingMs: 'invalid' });
  });
});
