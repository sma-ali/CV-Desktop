import type { ReactNode } from 'react';
import { Paper } from '@/components/paper/Paper';
import styles from './Fallback.module.css';

// Le repli du bureau : pourquoi la version express s'affiche, un lien vers
// sa page, et la version express elle-même sur sa feuille de papier. Rendu
// dans le HTML du serveur, caché tant que la scène tourne (Fallback.module.css).
// Il embarque un second formulaire de contact (celui de la carte de visite
// est dans la fiche) : le prix d'un repli qui marche sans JavaScript.
export function Fallback({
  reason,
  expressHref,
  expressLink,
  children,
}: {
  reason: string;
  expressHref: string;
  expressLink: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.fallback} aria-label={expressLink}>
      <p className={styles.notice}>
        {reason}{' '}
        <a href={expressHref} className={styles.link}>
          {expressLink}
        </a>
      </p>
      <Paper>{children}</Paper>
    </section>
  );
}
