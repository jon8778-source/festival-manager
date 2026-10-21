// Preparation calendar: the ticket sales curve and the timeline stops Continue jumps between.
// Days are counted as days to gates (30 down to 0).

import type { FestivalTimeline, SalesWindow, Timeline } from './content';
import { clamp } from './math';

/**
 * Share of final sales sold by the end of `daysToGates`, before walk-ups. Sales start on the
 * on-sale day and build linearly within each window of the curve (the first window starts on
 * the on-sale day).
 */
export function cumulativeSalesShare(daysToGates: number, onSaleDay: number, curve: readonly SalesWindow[]): number {
  let total = 0;
  curve.forEach((w, i) => {
    const from = i === 0 ? onSaleDay : w.fromDay;
    const length = from - w.toDay;
    if (length <= 0) return;
    const elapsed = clamp(from - daysToGates, 0, length);
    total += (w.share * elapsed) / length;
  });
  return total;
}

/** Tickets sold by the end of the day: the forecast attendees times the curve, never going down. */
export function ticketsSoldByDay(
  daysToGates: number,
  forecastAttendees: number,
  previouslySold: number,
  festival: FestivalTimeline,
  timeline: Timeline,
): number {
  const share = cumulativeSalesShare(daysToGates, festival.onSaleDay, timeline.salesCurve);
  return Math.max(previouslySold, Math.floor(forecastAttendees * share));
}

/** True on days a timeline stop falls on. */
export function isStopDay(daysToGates: number, festival: FestivalTimeline): boolean {
  return festival.stops.some((s) => s.day === daysToGates);
}

/** The next timeline stop after today, or null if the festival day has been reached. */
export function nextStopDay(daysToGates: number, festival: FestivalTimeline): number | null {
  const later = festival.stops.map((s) => s.day).filter((d) => d < daysToGates);
  return later.length ? Math.max(...later) : null;
}

/** Facilities are at the normal price until the deadline, then emergency units only. */
export function facilityDeadlinePassed(daysToGates: number, festival: FestivalTimeline): boolean {
  return daysToGates < festival.facilityDeadline;
}

export function lineupLocked(daysToGates: number, festival: FestivalTimeline): boolean {
  return daysToGates <= festival.lineupLock;
}
