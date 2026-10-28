// The newspaper is a supplied compiled build. Keep its focus adjustment small
// and reproducible after a refresh, without editing the source hub outside this checkout.
// Run: node scripts/patch-newspaper-focus.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
const root = new URL('../projects/football-journalism/', import.meta.url);
const before = 'r.current?.focus({preventScroll:!0})';
const after = '(window===window.top||document.hasFocus())&&r.current?.focus({preventScroll:!0})';
const files = (await readdir(new URL('assets/', root))).filter(name => name.endsWith('.js'));
let matched = false;
for (const name of files) {
  const url = new URL(`assets/${name}`, root);
  const source = await readFile(url, 'utf8');
  if (source.includes(after)) { matched = true; continue; }
  if (!source.includes(before)) continue;
  if (source.split(before).length !== 2) throw new Error(`Ambiguous newspaper focus call in ${name}; review the updated build.`);
  await writeFile(url, source.replace(before, after));
  matched = true;
}
if (!matched) throw new Error('Newspaper focus call changed; review the updated build before patching.');
const htmlURL = new URL('index.html', root);
const html = await readFile(htmlURL, 'utf8');
const updated = html.replace(/src="(\.\/assets\/[^"?]+\.js)(?:\?[^"\s]*)?"/, 'src="$1?v=20261028-shared-focus-1"');
if (updated !== html) await writeFile(htmlURL, updated);
console.log('Newspaper focus guard ready: embedded opening stays silent and unfocused; user-opened articles retain heading focus.');
