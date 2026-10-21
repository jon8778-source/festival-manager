// Regenerates the JSON content in src/data from docs/CONTENT.md.
// Usage: npm run content

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFiles } from './content/files.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markdown = readFileSync(join(root, 'docs', 'CONTENT.md'), 'utf8');

try {
  for (const [file, json] of Object.entries(contentFiles(markdown))) {
    writeFileSync(join(root, 'src', 'data', file), json);
    console.log(`Wrote src/data/${file}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
