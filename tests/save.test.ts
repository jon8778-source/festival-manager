import { describe, expect, it } from 'vitest';
import { newGame, reduce } from '../src/core/game';
import { deserialise, exportFileName, serialise, shouldAutosave } from '../src/core/save';
import { playToGates } from './helpers';

describe('save', () => {
  it('round-trips the whole state, including a pending decision and the random state', () => {
    let s = playToGates({ foodUnits: 1 });
    for (let i = 0; i < 100 && !s.day?.active; i++) s = reduce(s, { type: 'tick', realSeconds: 1 });
    expect(s.day?.active).not.toBeNull();
    const loaded = deserialise(serialise(s, '2026-10-21T10:00:00Z'));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state).toEqual(s);
      expect(loaded.savedAt).toBe('2026-10-21T10:00:00Z');
    }
  });

  it('rejects files that are not saves, damaged or from a newer version', () => {
    expect(deserialise('not json').ok).toBe(false);
    expect(deserialise('{"hello":1}').ok).toBe(false);
    expect(deserialise('{"version":1,"state":{"seed":"x"}}').ok).toBe(false);
    expect(deserialise(JSON.stringify({ version: 99, state: newGame(1) })).ok).toBe(false);
  });

  it('names the export file by date', () => {
    expect(exportFileName('2026-10-21T10:00:00Z')).toBe('festival-manager-save-2026-10-21.json');
  });

  it('autosaves through preparation, once at the gates and once at the results', () => {
    const prep = newGame(1);
    const prep2 = reduce(prep, { type: 'continue' });
    expect(shouldAutosave(prep, prep2)).toBe(true);
    const gates = playToGates();
    const ticked = reduce(gates, { type: 'tick', realSeconds: 1 });
    expect(shouldAutosave(null, gates)).toBe(true);
    expect(shouldAutosave(gates, ticked)).toBe(false);
    const results = { ...ticked, phase: 'results' as const };
    expect(shouldAutosave(ticked, results)).toBe(true);
    expect(shouldAutosave(results, { ...results })).toBe(false);
  });
});
