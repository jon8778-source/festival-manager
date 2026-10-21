// Seeded random numbers (mulberry32). The generator state is a plain number so it can live
// inside the serialisable game state; every function returns the next state alongside its value.

export type RngState = number;

export function createRng(seed: number): RngState {
  return seed >>> 0;
}

export function nextFloat(state: RngState): { value: number; state: RngState } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/** True with probability p. */
export function chance(state: RngState, p: number): { hit: boolean; state: RngState } {
  const { value, state: next } = nextFloat(state);
  return { hit: value < p, state: next };
}

/** Whole number from min to max inclusive. */
export function nextInt(state: RngState, min: number, max: number): { value: number; state: RngState } {
  const { value, state: next } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min + 1)), state: next };
}

export function pick<T>(state: RngState, items: readonly T[]): { value: T; state: RngState } {
  if (items.length === 0) throw new Error('Cannot pick from an empty list');
  const { value: index, state: next } = nextInt(state, 0, items.length - 1);
  return { value: items[index] as T, state: next };
}
