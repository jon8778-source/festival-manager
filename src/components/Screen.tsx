import type { ReactNode } from 'react';
import { useGame } from '../app/store';
import { cashOf } from '../core/game';
import { formatPounds } from '../core/format';
import { RandyBubble } from './RandyBubble';
import styles from './ui.module.css';

interface Props {
  title: string;
  /** Show a back button (every screen but the hub). */
  back?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/** The preparation screen frame: top bar with days to gates and cash, notices, Randy, content. */
export function Screen({ title, back = true, children, footer }: Props) {
  const { game, back: goBack } = useGame();
  const cash = cashOf(game);
  return (
    <main className={styles.screen}>
      <header className={styles.topBar}>
        {back && (
          <button type="button" className={styles.backButton} onClick={goBack} aria-label="Back">
            ←
          </button>
        )}
        <h1 className={styles.topTitle}>{title}</h1>
        <div className={styles.topStats}>
          <span>
            <strong>{game.daysToGates}</strong> {game.daysToGates === 1 ? 'day' : 'days'} to gates
          </span>
          <span className={cash < 0 ? styles.bad : undefined}>Cash {formatPounds(cash)}</span>
        </div>
      </header>
      <div className={styles.content}>
        {game.notice && (
          <div className={styles.notice} role="alert">
            ⚠️ {game.notice}
          </div>
        )}
        <RandyBubble />
        {children}
      </div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </main>
  );
}
