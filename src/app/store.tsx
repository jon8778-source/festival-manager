// The React side of the game state: one GameState held in context, changed only by
// dispatching core actions, plus the screen the player is on. Saving and the playtest log
// hang off dispatch here, so the core stays free of browser APIs.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newGame, reduce, type GameAction, type GameState } from '../core/game';
import { makeRecord, recordsForAction, type LogKind, type LogRecord } from '../core/playtestLog';
import { shouldAutosave } from '../core/save';
import { appendLog, readSave, readSettings, writeSave, writeSettings, type Settings } from './storage';

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
  /** Replace the game with an imported save. */
  loadGame: (state: GameState) => void;
  route: Route;
  go: (route: Route) => void;
  back: () => void;
  settings: Settings;
  updateSettings: (settings: Settings) => void;
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

function loadSavedGame(): GameState | null {
  const loaded = readSave();
  return loaded?.ok ? loaded.state : null;
}

const SESSION = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let sessionLogged = false;

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGameState] = useState<GameState | null>(loadSavedGame);
  const [stack, setStack] = useState<Route[]>([{ name: 'menu' }]);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const route = stack[stack.length - 1] ?? { name: 'menu' };
  // The current game outside React's render cycle, so dispatch can log and save exactly once.
  const gameRef = useRef(game);

  const log = useCallback((kind: LogKind, payload: Record<string, unknown> = {}) => {
    appendLog([makeRecord(kind, payload, { session: SESSION, now: new Date().toISOString() }, gameRef.current)]);
  }, []);

  const setGame = useCallback((next: GameState | null) => {
    const prev = gameRef.current;
    gameRef.current = next;
    setGameState(next);
    if (next && shouldAutosave(prev, next)) writeSave(next);
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      const prev = gameRef.current;
      if (!prev) return;
      const next = reduce(prev, action);
      if (next === prev) return;
      setGame(next);
      const records: LogRecord[] = recordsForAction(prev, next, action, { session: SESSION, now: new Date().toISOString() });
      appendLog(records);
    },
    [setGame],
  );

  const go = useCallback(
    (next: Route) => {
      const action = openAction(next);
      if (action) dispatch(action);
      log('screen', { screen: next.name });
      // The hub is the root of preparation, so going there clears the back stack.
      setStack((s) => (next.name === 'hub' || next.name === 'menu' ? [next] : [...s, next]));
      window.scrollTo(0, 0);
    },
    [dispatch, log],
  );

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: 'menu' }]));
    window.scrollTo(0, 0);
  }, []);

  const startNewGame = useCallback(() => {
    const current = gameRef.current;
    if (current && current.phase !== 'results') log('quit', { phase: current.phase, daysToGates: current.daysToGates });
    // The seed only needs to differ between games; the rules are deterministic from it.
    setGame(reduce(newGame(Date.now() >>> 0), { type: 'openScreen', screen: 'hub' }));
    setStack([{ name: 'hub' }]);
  }, [log, setGame]);

  const loadGame = useCallback(
    (state: GameState) => {
      // Treat the import as a fresh start so it is saved straight away, whatever its phase.
      gameRef.current = null;
      setGame(state);
    },
    [setGame],
  );

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    writeSettings(next);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  }, [settings.reducedMotion]);

  useEffect(() => {
    // React's development mode runs effects twice; log the session start once.
    if (!sessionLogged) {
      sessionLogged = true;
      log('session_start', { resumed: gameRef.current !== null });
    }
    const end = () => log('session_end', { phase: gameRef.current?.phase ?? null });
    window.addEventListener('pagehide', end);
    return () => window.removeEventListener('pagehide', end);
  }, [log]);

  const value = useMemo(
    () => ({ game, dispatch, startNewGame, loadGame, route, go, back, settings, updateSettings }),
    [game, dispatch, startNewGame, loadGame, route, go, back, settings, updateSettings],
  );
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
