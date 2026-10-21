// Randy Popping's tutorial lines: each line is shown once, in the order its trigger fires,
// and the player can skip the lot.

import type { Lines } from './content';
import { fillTemplate, type TemplateVars } from './format';

export interface LineCue {
  lineId: string;
  vars: TemplateVars;
}

export interface TutorialState {
  skipped: boolean;
  /** Line ids already queued or shown. */
  seen: string[];
  /** Lines waiting to be shown, oldest first. */
  queue: LineCue[];
  /** The last line the player dismissed, for "Randy's latest message" on the hub. */
  last: LineCue | null;
}

export function newTutorial(): TutorialState {
  return { skipped: false, seen: [], queue: [], last: null };
}

/** Queue every unseen line for this trigger. */
export function cueLines(tutorial: TutorialState, lines: Lines, trigger: string, vars: TemplateVars = {}): TutorialState {
  if (tutorial.skipped) return tutorial;
  const due = lines.tutorial.filter((l) => l.trigger === trigger && !tutorial.seen.includes(l.id));
  if (due.length === 0) return tutorial;
  return {
    ...tutorial,
    seen: [...tutorial.seen, ...due.map((l) => l.id)],
    queue: [...tutorial.queue, ...due.map((l) => ({ lineId: l.id, vars }))],
  };
}

export function dismissLine(tutorial: TutorialState): TutorialState {
  const [current, ...rest] = tutorial.queue;
  if (!current) return tutorial;
  return { ...tutorial, queue: rest, last: current };
}

export function skipTutorial(tutorial: TutorialState): TutorialState {
  return { ...tutorial, skipped: true, queue: [] };
}

/** The text of a cued line with its placeholders filled. */
export function lineText(lines: Lines, cue: LineCue): string {
  const line = lines.tutorial.find((l) => l.id === cue.lineId);
  if (!line) return '';
  return fillTemplate(line.text, cue.vars);
}
