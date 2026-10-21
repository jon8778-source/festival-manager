// Small helpers for reading the tables in docs/CONTENT.md.

export interface Section {
  level: number;
  title: string;
  lines: string[];
}

/** Split markdown into sections by heading. Titles drop their numbering ("2. Festivals" -> "Festivals"). */
export function sections(markdown: string): Section[] {
  const result: Section[] = [];
  let current: Section | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      current = {
        level: heading[1]!.length,
        title: heading[2]!.replace(/^\d+[a-z]?\.\s+/, '').trim(),
        lines: [],
      };
      result.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return result;
}

/**
 * The lines of the first section whose title starts with `title`, including its subsections.
 * Throws if there is none, so a renamed heading gives a clear error.
 */
export function section(all: Section[], title: string): string[] {
  const index = all.findIndex((s) => s.title.startsWith(title));
  if (index < 0) throw new Error(`CONTENT.md: can't find the "${title}" section`);
  const start = all[index]!;
  const lines = [...start.lines];
  for (const next of all.slice(index + 1)) {
    if (next.level <= start.level) break;
    lines.push(`${'#'.repeat(next.level)} ${next.title}`, ...next.lines);
  }
  return lines;
}

/** The section's text outside tables, joined into one string. */
export function prose(lines: string[]): string {
  return lines
    .filter((l) => !l.trim().startsWith('|') && !l.startsWith('#'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Row = string[];

/** Every table in the lines, as rows of cells (header and divider removed). */
export function tables(lines: string[]): { header: Row; rows: Row[] }[] {
  const result: { header: Row; rows: Row[] }[] = [];
  let block: string[] = [];
  const flush = () => {
    if (block.length >= 2) {
      const [header, , ...rows] = block.map(splitRow);
      result.push({ header: header!, rows });
    }
    block = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith('|')) block.push(line.trim());
    else flush();
  }
  flush();
  return result;
}

function splitRow(line: string): Row {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** The only table in a section; throws if there isn't exactly one. */
export function onlyTable(lines: string[], what: string): { header: Row; rows: Row[] } {
  const found = tables(lines);
  if (found.length !== 1) throw new Error(`CONTENT.md: expected one ${what} table, found ${found.length}`);
  return found[0]!;
}

/** A cell by index, or an error naming the table and row. */
export function cell(row: Row, index: number, what: string): string {
  const value = row[index];
  if (value === undefined) throw new Error(`CONTENT.md: ${what} row "${row[0]}" has no column ${index + 1}`);
  return value;
}

/** Strip the outer straight quotes from a quoted line. */
export function unquote(text: string): string {
  const match = /^"(.*)"$/.exec(text.trim());
  return match ? match[1]! : text.trim();
}

/** "Food stall queue" -> "food-stall-queue". */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "Rain, covered area" -> "rainCoveredArea". */
export function camel(text: string): string {
  return slug(text).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** "£1,800" -> 1800, "4,200" -> 4200, "1.2 million" -> 1200000. */
export function amount(text: string, what: string): number {
  const match = /(-?[\d,]*\.?\d+)\s*(million)?/.exec(text);
  if (!match) throw new Error(`CONTENT.md: can't read a number from "${text}" (${what})`);
  const value = Number(match[1]!.replace(/,/g, ''));
  return match[2] ? Math.round(value * 1_000_000) : value;
}

/** "15%" -> 0.15, "0" -> 0, "-0.1% (net gain)" -> -0.001. */
export function percent(text: string, what: string): number {
  return amount(text, what) / 100;
}

/** Whole numbers in "1 to 3" (a range), "2 and 3" or "3 (stretch)". */
export function festivalNumbers(text: string): number[] {
  const range = /(\d+)\s+to\s+(\d+)/.exec(text);
  if (range) {
    const numbers: number[] = [];
    for (let n = Number(range[1]); n <= Number(range[2]); n++) numbers.push(n);
    return numbers;
  }
  return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
}
