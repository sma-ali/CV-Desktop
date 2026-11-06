import type { ReactNode } from 'react';
import styles from './Paper.module.css';

// La feuille de papier posée sur la page : la version express, les mentions
// légales et le repli du bureau s'y écrivent.
export function Paper({ children }: { children: ReactNode }) {
  return <div className={styles.paper}>{children}</div>;
}
