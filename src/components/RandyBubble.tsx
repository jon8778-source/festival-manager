import { useState } from 'react';
import { useGame } from '../app/store';
import { defaultContent } from '../core/content';
import { lineText } from '../core/tutorial';
import { Button } from './Button';
import styles from './ui.module.css';

/** Randy's next tutorial line, with Next and a Skip that asks once before skipping the lot. */
export function RandyBubble() {
  const { game, dispatch } = useGame();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const cue = game.tutorial.queue[0];
  if (!cue) return null;
  const lines = defaultContent.lines;

  return (
    <aside className={styles.randy} aria-live="polite" aria-label="Randy Popping says">
      <div className={styles.randyFace} aria-hidden="true">
        🧓
      </div>
      <div className={styles.randyBody}>
        <div className={styles.randyName}>Randy Popping</div>
        <p className={styles.randyText}>{confirmSkip ? lines.skip : lineText(lines, cue)}</p>
        <div className={styles.randyButtons}>
          {confirmSkip ? (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmSkip(false);
                  dispatch({ type: 'skipTutorial' });
                }}
              >
                Skip the chat
              </Button>
              <Button onClick={() => setConfirmSkip(false)}>Keep chatting</Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => dispatch({ type: 'dismissLine' })}>
                {game.tutorial.queue.length > 1 ? 'Next' : 'Got it'}
              </Button>
              <Button onClick={() => setConfirmSkip(true)}>Skip</Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
