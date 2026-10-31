// Browser-free policy and integration checks.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { homeNavigationMarkup } from './helpers/navigation-markup.mjs';
import '../scripts/check-project-cells-static.mjs';
const source = await readFile(new URL('../project-showcase.js', import.meta.url), 'utf8');
assert(source.includes("iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')"), 'The newspaper clip must open in a new tab');
const spinSource = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../project-showcase.css', import.meta.url), 'utf8');
assert(!spinSource.includes('Drag to spin') && !showcaseStyles.includes('drink-spin-hint'), 'Remove the drag hint markup and styles entirely');
const spinURL = `data:text/javascript;base64,${Buffer.from(spinSource).toString('base64')}`;
const matchSource = await readFile(new URL('../darty-match.js', import.meta.url), 'utf8');
const matchModule = `data:text/javascript;base64,${Buffer.from(matchSource).toString('base64')}`;
const { dartyMatchURL } = await import(matchModule);
assert.equal(Buffer.byteLength(dartyMatchURL), 64513, 'Preserve the complete owner-approved match URL');
assert.equal(createHash('sha256').update(dartyMatchURL).digest('hex'), 'ec050c4f3a828ae371ebcd1e9c84f601314450df099d8f79752930990ddcd32b', 'Preserve the owner-approved match URL with volume 30 and a fresh random seed');
const matchURL = new URL(dartyMatchURL);
assert.equal(matchURL.origin, 'https://joshtoucanlearn.github.io');
assert.equal(matchURL.pathname, '/darty/match-engine/match.html');
assert.deepEqual(matchURL.searchParams.getAll('autoplay'), ['1'], 'DARTY requires exactly one autoplay=1');
assert.deepEqual(matchURL.searchParams.getAll('simulationSeed'), ['random'], 'Each DARTY load requests a fresh random match');
assert.equal(createHash('sha256').update(matchURL.hash.slice(1)).digest('hex'), '23ae1c7f971bd722b9830a21820ebbae41f4984829846425c1981e8f2a5f7724', 'Keep the complete flMatch fragment byte-identical');
for (const [key, value] of Object.entries({ volume: '30', weather: 'overcast', matchMinutes: '6', clean: '1', director: 'showcase', commentary: '0' })) assert.equal(matchURL.searchParams.get(key), value);
assert.match(source, /matchMedia\('\(max-width: 767px\), \(pointer: coarse\) and \(hover: none\)'\)/, 'Keep the device query for newspaper prefetch and breakpoint teardown');
assert.match(source, /const interactive = '[^']*iframe/, 'The iframe keeps its own input');
const liveMatch = source.split("project.type === 'match'")[1].split("else if (project.type === 'drinks')")[0];
assert(!/compactDevice|stillsOnly/.test(liveMatch), 'DARTY title and playback have no phone or pointer gate');
assert(!/stillsOnly|screenshot-gallery|data-screenshot|dartyStills/.test(source) && !showcaseStyles.includes('screenshot-gallery'), 'Delete the obsolete gallery code and showcase styles');
assert.match(source, /img\.src = project\.titleStill \|\| poster;/, 'Every device warms the shared title backdrop');
assert(liveMatch.includes("play.addEventListener('click'"));
const beforeClick = liveMatch.split("play.addEventListener('click'")[0];
assert(!beforeClick.includes("createElement('iframe')") && !beforeClick.includes('dartyMatchURL'), 'No match is created or requested before Play');
assert.match(liveMatch, /frame\.src = dartyMatchURL/);
assert.match(liveMatch, /setAttribute\('sandbox', 'allow-scripts allow-same-origin'\)/);
assert.match(liveMatch, /setAttribute\('allow', 'autoplay; fullscreen'\)/);
assert.match(liveMatch, /frame\.loading = 'eager'/);
assert.match(liveMatch, /frame\.title = 'DARTY CPU vs CPU football match'/);
assert.match(liveMatch, /dispose = \(\) => \{[^}]*stop\(false\)/, 'Unmount cleanup must not restore outgoing media');
assert(liveMatch.indexOf('if (!restore) return;') < liveMatch.indexOf('stage.replaceChildren(title)'), 'Only visibility teardown restores the title card');
assert.match(liveMatch, /dispose\.setActive = active => \{[\s\S]*if \(!active\) stop\(\);/);
assert.match(liveMatch, /dispose\.isPlaying = \(\) => Boolean\(frame\)/);
assert.match(source, /compactDevice\.addEventListener\('change', \(\) => \{[\s\S]*?if \(entries\[index\]\.type !== 'match'\) return;/, 'Breakpoint changes use the current carousel entries, including the children-only intro');
// Policy imports run without a DOM; browser suites exercise the real sky module.
const skyURL = `data:text/javascript,export function initHeroSky(){throw new Error('Unexpected DOM mount in policy test')}`;
const linkedSource = source.replace(/(['"])\.\/drink-spin\.js(?:\?[^'"]*)?\1/, JSON.stringify(spinURL))
  .replace(/(['"])\.\/darty-match\.js(?:\?[^'"]*)?\1/, JSON.stringify(matchModule))
  .replace(/(['"])\.\/hero-sky\.js(?:\?[^'"]*)?\1/, JSON.stringify(skyURL))
  .replace(/(['"])\.\/hero-sky-shaders\.js(?:\?[^'"]*)?\1/, JSON.stringify(new URL('../hero-sky-shaders.js', import.meta.url).href));
const { projects, sectionProjects, initialProject, idleAdvance, homepageStart } = await import(`data:text/javascript;base64,${Buffer.from(linkedSource).toString('base64')}`);
const darty = projects.find(project => project.id === 'darty');
assert.equal(darty.type, 'match');
assert(!('images' in darty), 'There is no gallery image list');
const stillURL = n => `assets/projects/darty-still-${String(n).padStart(2, '0')}.webp?v=20261029-darty-title-5`;
assert.equal(darty.poster, stillURL(1), 'Keep the no-JS fallback poster');
assert.equal(darty.titleStill, stillURL(7), 'All devices use the number 2 floodlit still');
assert(!source.includes('showcase-darty-stills') && !showcaseStyles.includes('showcase-darty-still'), 'Remove the title slideshow code and styles');
const zoom = showcaseStyles.match(/@keyframes showcase-darty-zoom\s*\{\s*from\s*\{([^}]+)\}\s*to\s*\{([^}]+)\}\s*\}/);
assert(zoom && zoom.slice(1).every(frame => /^\s*transform:\s*scale\([\d.]+\);\s*$/.test(frame)), 'Title zoom animates only CSS transforms');
const approvedStillHashes = [
  '96d08ea8570d230de9dcf9163b7435c18665a6b02b5f6dc34c1bd63e1fd096a4',
  '3609c08b60f6e9b31eb9c8d9f4250f4107113b6b1201172832d6ac5a69021ba1',
  '7c65343d723b04d6f0de9639caf5fb91f85e285a80b5dac58f30b7815113adc7',
  '2e13434a367e149789e3febeb405df30a5af17a5eab31b3a06093540306cce44',
  'f211a52bc68c3f03b3d913866dfedd0fe436a14c4cbb80a4f891fa84b34d17d5',
  '66d26b266869cab40c747fa2609dca7facf0984a67ecfb8c149c6955d0d99556',
  '6c20a858e05c57a2b8216c659d4f7eaaef9ba536da5e39dcc21642d709b7c619',
  '550a025c051372af96a0f6192151a7c5c9f3a8f8752c201ce6110dcdbcf17496',
  '853fe95322e9d81c69ba07161fb1de54592a364803706b42dc1c503040e44aba',
  '77bdbc770aad5221a04f1419e76994adb0168a66ec4aa454b4bb0ad174cfdd61',
  '91f1ebb0e6895de23e1b8661e5578f5e3bb529cb64452409f0debefd3ad61638',
  '2bcef459980e7bd3b4530206fb7a232b2e30e010fc79acf95bba0aa8fbd6a8e7',
];
for (const [i, hash] of approvedStillHashes.entries()) {
  const src = stillURL(i + 1);
  const url = new URL(`../${src}`, import.meta.url);
  assert(url.pathname.endsWith(`/assets/projects/darty-still-${String(i + 1).padStart(2, '0')}.webp`));
  assert.equal(url.searchParams.get('v'), '20261029-darty-title-5', 'Replaced stills need a fresh cache token');
  assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'), hash, `Retained still ${i + 1} must match the approved day/night image byte for byte`);
}
await import('./drink-spin-source.mjs');
await import('./darty-title-lifecycle.mjs');
assert.deepEqual(projects.map(project => project.id), ['football', 'darty', 'drinks', 'piano']);
export const homepageCaptions = [
  ['English · Journalism', 'Football newspaper', 'Getting a discouraged student excited to practise English through his interests and insight.', 'His own growing sports journalism website, full of his previews, analysis and reports.'],
  ['English · Game design', 'DARTY (football game)', 'Getting an avoidant learner excited to practise writing clear, precise instructions.', 'A playable 3D football game built from his written requests: he directs, we code.'],
  ['SEN & English', 'Drink design', 'We found a dysregulated SEN student often regains his creative and working flow designing drinks.', 'A collection of drinks brands from his sketches, label designs and slogans into 3D renders.'],
  ['SEN · Music brain breaks', 'Toucan piano', 'A tool for a student, a few minutes at a time for productive brain breaks.', 'A custom keyboard, songs they can request and learn, and a fresh head for the next task.'],
];
assert.deepEqual(projects.map(({ label, heading, learning, result }) => [label, heading, learning, result]), homepageCaptions, 'Each caption has the approved subject, heading, learning and result');
assert.deepEqual(projects.map(project => project.name), ['Sports journalism', 'DARTY', 'Drink design', 'Piano'], 'The window bar keeps its existing project names');
assert(projects.every(project => !('line' in project)), 'The learning and result replace the old single sentence');
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
clock.tick(7999);
assert.equal(changes, 0, 'No advance before exactly 8 seconds');
clock.tick(1);
assert.equal(changes, 1, 'Advances at 8 seconds');
clock.tick(7000);
timer.reset();
clock.tick(7999);
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
clock.tick(999);
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
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(csp.split(';').map(directive => directive.trim()).find(directive => directive.startsWith('frame-src ')), "frame-src 'self' https://joshtoucanlearn.github.io", `${page}: allow only this additional frame origin`);
  assert.equal(csp.split('https://joshtoucanlearn.github.io').length - 1, 1, `${page}: the game origin belongs only in frame-src`);
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
  // Owner, 31 Oct: Microsoft Clarity adds its sources to the CSP and two tags.
  .replace(" https://www.clarity.ms https://scripts.clarity.ms", "").replace(" https://*.clarity.ms https://c.bing.com", "").replace(" https://*.clarity.ms", "")
  .replace(/\n\s*<script src="consent\.js[^"]*"><\/script>/, "").replace(/\n\s*<link rel="stylesheet" href="consent\.css[^"]*" \/>/, "")
  .replace(/<section class="homepage-section team-section"[\s\S]*?<\/section>/, '<!-- team section: owner-managed -->')
  // 30 Oct owner: trust pages added Terms and a sole-trader line to every footer.
  .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, '<!-- footer: owner-managed -->')
  // 30 Oct owner: the in-person area is Oxfordshire, not Henley.
  .replace(/Henley-on-Thames|Henley/g, 'Oxfordshire')
  // 29 Oct owner edits: text-only reviews (no autoplay/pause/art) and the showcase label's two corners.
  .replace(/<section class="homepage-section proof-section" id="reviews">[\s\S]*?<\/section>/, '<!-- reviews: owner-managed -->')
  .replace(/reviews-carousel\.js\?v=[^"]+/, 'reviews-carousel.js?v=TOKEN')
  // 30 Oct owner: the showcase label moved below the window, so compare without its position.
  .replace(/\n\s*<p class="eyebrow light[^"]*">[\s\S]*?<\/p>/, '')
  .replace(/((?:framework\.css|menu\.js|team-carousel\.js|toucan-favicon\.png|campaigns\.css|reviews-enquiry-sky\.js))(?:\?v=[^"']+)?/g, '$1?v=TOKEN');
const withoutShowcaseTokens = html => withoutOwnerContent(homeNavigationMarkup(html))
  .replace(/(project-showcase\.(?:css|js)\?v=)[^"']+/g, '$1CACHE_TOKEN')
  // 30 Oct: one homepage-only caption directly below the media window.
  .replace(/\n {10}<div class="hero-project-caption"[^>]*>[\s\S]*?<\/div>/, '')
  // 29 Oct flicker fix: the static fallback is recaptured from the live piano view.
  .replace(/(<img class="showcase-fallback" src=")[^"]+(" alt="[^"]*") width="\d+" height="\d+"/g, '$1FALLBACK$2 width="W" height="H"')
  .replace("frame-src 'self' https://joshtoucanlearn.github.io;", "frame-src 'self';");
assert.equal(withoutShowcaseTokens(after), withoutShowcaseTokens(before), 'Homepage HTML changes only the caption, showcase tokens, DARTY frame origin and clean home links');
const heroCopy = html => html.split('<div class="hero-copy">')[1].split('<div class="hero-world">')[0];
assert.equal(homeNavigationMarkup(heroCopy(after)), homeNavigationMarkup(heroCopy(before)).replace(/Henley-on-Thames|Henley/g, 'Oxfordshire'), 'Homepage copy, buttons and benefits stay untouched');
const belowHero = html => html.slice(html.indexOf('<section class="homepage-section team-section"'));
assert.equal(withoutOwnerContent(homeNavigationMarkup(belowHero(after))), withoutOwnerContent(homeNavigationMarkup(belowHero(before))), 'Homepage content below the hero (outside the owner-managed team section) is preserved through the URL migration');

const children = await readFile(new URL('../children.html', import.meta.url), 'utf8');
assert(children.includes(`src="${darty.poster}" alt="${darty.alt}" width="1600" height="900"`), 'Children fallback uses the new poster, night alt text and real dimensions');
assert.deepEqual([...children.matchAll(/data-project-slide data-project="([^"]+)"/g)].map(match => match[1]), sectionProjects.map(project => project.id), 'The intro precedes all four matching copy cards');
assert(!/data-project="intro"|Learning is easier when you enjoy it\./.test(after), 'The homepage has no intro slide');
assert.equal((after.match(/data-project-caption\b/g) || []).length, 1, 'The homepage has one caption');
assert.match(after, /<div class="hero-project-caption" data-project-caption aria-atomic="true">[\s\S]*?<\/div>\s*<div class="sky-studio" data-showcase data-showcase-mode="auto"/, 'The caption sits immediately above the homepage window (owner, 30 Oct)');
assert(!children.includes('data-project-caption'), 'The manual Children section has no homepage caption');
assert.match(source, /const caption = automatic \? root\.parentElement\.querySelector\('\[data-project-caption\]'\) : null;/, 'Only automatic homepage mode renders the caption');
const captionMarkup = after.match(/<div class="hero-project-caption"[^>]*>([\s\S]*?)<\/div>/)[1];
const captionParts = ['label', 'heading', 'learning', 'result'];
assert.deepEqual(captionParts.map(part => captionMarkup.match(new RegExp(`data-project-${part}>([^<]+)<`))?.[1]), homepageCaptions[3], 'The no-JS caption shows the complete piano story');
assert.deepEqual([...captionMarkup.matchAll(/<p class="project-caption-detail"><strong>(Mission:|Result:)<\/strong> <span data-project-(learning|result)>[^<]+<\/span><\/p>/g)].map(([, lead, field]) => [lead, field]), [['Mission:', 'learning'], ['Result:', 'result']], 'Two paragraphs retain bold lead words outside the changing text spans');
const captionUpdate = source.match(/if \(caption\) \{([\s\S]*?)\n    \}/)[1];
for (const part of captionParts) assert(captionUpdate.includes(`caption.querySelector('[data-project-${part}]').textContent = entries[index].${part};`), `${part}: update only textContent`);
assert(!/innerHTML|outerHTML|insertAdjacentHTML/.test(captionUpdate), 'Caption updates never parse HTML');
assert.match(source, /name\.textContent = entries\[index\]\.name;/, 'The window bar uses the unchanged name field');
for (const asset of ['css', 'js']) {
  const token = html => html.match(new RegExp(`project-showcase\\.${asset}\\?v=([^"']+)`))?.[1];
  assert(token(children), `${asset}: the Children page retains its existing asset reference`);
  assert.match(token(after), /^20261030-captions-\d+$/, `${asset}: the homepage uses a caption release token`);
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
assert(pianoMount.includes("stage.insertAdjacentHTML('beforeend', pianoMarkup)") && pianoMount.indexOf("stage.insertAdjacentHTML('beforeend', pianoMarkup)") < pianoMount.indexOf('activate ='), 'Real piano markup must be synchronous, before GPU activation, with the incoming poster retained');
assert(pianoMount.indexOf('pianoControl.innerHTML = pianoToggle') < pianoMount.indexOf('activate ='), 'The toggle must exist in the switch task');
assert.match(source, /showcase-piano-control piano-world/, 'Both toggles must receive the hero palette, expanded, hover and focus styles');
assert(!showcaseStyles.includes('#learner-projects .piano-panel-inner'), 'Projects must use the hero keyboard edge and appearance');
const hero = await readFile(new URL('../hero-sky.js', import.meta.url), 'utf8');
const keyboard = await readFile(new URL('../hero-keyboard.js', import.meta.url), 'utf8');
assert.equal(hero.match(/from '(\.\/hero-piano\.js[^']+)'/)[1], keyboard.match(/from '(\.\/hero-piano\.js[^']+)'/)[1], 'Sky and keyboard must share one song/audio singleton');
for (const file of ['hero.css', 'hero-sky.js', 'hero-piano.js', 'hero-keyboard.js', 'hero-songs.js', 'hero-piano-voices.js']) {
  const current = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  // Only the first-frame receipt and preset hand-off differ from the hero; both
  // sides are normalised so the approved base can move with owner-approved music.
  // 30 Oct: iOS only starts audio on a finger lift; the piano resumes its queued note then.
  const iosAudio = text => text
    .replace("if (audio.state === 'suspended') { resumeOnLift = true; audio.resume().catch(() => {}); }", "if (audio.state === 'suspended') audio.resume().catch(() => {});")
    .replace(/\/\/ iOS Safari only lets a page start audio[\s\S]*?\n}\n\n(?=export function playNextNote)/, '');
  const normalise = text => file === 'hero-piano.js' ? iosAudio(text) : file !== 'hero-sky.js' ? text : text
    .replace('initHeroSky(root, { onFirstFrame, preset: presetId } = {})', 'initHeroSky(root)')
    .replace('  || SKY_PRESETS.find(candidate => candidate.id === presetId)\n', '')
    .replace('let sized = false, firstFrame = false;\n', '')
    .replace('  // Showcase readiness only: report a fully sized draw with the sky image ready.\n  if (!firstFrame && sized && fallbackImage.complete && fallbackImage.naturalWidth) {\n    firstFrame = true;\n    onFirstFrame?.();\n  }\n', '')
    .replace('  // Showcase readiness only: report a fully sized draw once the live sky (not its still fallback) shows.\n  if (!firstFrame && sized && fallbackImage.complete && fallbackImage.naturalWidth && (!renderer || !sky.hidden)) {\n    firstFrame = true;\n    onFirstFrame?.();\n  }\n', '')
    .replace('  sized = rect.width > 0 && rect.height > 0;\n', '')
    // Cache tokens on its piano imports change with each piano fix (30 Oct: iOS audio).
    .replace(/(hero-(?:keyboard|piano)\.js\?v=)[^'"]+/g, '$1TOKEN');
  // 30 Oct: base moved to 90e02ba, the owner-requested Maple Leaf bars 1-16.
  const approved = execFileSync('git', ['show', `${process.env.PIANO_HERO_BASE || '90e02ba'}:${file}`], { cwd: site, encoding: 'utf8' });
  const untoken = text => text.replace(/(hero-(?:keyboard|piano|sky)\.js\?v=)[^'"]+/g, '$1TOKEN');
  assert.equal(untoken(normalise(current)), untoken(normalise(approved)), `${file}: preserve the existing hero and owner-confirmed music settings`);
}
console.log('Shared showcase checks passed: exact DARTY URL/hash/single autoplay, click-only iframe on all devices, teardown, children-only intro, four unchanged homepage projects, cache tokens, exact idle deadline, resets, focus/playing/held input, hidden pause, reduced motion, manual mode and CSP.');
