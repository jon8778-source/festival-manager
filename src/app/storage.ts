// Browser storage for the save slot, the playtest log and settings. Every access is guarded:
// storage can be missing or full (private browsing), and the game must still run without it.

import type { GameState } from '../core/game';
import { capLog, type LogRecord } from '../core/playtestLog';
import { deserialise, serialise, type LoadResult } from '../core/save';
import { defaultTuning } from '../core/tuning';

const SAVE_KEY = 'fm.save.v1';
const LOG_KEY = 'fm.log';
const SETTINGS_KEY = 'fm.settings';

export function writeSave(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialise(state, new Date().toISOString()));
  } catch {
    // Storage full or unavailable: the game carries on unsaved.
  }
}

export function readSave(): LoadResult | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    return json === null ? null : deserialise(json);
  } catch {
    return null;
  }
}

export function readLog(): LogRecord[] {
  try {
    const json = localStorage.getItem(LOG_KEY);
    const parsed: unknown = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? (parsed as LogRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendLog(records: readonly LogRecord[]): void {
  if (records.length === 0) return;
  try {
    const all = capLog([...readLog(), ...records], defaultTuning.playtestLog.maxRecords);
    localStorage.setItem(LOG_KEY, JSON.stringify(all));
  } catch {
    // Logging must never break the game.
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // Nothing to clear.
  }
}

export interface Settings {
  reducedMotion: boolean;
}

export function readSettings(): Settings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    const s = typeof parsed === 'object' && parsed !== null ? (parsed as Partial<Settings>) : {};
    return { reducedMotion: s.reducedMotion === true };
  } catch {
    return { reducedMotion: false };
  }
}

export function writeSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings just won't persist.
  }
}
