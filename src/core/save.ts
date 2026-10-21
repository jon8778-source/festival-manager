// Save format (spec section 11): one slot of JSON holding the version, when it was saved and the
// whole game state. The state carries the random generator and any pending decision, so loading
// never rerolls an outcome. Storage itself lives in src/app.

import { SAVE_VERSION, type GameState } from './game';

export interface SaveFile {
  version: number;
  savedAt: string;
  state: GameState;
}

export function serialise(state: GameState, savedAt: string): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file);
}

const PHASES = ['prep', 'day', 'results'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks the shape closely enough to catch a wrong or damaged file. */
function looksLikeState(s: unknown): s is GameState {
  if (!isObject(s)) return false;
  return (
    typeof s.seed === 'number' &&
    typeof s.rng === 'number' &&
    typeof s.festivalId === 'string' &&
    typeof s.attempt === 'number' &&
    typeof s.phase === 'string' &&
    PHASES.includes(s.phase) &&
    typeof s.reputation === 'number' &&
    typeof s.daysToGates === 'number' &&
    typeof s.ticketPrice === 'number' &&
    isObject(s.talks) &&
    isObject(s.lineup) &&
    Array.isArray(s.plots) &&
    Array.isArray(s.inbox) &&
    Array.isArray(s.decisions) &&
    isObject(s.tutorial)
  );
}

export type LoadResult = { ok: true; state: GameState; savedAt: string } | { ok: false; error: string };

/** Older versions would be migrated here; there is only version 1 so far. */
function migrate(file: SaveFile): SaveFile {
  return file;
}

export function deserialise(json: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't a Festival Manager save." };
  }
  if (!isObject(parsed) || typeof parsed.version !== 'number') return { ok: false, error: "That file isn't a Festival Manager save." };
  if (parsed.version > SAVE_VERSION) return { ok: false, error: 'That save is from a newer version of the game.' };
  const file = migrate(parsed as unknown as SaveFile);
  if (!looksLikeState(file.state)) return { ok: false, error: 'That save is damaged and cannot be loaded.' };
  return { ok: true, state: { ...file.state, version: SAVE_VERSION }, savedAt: String(file.savedAt ?? '') };
}

/** "festival-manager-save-2026-10-21.json" */
export function exportFileName(isoDate: string): string {
  return `festival-manager-save-${isoDate.slice(0, 10)}.json`;
}

/**
 * When to autosave: at the end of each phase. During preparation that is every change (each day,
 * booking and decision); on the festival day only when the gates are about to open, so closing
 * mid-day resumes at the gates; and on reaching the results.
 */
export function shouldAutosave(prev: GameState | null, next: GameState): boolean {
  if (prev === next) return false;
  if (next.phase === 'prep') return true;
  if (next.phase === 'day') return prev?.phase !== 'day';
  return prev?.phase !== 'results';
}
