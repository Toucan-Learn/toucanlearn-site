// Browser-free policy and integration checks.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homeNavigationMarkup } from './helpers/navigation-markup.mjs';
import '../scripts/check-project-cells-static.mjs';
const source = await readFile(new URL('../project-showcase.js', import.meta.url), 'utf8');
assert(source.includes("iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')"), 'The newspaper clip must open in a new tab');
const spinSource = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../project-showcase.css', import.meta.url), 'utf8');
assert(!spinSource.includes('Drag to spin') && !showcaseStyles.includes('drink-spin-hint'), 'Remove the drag hint markup and styles entirely');
const spinURL = `data:text/javascript;base64,${Buffer.from(spinSource).toString('base64')}`;
// Policy imports run without a DOM; browser suites exercise the real sky module.
const skyURL = `data:text/javascript,export function initHeroSky(){throw new Error('Unexpected DOM mount in policy test')}`;
const linkedSource = source.replace(/(['"])\.\/drink-spin\.js(?:\?[^'"]*)?\1/, JSON.stringify(spinURL))
  .replace(/(['"])\.\/hero-sky\.js(?:\?[^'"]*)?\1/, JSON.stringify(skyURL));
const { projects, sectionProjects, initialProject, idleAdvance, homepageStart } = await import(`data:text/javascript;base64,${Buffer.from(linkedSource).toString('base64')}`);
await import('./drink-spin-source.mjs');
assert.deepEqual(projects.map(project => project.id), ['football', 'darty', 'drinks', 'piano']);
assert.deepEqual(sectionProjects.map(project => project.id), ['intro', ...projects.map(project => project.id)], 'Only the children’s carousel has a fifth slide');
assert.deepEqual(sectionProjects[0], { id: 'intro', name: 'Intro', type: 'intro' }, 'The intro keeps its HTML photo slot and has a name in the shared header control');
assert.deepEqual(sectionProjects.slice(1), projects, 'Both carousels keep the same four project media records');
assert.deepEqual(projects.find(project => project.id === 'drinks').drinks.map(({ name, lines }) => ({ name, lines })), [
  { name: 'Skids', lines: ["When you're in a rush, have some Skids."] },
  { name: 'Fizzy', lines: ['Light, bright red. Fizzy Extreme.'] },
  { name: 'Ground Pinch', lines: ['It’s sweet, fast, cheap, and will help you destroy your enemies.'] },
], 'The shared drink-viewer captions retain their existing words and capitalisation');
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
const before = execFileSync('git', ['show', `${process.env.PROJECT_COPY_BASE || process.env.SHOWCASE_BASE || 'd40ecf2'}:index.html`], { cwd: site, encoding: 'utf8' });
const after = await readFile(new URL('../index.html', import.meta.url), 'utf8');
// The team section and site-wide asset tokens carry owner-approved edits from other lanes (29 Oct: team copy, Sara's order,
// framework/menu/favicon tokens), so these guards compare the showcase-owned markup only.
const withoutOwnerContent = html => html
  .replace(/<section class="homepage-section team-section"[\s\S]*?<\/section>/, '<!-- team section: owner-managed -->')
  .replace(/((?:framework\.css|menu\.js|team-carousel\.js|toucan-favicon\.png|campaigns\.css))(?:\?v=[^"']+)?/g, '$1?v=TOKEN');
const withoutShowcaseTokens = html => withoutOwnerContent(homeNavigationMarkup(html)).replace(/(project-showcase\.(?:css|js)\?v=)[^"']+/g, '$1CACHE_TOKEN');
assert.equal(withoutShowcaseTokens(after), withoutShowcaseTokens(before), 'Homepage HTML changes only the shared CSS/JS cache tokens and clean home links');
const heroCopy = html => html.split('<div class="hero-copy">')[1].split('<div class="hero-world">')[0];
assert.equal(heroCopy(after), heroCopy(before), 'Homepage copy, buttons and benefits stay untouched');
const belowHero = html => html.slice(html.indexOf('<section class="homepage-section team-section"'));
assert.equal(withoutOwnerContent(homeNavigationMarkup(belowHero(after))), withoutOwnerContent(homeNavigationMarkup(belowHero(before))), 'Homepage content below the hero (outside the owner-managed team section) is preserved through the URL migration');

const children = await readFile(new URL('../children.html', import.meta.url), 'utf8');
assert.deepEqual([...children.matchAll(/data-project-slide data-project="([^"]+)"/g)].map(match => match[1]), sectionProjects.map(project => project.id), 'The intro precedes all four matching copy cards');
assert(!/data-project="intro"|Learning is easier when you enjoy it\./.test(after), 'The homepage has no intro slide');
for (const asset of ['css', 'js']) {
  const token = html => html.match(new RegExp(`project-showcase\\.${asset}\\?v=([^"']+)`))?.[1];
  assert(token(children) && token(children) === token(after), `${asset}: both pages share the refreshed cache token`);
  assert.notEqual(token(after), token(before), `${asset}: bump the changed asset’s cache token`);
}

const newspaperHTML = await readFile(new URL('../projects/football-journalism/index.html', import.meta.url), 'utf8');
const newspaperStylesheet = newspaperHTML.match(/href="(\.\/assets\/[^"?]+\.css)/)[1];
const newspaperStyles = await readFile(new URL(`../projects/football-journalism/${newspaperStylesheet}`, import.meta.url), 'utf8');
const mobileLayouts = [...newspaperStyles.matchAll(/@media\s*\(width\s*<=\s*(\d+)px\)\{([^@]*)/g)]
  .filter(([, , rules]) => /\.news-front,\.news-two,\.news-related\{grid-template-columns:minmax\(0,1fr\)/.test(rules));
assert.equal(mobileLayouts.length, 1, 'Identify the active build’s single-column front-page breakpoint');
export const newspaperMobileBreakpoint = Number(mobileLayouts[0][1]);
const newspaperScript = newspaperHTML.match(/src="(\.\/assets\/[^"?]+\.js)/)[1];
const newspaper = await readFile(new URL(`../projects/football-journalism/${newspaperScript}`, import.meta.url), 'utf8');
assert(newspaper.includes('(window===window.top||document.hasFocus())&&r.current?.focus'), 'The embedded newspaper must not take initial focus and block idle rotation');

for (const id of ['piano-toggle', 'hero-keyboard', 'sky-canvas', 'flock-canvas']) {
  assert.equal([...source.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `The shared piano must define #${id} exactly once`);
  for (const html of [after, children]) assert(!html.includes(`id="${id}"`), `Page markup must not duplicate the shared #${id}`);
}
assert.match(source, /import \{ initHeroSky \} from '\.\/hero-sky\.js\?v=/, 'Resolve the shared piano dependency before navigation');
assert(!source.includes("import('./hero-sky"), 'Switching must never wait for a lazy piano import');
const unmount = source.slice(source.indexOf('function unmount()'), source.indexOf('function mount(project)'));
assert(unmount.indexOf('stage.replaceChildren()') < unmount.indexOf('dispose?.()'), 'Detach outgoing canvas/iframe/media before resource cleanup');
assert(unmount.indexOf('pianoControl.replaceChildren()') < unmount.indexOf('dispose?.()'), 'Detach the outgoing toggle before cleanup');
const pianoMount = source.slice(source.indexOf("if (project.type === 'piano')"), source.indexOf("} else if (project.type === 'newspaper')"));
assert(pianoMount.indexOf('stage.innerHTML = pianoMarkup') < pianoMount.indexOf('activate ='), 'Real piano markup must be synchronous, before GPU activation');
assert(pianoMount.indexOf('pianoControl.innerHTML = pianoToggle') < pianoMount.indexOf('activate ='), 'The toggle must exist in the switch task');
assert.match(source, /showcase-piano-control piano-world/, 'Both toggles must receive the hero palette, expanded, hover and focus styles');
assert(!showcaseStyles.includes('#learner-projects .piano-panel-inner'), 'Projects must use the hero keyboard edge and appearance');
const hero = await readFile(new URL('../hero-sky.js', import.meta.url), 'utf8');
const keyboard = await readFile(new URL('../hero-keyboard.js', import.meta.url), 'utf8');
assert.equal(hero.match(/from '(\.\/hero-piano\.js[^']+)'/)[1], keyboard.match(/from '(\.\/hero-piano\.js[^']+)'/)[1], 'Sky and keyboard must share one song/audio singleton');
for (const file of ['hero.css', 'hero-sky.js', 'hero-piano.js', 'hero-keyboard.js', 'hero-songs.js', 'hero-piano-voices.js']) {
  assert.equal(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), execFileSync('git', ['show', `${process.env.PIANO_HERO_BASE || '132dbae'}:${file}`], { cwd: site, encoding: 'utf8' }), `${file}: preserve the existing hero and owner-confirmed music settings`);
}
console.log('Shared showcase checks passed: children-only intro, four unchanged homepage projects, cache tokens, exact idle deadline, resets, focus/playing/held input, hidden pause, reduced motion, manual mode and CSP.');
