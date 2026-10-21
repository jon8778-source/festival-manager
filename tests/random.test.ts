import { describe, expect, it } from 'vitest';
import { chance, createRng, nextFloat, nextInt, pick } from '../src/core/random';

describe('seeded random', () => {
  it('gives the same sequence for the same seed', () => {
    const run = (seed: number) => {
      let state = createRng(seed);
      const values: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = nextFloat(state);
        values.push(r.value);
        state = r.state;
      }
      return values;
    };
    expect(run(123)).toEqual(run(123));
    expect(run(123)).not.toEqual(run(124));
  });

  it('keeps its state as a plain number, so it survives JSON', () => {
    const state = nextFloat(createRng(99)).state;
    const restored = JSON.parse(JSON.stringify({ state })).state as number;
    expect(nextFloat(restored)).toEqual(nextFloat(state));
  });

  it('gives floats from 0 up to 1 with a sensible average', () => {
    let state = createRng(5);
    let total = 0;
    for (let i = 0; i < 10000; i++) {
      const r = nextFloat(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      total += r.value;
      state = r.state;
    }
    expect(total / 10000).toBeGreaterThan(0.48);
    expect(total / 10000).toBeLessThan(0.52);
  });

  it('chance(0) never hits and chance(1) always hits', () => {
    expect(chance(createRng(1), 0).hit).toBe(false);
    expect(chance(createRng(1), 1).hit).toBe(true);
  });

  it('nextInt covers min to max inclusive', () => {
    let state = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const r = nextInt(state, 1, 3);
      seen.add(r.value);
      state = r.state;
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick chooses from the list and refuses an empty list', () => {
    expect(['a', 'b']).toContain(pick(createRng(8), ['a', 'b']).value);
    expect(() => pick(createRng(8), [])).toThrow();
  });
});
