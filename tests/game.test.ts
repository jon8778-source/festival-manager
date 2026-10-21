import { describe, expect, it } from 'vitest';
import { GAME_TITLE } from '../src/core/game';

describe('game', () => {
  it('has the right title', () => {
    expect(GAME_TITLE).toBe('Festival Manager');
  });
});
