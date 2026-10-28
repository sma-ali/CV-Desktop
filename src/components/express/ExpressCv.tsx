import { Fragment, useId } from 'react';
import { getContent, type Locale } from '@/content';
import { formatMonthPeriod, formatYearPeriod, RANGE_SEPARATOR, type DateLabel } from '@/lib/dates';
import { displayUrl } from '@/lib/urls';
import styles from './ExpressCv.module.css';

// Le CV entier en HTML, depuis le module de contenu. Composant serveur sans
// état ni lien vers une route : il sert la page /[locale]/express et servira
// de repli sans WebGL et de panneau par-dessus le bureau en 3D.
export function ExpressCv({ locale }: { locale: Locale }) {
  const nameId = useId();
  const content = getContent(locale);
  const { profile, contact, sections, experiences, projects, education, skills, ui } = content;
  const { softSkills, languages, interests } = content;

  const contactLinks = [
    { label: ui.emailLabel, href: `mailto:${contact.email}`, text: contact.email },
    {
      label: ui.linkedinLabel,
      href: contact.linkedin,
      text: displayUrl(contact.linkedin),
      me: true,
    },
    { label: ui.githubLabel, href: contact.github, text: displayUrl(contact.github), me: true },
    { label: ui.websiteLabel, href: contact.website, text: displayUrl(contact.website) },
  ];

  return (
    <article className={styles.cv} aria-labelledby={nameId}>
      <header className={styles.identity}>
        <h1 id={nameId} className={styles.name}>
          {profile.name}
        </h1>
        <p className={styles.headline}>{profile.headline}</p>
        <p className={styles.location}>{profile.location}</p>
      </header>

      <section className={styles.contact}>
        <h2 className={styles.heading}>{sections.contact}</h2>
        <ul className={styles.contactList}>
          {contactLinks.map(({ label, href, text, me }) => (
            <li key={href}>
              <span className={styles.contactLabel}>{label}</span>{' '}
              <a href={href} rel={me ? 'me' : undefined} className={styles.contactLink}>
                {text}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.summary}>
        <h2 className={styles.heading}>{sections.summary}</h2>
        <p className={styles.summaryText}>{profile.summary}</p>
      </section>

      <div className={styles.main}>
        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.experience}</h2>
          <ol className={styles.entries}>
            {experiences.map((experience) => (
              <li key={experience.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <h3 className={styles.entryTitle}>{experience.role}</h3>
                  <p className={styles.period}>
                    <Period bounds={formatMonthPeriod(experience.period, locale)} />
                  </p>
                </div>
                <p className={styles.organization}>
                  <span className={styles.organizationName}>{experience.organization}</span>
                  {' | '}
                  <span className={styles.organizationDetail}>{experience.organizationDetail}</span>
                </p>
                <ul className={styles.highlights}>
                  {experience.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.projects}</h2>
          <ul className={styles.entries}>
            {projects.map((project) => (
              <li key={project.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <h3 className={styles.entryTitle}>{project.name}</h3>
                  <p className={styles.period}>
                    <Period bounds={formatYearPeriod(project.year, project.year)} />
                  </p>
                </div>
                <p className={styles.tagline}>{project.tagline}</p>
                <ul className={styles.highlights}>
                  {project.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                {/* Le dépôt n'est lié que s'il est public sur GitHub. */}
                {project.repository.public ? (
                  <p className={styles.repository}>
                    <span className={styles.contactLabel}>{ui.repositoryLabel}</span>{' '}
                    <a href={project.repository.url} className={styles.contactLink}>
                      {displayUrl(project.repository.url)}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.side}>
        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.skills}</h2>
          {skills.map((group) => (
            <div key={group.id} className={styles.skillGroup}>
              <h3 className={styles.skillLabel}>{group.label}</h3>
              <ul className={styles.chips}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.education}</h2>
          <ol className={styles.education}>
            {education.map((item) => (
              <li key={item.id}>
                <p className={styles.educationTitle}>{item.title}</p>
                <p className={styles.educationSchool}>{item.school}</p>
                <p className={styles.period}>
                  <Period bounds={formatYearPeriod(item.from, item.to)} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.languages}</h2>
          <ul className={styles.rows}>
            {languages.map((language) => (
              <li key={language.id}>
                <span>{language.name}</span>
                <span className={styles.leader} aria-hidden="true" />
                <span className={styles.level}>{language.level}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.softSkills}</h2>
          <ul className={styles.chips}>
            {softSkills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{sections.interests}</h2>
          <ul className={styles.interests}>
            {interests.map((interest) => (
              <li key={interest}>{interest}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

// « Janv. 2024 - Juin 2026 », chaque borne dans un <time> lisible par les machines.
function Period({ bounds }: { bounds: DateLabel[] }) {
  return bounds.map((bound, index) => (
    <Fragment key={bound.dateTime}>
      {index > 0 ? RANGE_SEPARATOR : null}
      <time dateTime={bound.dateTime}>{bound.label}</time>
    </Fragment>
  ));
}
