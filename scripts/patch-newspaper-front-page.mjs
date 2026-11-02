// Owner, 1 Nov: no story opens; the section tabs still work (projects/football-journalism/front-page-only.js).
// Reapply after refreshing the newspaper build: the stories keep their cards, but their
// writing, notes and challenges are left out of the shipped bundle.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const open = [];
const root = new URL('../projects/football-journalism/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const url = new URL(html.match(/src="(\.\/assets\/[^"?]+\.js)/)[1], root);
const source = await readFile(url, 'utf8');
// Either the build's literal or this script's earlier JSON, so it can be rerun.
const start = source.search(/\[\{(?:id:`hydration`|"id":"hydration")/);
assert(start > 0, 'Newspaper story list changed; review the refreshed build before patching.');
// The list holds only literals: find its end, skipping strings.
let depth = 0, end = start, quoted = false;
for (; end < source.length; end++) {
  const c = source[end];
  if (quoted) { if (c === '\\') end++; else if (c === quoted) quoted = false; continue; }
  if (c === '`' || c === '"') quoted = c;
  else if (c === '[' || c === '{') depth++;
  else if ((c === ']' || c === '}') && --depth === 0) { end++; break; }
}
const stories = new Function(`return ${source.slice(start, end)}`)();
assert(open.every(id => stories.some(story => story.id === id)), 'A front-page story is missing from the build.');
for (const story of stories) if (!open.includes(story.id)) for (const field of ['excerpt', 'note', 'challenge']) story[field] = '';
await writeFile(url, source.slice(0, start) + JSON.stringify(stories) + source.slice(end));
console.log(`No story opens: ${stories.length} kept as cards without their text.`);
