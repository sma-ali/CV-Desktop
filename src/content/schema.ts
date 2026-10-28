import { z } from 'zod';

// Texte affiché : jamais vide, sans espace parasite au début ni à la fin.
const text = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, 'espace en trop au début ou à la fin');

const texts = z.array(text).min(1);

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant attendu en kebab-case');

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mois attendu au format AAAA-MM');

const year = z.int().min(2000).max(2100);

const httpsUrl = z.url({ protocol: /^https$/ });

// Les dates restent structurées : le format affiché (« janv. 2024 ») se décide
// à l'affichage, selon la langue.
const period = z
  .strictObject({ start: yearMonth, end: yearMonth })
  .refine((value) => value.start <= value.end, 'la période finit avant de commencer');

const profileSchema = z.strictObject({
  name: text,
  headline: text,
  summary: text,
  location: text,
});

const contactSchema = z.strictObject({
  email: z.email(),
  linkedin: httpsUrl,
  github: httpsUrl,
  website: httpsUrl,
});

const sectionsSchema = z.strictObject({
  summary: text,
  experience: text,
  projects: text,
  education: text,
  skills: text,
  softSkills: text,
  languages: text,
  interests: text,
  contact: text,
});

const experienceSchema = z.strictObject({
  id,
  role: text,
  organization: text,
  organizationDetail: text,
  period,
  highlights: texts,
});

const projectSchema = z.strictObject({
  id,
  name: text,
  tagline: text,
  year,
  repository: z.strictObject({
    url: z.url({ protocol: /^https$/, hostname: /^github\.com$/ }),
    // Le site ne lie le dépôt que s'il est public. À vérifier sur GitHub
    // avant de passer à true.
    public: z.boolean(),
  }),
  highlights: texts,
});

const educationSchema = z
  .strictObject({
    id,
    title: text,
    school: text,
    from: year,
    to: year,
  })
  .refine((value) => value.from <= value.to, 'la formation finit avant de commencer');

const skillGroupSchema = z.strictObject({
  id,
  label: text,
  items: texts,
});

const spokenLanguageSchema = z.strictObject({
  id,
  name: text,
  level: text,
});

// Textes de l'interface (boutons, liens, libellés) : aucun fait du CV ici.
const uiSchema = z.strictObject({
  kicker: text,
  kickerDetail: text,
  skipToContent: text,
  print: text,
  languageNav: text,
  emailLabel: text,
  linkedinLabel: text,
  githubLabel: text,
  websiteLabel: text,
  repositoryLabel: text,
  backToTop: text,
});

export const contentSchema = z.strictObject({
  profile: profileSchema,
  contact: contactSchema,
  sections: sectionsSchema,
  experiences: z.array(experienceSchema).min(1),
  projects: z.array(projectSchema).min(1),
  education: z.array(educationSchema).min(1),
  skills: z.array(skillGroupSchema).min(1),
  softSkills: texts,
  languages: z.array(spokenLanguageSchema).min(1),
  interests: texts,
  ui: uiSchema,
});

export type Content = z.infer<typeof contentSchema>;
export type Contact = Content['contact'];
export type Experience = Content['experiences'][number];
export type Project = Content['projects'][number];
export type Education = Content['education'][number];
export type Ui = Content['ui'];
