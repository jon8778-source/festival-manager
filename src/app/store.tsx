// The React side of the game state: one GameState held in context, changed only by
// dispatching core actions, plus the screen the player is on.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { newGame, reduce, type GameAction, type GameState } from '../core/game';

export type Route =
  | { name: 'menu' }
  | { name: 'settings' }
  | { name: 'hub' }
  | { name: 'inbox'; emailId?: string }
  | { name: 'lineup' }
  | { name: 'negotiations' }
  | { name: 'negotiation'; bandId: string }
  | { name: 'site' }
  | { name: 'tickets' }
  | { name: 'finances' };

interface Store {
  game: GameState | null;
  dispatch: (action: GameAction) => void;
  startNewGame: () => void;
  route: Route;
  go: (route: Route) => void;
  back: () => void;
}

const StoreContext = createContext<Store | null>(null);

/** Screens that cue Randy's tutorial lines when they open. */
function openAction(route: Route): GameAction | null {
  switch (route.name) {
    case 'hub':
    case 'lineup':
    case 'site':
    case 'tickets':
    case 'finances':
      return { type: 'openScreen', screen: route.name };
    case 'negotiation':
      return { type: 'openScreen', screen: 'negotiation', bandId: route.bandId };
    default:
      return null;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [stack, setStack] = useState<Route[]>([{ name: 'menu' }]);
  const route = stack[stack.length - 1] ?? { name: 'menu' };

  const dispatch = useCallback((action: GameAction) => {
    setGame((g) => (g ? reduce(g, action) : g));
  }, []);

  const go = useCallback(
    (next: Route) => {
      const action = openAction(next);
      if (action) dispatch(action);
      // The hub is the root of preparation, so going there clears the back stack.
      setStack((s) => (next.name === 'hub' || next.name === 'menu' ? [next] : [...s, next]));
      window.scrollTo(0, 0);
    },
    [dispatch],
  );

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: 'menu' }]));
    window.scrollTo(0, 0);
  }, []);

  const startNewGame = useCallback(() => {
    // The seed only needs to differ between games; the rules are deterministic from it.
    setGame(reduce(newGame(Date.now() >>> 0), { type: 'openScreen', screen: 'hub' }));
    setStack([{ name: 'hub' }]);
  }, []);

  const value = useMemo(() => ({ game, dispatch, startNewGame, route, go, back }), [game, dispatch, startNewGame, route, go, back]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside GameProvider');
  return store;
}

/** For screens that only make sense during a game. */
export function useGame(): Omit<Store, 'game'> & { game: GameState } {
  const store = useStore();
  if (!store.game) throw new Error('No game in progress');
  return { ...store, game: store.game };
}
