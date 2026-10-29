// Browser-free policy and integration checks.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../scripts/check-project-cells-static.mjs';
const source = await readFile(new URL('../project-showcase.js', import.meta.url), 'utf8');
assert(source.includes("iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')"), 'The newspaper clip must open in a new tab');
const spinSource = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../project-showcase.css', import.meta.url), 'utf8');
assert(!spinSource.includes('Drag to spin') && !showcaseStyles.includes('drink-spin-hint'), 'Remove the drag hint markup and styles entirely');
const spinURL = `data:text/javascript;base64,${Buffer.from(spinSource).toString('base64')}`;
const linkedSource = source.replace(/(['"])\.\/drink-spin\.js(?:\?[^'"]*)?\1/, JSON.stringify(spinURL));
const { projects, initialProject, idleAdvance, homepageStart } = await import(`data:text/javascript;base64,${Buffer.from(linkedSource).toString('base64')}`);
await import('./drink-spin-source.mjs');
assert.deepEqual(projects.map(project => project.id), ['football', 'darty', 'drinks', 'piano']);
assert.deepEqual(projects.find(project => project.id === 'drinks').drinks.map(({ name, lines }) => ({ name, lines })), [
  { name: 'Skids', lines: ["When you're in a rush, have some Skids."] },
  { name: 'Fizzy', lines: ['Light, bright red.', 'Fizzy, extreme.'] },
  { name: 'Ground Pinch', lines: ['Designed for everyone.'] },
], 'The drink cards retain the exact approved words and capitalisation');
for (let i = 0; i < projects.length; i++) {
  assert.equal(initialProject(undefined, () => (i + .5) / projects.length, null), i, 'With no fixed start, every project can start a load');
  assert.equal(initialProject(projects[i].id, () => 0), i, 'Review override is deterministic');
}
assert.equal(initialProject('unknown', () => .99, null), 3, 'Invalid overrides use random selection when no fixed start');
assert.equal(homepageStart, 'piano', 'Homepage opens on the piano for now');
assert.equal(initialProject(undefined, () => .1), projects.findIndex(p => p.id === 'piano'), 'Ordinary homepage loads start on the piano');
function fakeClock() {
  let time = 0;
  let id = 0;
  const tasks = new Map();
  return {
    Date: { now: () => time },
    setTimeout(fn, delay) { tasks.set(++id, { at: time + delay, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    tick(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      time = end;
    },
    pending: () => tasks.size,
  };
}
const clock = fakeClock();
let changes = 0;
let focused = false;
let playing = false;
let pointerHeld = false;
let keyHeld = false;
let hidden = false;
let reduced = false;
let manual = false;
const timer = idleAdvance({ clock, advance: () => changes++, blocked: () => focused || playing || pointerHeld || keyHeld, enabled: () => !hidden && !reduced && !manual });
timer.reset();
clock.tick(19999);
assert.equal(changes, 0, 'No advance before exactly 20 seconds');
clock.tick(1);
assert.equal(changes, 1, 'Advances at 20 seconds');
clock.tick(19000);
timer.reset();
clock.tick(19999);
assert.equal(changes, 1, 'Interaction resets the full deadline');
clock.tick(1);
assert.equal(changes, 2);
for (const reason of ['focus', 'playing', 'pointer', 'key']) {
  focused = reason === 'focus'; playing = reason === 'playing'; pointerHeld = reason === 'pointer'; keyHeld = reason === 'key';
  timer.reset();
  clock.tick(60000);
  assert.equal(changes, 2, `Never advance during ${reason}`);
}
focused = playing = pointerHeld = keyHeld = false;
timer.reset();
clock.tick(7000);
hidden = true;
timer.pause();
clock.tick(120000);
assert.equal(changes, 2, 'A hidden tab cannot advance');
hidden = false;
timer.resume();
clock.tick(12999);
assert.equal(changes, 2, 'Hidden time is excluded from the deadline');
clock.tick(1);
assert.equal(changes, 3);
for (const reason of ['reduced', 'manual']) {
  reduced = reason === 'reduced'; manual = reason === 'manual';
  timer.reset();
  clock.tick(120000);
  assert.equal(changes, 3, `${reason}: no automatic advance`);
  assert.equal(clock.pending(), 0, `${reason}: no idle timer`);
}
timer.destroy();
assert.equal(clock.pending(), 0);
assert(!/createElement\('video'\)|\.mp4|\.webm/.test(source), 'Drinks use frame sequences, never video');
assert.match(source, /IntersectionObserver/);
for (const page of ['index.html', 'children.html']) {
  const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.match(html, /project-showcase\.js[^"']*["'] type="module"/);
  assert.match(html, /project-showcase\.css/);
  assert.match(html, /frame-src 'self'/);
  assert(!/\sstyle=|\son\w+=|<style\b|<script\b(?![^>]*\bsrc=)/i.test(html), `${page}: no inline code`);
  assert(!/unsafe-inline|unsafe-eval|projects\/piano/.test(html));
}
await assert.rejects(access(new URL('../projects/piano/piano.js', import.meta.url)), 'Retire the alternate piano implementation');

const site = fileURLToPath(new URL('../', import.meta.url));
const before = execFileSync('git', ['show', `${process.env.SHOWCASE_BASE || 'd9d653b'}:index.html`], { cwd: site, encoding: 'utf8' });
const after = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const heroCopy = html => html.split('<div class="hero-copy">')[1].split('<div class="hero-world">')[0];
assert.equal(heroCopy(after), heroCopy(before), 'Homepage copy, buttons and benefits stay untouched');
const belowHero = html => html.slice(html.indexOf('<section class="homepage-section team-section"'));
assert.equal(belowHero(after), belowHero(before), 'Everything below the homepage hero stays untouched');

const children = await readFile(new URL('../children.html', import.meta.url), 'utf8');
assert.deepEqual([...children.matchAll(/data-project-slide data-project="([^"]+)"/g)].map(match => match[1]), projects.map(project => project.id), 'Every data record has its matching copy card');

const newspaperHTML = await readFile(new URL('../projects/football-journalism/index.html', import.meta.url), 'utf8');
const newspaperScript = newspaperHTML.match(/src="(\.\/assets\/[^"?]+\.js)/)[1];
const newspaper = await readFile(new URL(`../projects/football-journalism/${newspaperScript}`, import.meta.url), 'utf8');
assert(newspaper.includes('(window===window.top||document.hasFocus())&&r.current?.focus'), 'The embedded newspaper must not take initial focus and block idle rotation');

for (const id of ['piano-toggle', 'hero-keyboard', 'sky-canvas', 'flock-canvas']) {
  assert.equal([...source.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `The shared piano must define #${id} exactly once`);
  for (const html of [after, children]) assert(!html.includes(`id="${id}"`), `Page markup must not duplicate the shared #${id}`);
}
console.log('Shared showcase checks passed: random starts, exact idle deadline, resets, focus/playing/held input, hidden pause, reduced motion, manual mode and CSP.');
