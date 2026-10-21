// The JSON files written by `npm run content`, as text, so the tests can compare them with src/data.

import { convertContent } from './convert.ts';

export function contentFiles(markdown: string): Record<string, string> {
  const content = convertContent(markdown);
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    'bands.json': json(content.bands),
    'festivals.json': json(content.festivals),
    'facilities.json': json(content.facilities),
    'events.json': json(content.events),
    'emails.json': json(content.emails),
    'lines.json': json(content.lines),
    'newspaper.json': json(content.newspaper),
    'timeline.json': json(content.timeline),
  };
}
