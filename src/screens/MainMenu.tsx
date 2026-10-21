import { useStore } from '../app/store';
import { Button } from '../components/Button';
import { defaultContent, getBand, getFestival } from '../core/content';
import { GAME_TITLE, festivalOf } from '../core/game';
import styles from './MainMenu.module.css';

/** The next festival's poster is the menu; it fills in as bands are booked. */
export function MainMenu() {
  const { game, startNewGame, go } = useStore();
  const festival = game ? festivalOf(game) : getFestival(defaultContent, 'village-green');
  const name = (slot: 'headliner' | 'support' | 'opener') => {
    const booking = game?.lineup[slot];
    return booking ? getBand(defaultContent, booking.bandId).name : null;
  };
  const headliner = name('headliner');
  const booked = [name('support'), name('opener')].filter((n): n is string => n !== null);
  const others = booked.length < 2 ? [...booked, 'More acts to be announced'] : booked;

  return (
    <main className={styles.screen}>
      <p className={styles.gameTitle}>{GAME_TITLE}</p>
      <section className={styles.poster} aria-label={`${festival.name} poster`}>
        <p className={styles.presents}>Festival {festival.number} presents</p>
        <h1 className={styles.festival}>{festival.name}</h1>
        <p className={styles.headliner}>{headliner ?? 'Headliner to be announced'}</p>
        <ul className={styles.acts}>
          {others.map((act, i) => (
            <li key={i}>{act}</li>
          ))}
        </ul>
        <p className={styles.days}>
          {game ? (game.phase === 'prep' ? `${game.daysToGates} days to gates` : game.phase === 'day' ? 'Gates are open!' : 'The festival is over') : `One day only · ${festival.capacity} tickets`}
        </p>
        <div className={styles.flags} aria-hidden="true">
          🎪 🎸 🎤
        </div>
      </section>
      <nav className={styles.buttons}>
        {game && (
          <Button variant="primary" wide onClick={() => go({ name: 'hub' })}>
            Continue planning
          </Button>
        )}
        <Button variant={game ? 'secondary' : 'primary'} wide onClick={startNewGame}>
          New game
        </Button>
        <Button wide onClick={() => go({ name: 'settings' })}>
          Settings
        </Button>
      </nav>
    </main>
  );
}
