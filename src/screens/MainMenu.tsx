import { GAME_TITLE } from '../core/game';
import styles from './MainMenu.module.css';

export function MainMenu() {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{GAME_TITLE}</h1>
    </main>
  );
}
