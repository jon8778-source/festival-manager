import { describe, expect, it } from 'vitest';
import { defaultContent } from '../src/core/content';
import { cueLines, dismissLine, lineText, newTutorial, skipTutorial } from '../src/core/tutorial';

const lines = defaultContent.lines;

describe("Randy's tutorial lines", () => {
  it('queues each line once, in trigger order', () => {
    let t = cueLines(newTutorial(), lines, 'hubOpened');
    expect(t.queue.map((q) => q.lineId)).toEqual(['targets', 'forecast']);
    t = cueLines(t, lines, 'hubOpened');
    expect(t.queue).toHaveLength(2);
    t = dismissLine(t);
    expect(t.queue.map((q) => q.lineId)).toEqual(['forecast']);
    expect(t.last?.lineId).toBe('targets');
  });

  it('fills placeholders', () => {
    const t = cueLines(newTutorial(), lines, 'ticketsOpened', { fair_price: '25' });
    expect(lineText(lines, t.queue[0]!)).toContain('A fair price is £25.');
  });

  it('skipping clears the queue and stops new lines', () => {
    let t = cueLines(newTutorial(), lines, 'gameStart');
    t = skipTutorial(t);
    expect(t.queue).toHaveLength(0);
    t = cueLines(t, lines, 'lineupOpened');
    expect(t.queue).toHaveLength(0);
  });
});
