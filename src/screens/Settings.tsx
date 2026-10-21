import { useStore } from '../app/store';
import { Button } from '../components/Button';
import ui from '../components/ui.module.css';

/** Settings. Save export and import and the playtest log download arrive with saving. */
export function Settings() {
  const { game, dispatch, back } = useStore();
  return (
    <main className={ui.screen} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className={ui.content}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Randy's tutorial</h2>
          {game ? (
            game.tutorial.skipped ? (
              <p style={{ margin: 0 }}>Skipped for this game.</p>
            ) : (
              <Button onClick={() => dispatch({ type: 'skipTutorial' })}>Skip the chat</Button>
            )
          ) : (
            <p style={{ margin: 0 }}>Randy talks you through your first festival. You can skip him at any time.</p>
          )}
        </section>
        <p className={ui.muted}>Saving, export and import, and the playtest log download come in a later build.</p>
        <Button variant="primary" wide onClick={back}>
          Back
        </Button>
      </div>
    </main>
  );
}
