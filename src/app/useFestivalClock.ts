import { useEffect } from 'react';
import type { GameAction } from '../core/game';

const TICK_MS = 250;
/** A tick never moves more than this, so returning to a backgrounded tab doesn't skip the day. */
const MAX_TICK_SECONDS = 1;

/** Sends real elapsed time to the core as tick actions while `running` is true. */
export function useFestivalClock(running: boolean, dispatch: (action: GameAction) => void) {
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realSeconds = Math.min(MAX_TICK_SECONDS, (now - last) / 1000);
      last = now;
      dispatch({ type: 'tick', realSeconds });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, dispatch]);
}
