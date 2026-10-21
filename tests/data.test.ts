import { describe, expect, it } from 'vitest';
import { defaultContent as c, getEmail, getEvent, getFacility } from '../src/core/content';

describe('content data', () => {
  it('has all 18 bands with asks', () => {
    expect(c.bands).toHaveLength(18);
    for (const b of c.bands) {
      expect(b.feeAsk).toBeGreaterThan(0);
      expect(b.festivals.length).toBeGreaterThan(0);
    }
  });

  it('every timeline email, decision and facility exists', () => {
    for (const f of c.festivals) {
      for (const id of f.facilityTypes) expect(getFacility(c, id).servesPerUnit).toBe(100);
      const timeline = c.timeline.festivals[String(f.number)]!;
      for (const stop of timeline.stops) for (const e of stop.emails) expect(getEmail(c, e.id)).toBeTruthy();
    }
    for (const e of c.emails) if (e.decision) expect(getEvent(c, e.decision).options.length).toBeGreaterThanOrEqual(2);
  });

  it('every email button and tutorial line is filled in', () => {
    for (const e of c.emails) expect(e.subject.length).toBeGreaterThan(0);
    for (const l of c.lines.tutorial) expect(l.text.length).toBeGreaterThan(0);
  });

  it('the sales curve adds up to 100% with walk-ups', () => {
    const total = c.timeline.salesCurve.reduce((a, w) => a + w.share, 0) + c.timeline.walkUpShare;
    expect(total).toBeCloseTo(1);
  });
});
