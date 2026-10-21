import { describe, expect, it } from 'vitest';
import {
  cumulativeSalesShare,
  facilityDeadlinePassed,
  lineupLocked,
  nextStopDay,
  ticketsSoldByDay,
} from '../src/core/calendar';
import { defaultContent } from '../src/core/content';

const timeline = defaultContent.timeline;
const f1 = timeline.festivals['1']!;
const share = (day: number) => cumulativeSalesShare(day, f1.onSaleDay, timeline.salesCurve);

describe('ticket sales curve (CONTENT.md section 7)', () => {
  it('sells nothing before tickets go on sale', () => {
    expect(share(30)).toBe(0);
    expect(share(26)).toBe(0);
  });

  it('reaches each window total on its boundary day', () => {
    expect(share(14)).toBeCloseTo(0.2);
    expect(share(7)).toBeCloseTo(0.45);
    expect(share(3)).toBeCloseTo(0.75);
    expect(share(0)).toBeCloseTo(0.9);
  });

  it('builds linearly within a window', () => {
    expect(share(20)).toBeCloseTo(0.1);
    expect(share(5)).toBeCloseTo(0.6);
  });

  it('scales to the forecast and never goes down', () => {
    expect(ticketsSoldByDay(7, 400, 0, f1, timeline)).toBe(180);
    expect(ticketsSoldByDay(7, 100, 180, f1, timeline)).toBe(180);
  });
});

describe('preparation stops and deadlines', () => {
  it('Continue jumps to the next timeline stop', () => {
    expect(nextStopDay(30, f1)).toBe(26);
    expect(nextStopDay(26, f1)).toBe(20);
    expect(nextStopDay(14, f1)).toBe(10);
    expect(nextStopDay(1, f1)).toBe(0);
    expect(nextStopDay(0, f1)).toBeNull();
  });

  it('facilities are normal price until day 3, the lineup locks on day 1', () => {
    expect(facilityDeadlinePassed(3, f1)).toBe(false);
    expect(facilityDeadlinePassed(2, f1)).toBe(true);
    expect(lineupLocked(2, f1)).toBe(false);
    expect(lineupLocked(1, f1)).toBe(true);
  });
});
