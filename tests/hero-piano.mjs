// Run from this worktree, with python3 -m http.server 4201 in another terminal:
// node tests/hero-piano.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(pathToFileURL(require.resolve(
  process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core',
)));
const root = new URL('../', import.meta.url);
const songSource = await readFile(new URL('hero-songs.js', root), 'utf8');
const { songs } = await import(`data:text/javascript;base64,${Buffer.from(songSource).toString('base64')}`);
const keyboardSource = await readFile(new URL('hero-keyboard.js', root), 'utf8');
const pianoModule = keyboardSource.match(/from '(\.\/hero-piano\.js[^']*)'/)[1];
const output = process.env.PIANO_OUTPUT || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/final-pass-20261028/codex-piano';
const base = process.env.BASE_URL || 'http://127.0.0.1:4201';
const phoneIds = ['runaway', 'no-one-noticed'];
const desktop = { width: 1440, height: 750, deviceScaleFactor: 1 };
const phone = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { cases: [], waves: [], focusRegression: [], hitTests: [], resizes: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function openPiano(page, id, colour, viewport, reduced = false) {
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: colour },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ]);
  await page.goto(`${base}/index.html?song=${id}&sky=pixel`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#hero-keyboard')?.dataset.song);
  await page.evaluate(async path => {
    window.pianoUnderTest = await import(path);
    window.pianoAdvances = [];
    window.pianoWaves = [];
    window.pianoUnderTest.onSongAdvance(note => window.pianoAdvances.push(note));
    document.querySelector('#sky-canvas').addEventListener('piano-wave', event => {
      window.pianoWaves.push({ ...event.detail, at: performance.now() });
    });
    await document.fonts.ready;
  }, new URL(pianoModule, `${base}/index.html`).href);
  assert.equal(await page.evaluate(() => window.pianoAudio.contexts), 0, 'No audio on load');
  await page.click('#piano-toggle');
  await wait(550); // Let the panel transition and its own viewport-reveal scroll finish.
  assert.equal(await page.evaluate(() => window.pianoAudio.contexts), 0, 'No audio on opening');
  const choices = await page.evaluate(() => window.pianoUnderTest.availableSongs().map(song => song.id));
  assert.deepEqual(choices, viewport.width <= 600 && viewport.height > viewport.width ? phoneIds : songs.map(song => song.id));
}

async function highlighted(page, expected) {
  const state = await page.evaluate(() => {
    const keys = [...document.querySelectorAll('.piano-key.is-next')];
    const button = keys[0];
    if (!button) return { count: keys.length };
    const rect = button.getBoundingClientRect();
    const view = document.querySelector('.piano-scroll').getBoundingClientRect();
    const css = getComputedStyle(button);
    const white = button.classList.contains('piano-key--white');
    const x = (rect.left + rect.right) / 2;
    const y = white ? rect.bottom - 10 : (rect.top + rect.bottom) / 2;
    const hit = document.elementFromPoint(x, y);
    const describe = element => element && ({ tag: element.tagName, id: element.id,
      className: element.className, note: element.dataset.note, pitch: element.dataset.pitch,
      zIndex: getComputedStyle(element).zIndex, focusVisible: element.matches(':focus-visible') });
    return {
      count: keys.length, pitch: button.dataset.pitch, note: button.dataset.note,
      key: button.dataset.key.toLowerCase(), x, y,
      visible: css.display !== 'none' && css.visibility === 'visible' && rect.width > 0 && rect.height > 0
        && rect.left >= Math.max(0, view.left) - 1 && rect.right <= Math.min(innerWidth, view.right) + 1
        && rect.top >= 0 && rect.bottom <= innerHeight + 1,
      hit: hit === button, hitElement: describe(hit), focusedElement: describe(document.activeElement),
    };
  });
  assert.equal(state.count, 1, 'Exactly one highlighted key');
  assert.equal(state.pitch, expected, `Correct highlighted pitch: ${JSON.stringify(state)}`);
  assert.ok(state.visible, `Highlighted key is in the keyboard and screen: ${JSON.stringify(state)}`);
  assert.ok(state.hit, `Highlighted key can actually be hit: ${JSON.stringify(state)}`);
  return state;
}

async function counts(page) {
  return page.evaluate(() => ({
    advances: window.pianoAdvances.length, attacks: window.pianoAudio.attacks,
    waves: window.pianoWaves.length, next: window.pianoUnderTest.peekNextNote(),
  }));
}

async function gesture(page, state, kind) {
  if (kind === 'computer') await page.keyboard.press(state.key);
  else if (kind === 'touch') await page.touchscreen.tap(state.x, state.y);
  else if (kind === 'sky') {
    const point = await page.$eval('.world-art', art => {
      const rect = art.getBoundingClientRect();
      return { x: rect.left + rect.width * .5, y: rect.top + rect.height * .5 };
    });
    await page.mouse.click(point.x, point.y);
  } else if (kind === 'sky-keyboard') {
    await page.focus('.world-art');
    await page.keyboard.press('Enter');
  } else await page.mouse.click(state.x, state.y);
}

async function step(page, expected, following, kind, calm = false) {
  const state = await highlighted(page, expected);
  const before = await counts(page);
  await gesture(page, state, kind);
  const after = await counts(page);
  assert.equal(after.next, following, `${kind}: next note follows once`);
  assert.equal(after.advances, before.advances + 1, `${kind}: one advancement, including repeated notes`);
  assert.equal(after.attacks, before.attacks + 4, `${kind}: one sounded note, no double activation`);
  assert.equal(after.waves, before.waves + (calm ? 0 : 1), `${kind}: respects motion setting`);
  await highlighted(page, following);
}

async function noOverflow(page) {
  const result = await page.evaluate(() => {
    const scroll = document.querySelector('.piano-scroll');
    const visible = [...document.querySelectorAll('.piano-key')].filter(key => key.getClientRects().length);
    return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
      keyboardWidth: scroll.scrollWidth, keyboardViewport: scroll.clientWidth, left: scroll.scrollLeft,
      visiblePitches: visible.map(key => key.dataset.pitch) };
  });
  assert.ok(result.pageWidth <= result.viewport, `No page overflow: ${JSON.stringify(result)}`);
  assert.ok(result.keyboardWidth <= result.keyboardViewport, `No keyboard overflow: ${JSON.stringify(result)}`);
  assert.equal(result.left, 0, 'No horizontal keyboard scrolling');
  return result;
}

async function focusCoverRegression(page, viewport, colour) {
  // Load the old rule from a same-origin file; keep strict CSP intact.
  const oldRule = await page.addStyleTag({ url: `${base}/tests/fixtures/piano-focus-before.css` });
  await page.keyboard.press('Tab'); // Enter keyboard modality so :focus-visible applies.
  await page.$eval('.piano-key[data-note="D4"]', key => key.focus({ preventScroll: true }));
  const inspect = () => page.evaluate(() => {
    const target = document.querySelector('.piano-key[data-note="C#4"]');
    const rect = target.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
    const hit = document.elementFromPoint(x, y);
    const describe = key => key && ({ tag: key.tagName, note: key.dataset.note, pitch: key.dataset.pitch,
      zIndex: getComputedStyle(key).zIndex, focusVisible: key.matches(':focus-visible') });
    return { x, y, target: describe(target), hit: describe(hit), focused: describe(document.activeElement),
      clickable: hit === target };
  });
  let before;
  try {
    before = await inspect();
    assert.ok(before.focused.focusVisible, 'The reproduction must exercise keyboard focus');
    assert.equal(before.clickable, false, 'The old focus rule reproduces the occlusion');
    assert.equal(before.hit.note, 'D4', 'elementFromPoint identifies the focused white D4 covering black C#4');
    await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-${colour}-focus-before.png` });
  } finally {
    await oldRule.evaluate(style => style.remove());
  }
  const after = await inspect();
  assert.equal(after.clickable, true, `Black C#4 remains clickable beside focused D4: ${JSON.stringify(after)}`);
  assert.equal(after.hit.note, 'C#4');
  await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-${colour}-focus-after.png` });
  const result = { viewport, colour, before, after };
  console.log('FOCUS COVER: elementFromPoint before/after', JSON.stringify(result));
  report.focusRegression.push(result);
}

async function allVisibleKeysHittable(page, viewport, colour, song) {
  await page.keyboard.press('Tab');
  const result = await page.evaluate(() => {
    const keys = [...document.querySelectorAll('.piano-key')].filter(key => key.getClientRects().length);
    const failures = [];
    let samples = 0;
    const describe = key => key && ({ tag: key.tagName, id: key.id, className: key.className,
      note: key.dataset.note, pitch: key.dataset.pitch, zIndex: getComputedStyle(key).zIndex });
    for (const focused of keys) {
      focused.focus({ preventScroll: true });
      for (const key of keys) {
        const rect = key.getBoundingClientRect();
        const black = key.classList.contains('piano-key--black');
        const y = black ? (rect.top + rect.bottom) / 2 : rect.bottom - 10;
        for (const fraction of black ? [.25, .5, .75] : [.5]) {
          samples++;
          const x = rect.left + rect.width * fraction;
          const hit = document.elementFromPoint(x, y);
          if (hit !== key) failures.push({ focused: describe(focused), target: describe(key), hit: describe(hit), x, y,
            stack: document.elementsFromPoint(x, y).slice(0, 5).map(describe) });
        }
      }
    }
    return { visibleKeys: keys.length, focusedKeys: keys.length, samples, failures };
  });
  assert.deepEqual(result.failures, [], `Every key is hittable with every other key focused: ${JSON.stringify(result.failures.slice(0, 3))}`);
  report.hitTests.push({ viewport, colour, song: song.id, ...result });
  console.log(`PASS HIT TEST ${viewport.width}x${viewport.height} ${colour} ${song.id}: ${result.samples} elementFromPoint samples`);
}

async function cycleSongs(page, viewport) {
  const initial = await page.$eval('#hero-keyboard', panel => panel.dataset.song);
  const ids = await page.evaluate(() => window.pianoUnderTest.availableSongs().map(song => song.id));
  const positions = await page.$$eval('.piano-key', keys => keys.map(key => key.dataset.note));
  for (let i = 0; i < ids.length * 2; i++) {
    const before = await counts(page);
    const previous = await page.$eval('#hero-keyboard', panel => panel.dataset.song);
    const expectedId = ids[(ids.indexOf(previous) + 1) % ids.length];
    if (i % 3 === 0) await page.click('.piano-next');
    else {
      await page.focus('.piano-next');
      await page.keyboard.press(i % 3 === 1 ? 'Enter' : 'Space');
      assert.ok(await page.$eval('.piano-next', button => document.activeElement === button), 'Keyboard focus stays on Next song');
    }
    await wait(550);
    const expected = songs.find(song => song.id === expectedId);
    assert.equal(await page.$eval('#hero-keyboard', panel => panel.dataset.song), expectedId);
    assert.ok((await page.$eval('.piano-credit', credit => credit.textContent)).includes(expected.composer));
    assert.equal((await counts(page)).attacks, before.attacks, 'Next song is silent');
    assert.equal((await counts(page)).waves, before.waves, 'Next song does not emit a wave');
    assert.deepEqual(await page.$$eval('.piano-key', keys => keys.map(key => key.dataset.note)), positions, 'data-note never changes');
    await highlighted(page, expected.notes[0]);
    if (viewport.isMobile) await noOverflow(page);
    await step(page, expected.notes[0], expected.notes[1], viewport.isMobile ? 'touch' : 'computer');
  }
  assert.equal(await page.$eval('#hero-keyboard', panel => panel.dataset.song), initial, 'Next song wraps through the available choices');
}

async function resizeOpenPiano(page, width, height, preserveSong = false) {
  const before = await page.evaluate(() => {
    window.pianoResizeCheckpoint = {
      document, api: window.pianoUnderTest, panel: document.querySelector('#hero-keyboard'),
      advances: window.pianoAdvances, waves: window.pianoWaves, audio: window.pianoAudio,
    };
    return { song: window.pianoUnderTest.currentSong().id, next: window.pianoUnderTest.peekNextNote(),
      contexts: window.pianoAudio.contexts, attacks: window.pianoAudio.attacks };
  });
  // Puppeteer reloads if isMobile/hasTouch change. A real resize/rotation only
  // changes dimensions/orientation, so preserve the current device capabilities.
  const viewport = { ...page.viewport(), width, height, isLandscape: width > height };
  await page.setViewport(viewport);
  await wait(550);
  const after = await page.evaluate(() => {
    const previous = window.pianoResizeCheckpoint;
    const piano = window.pianoUnderTest;
    const panel = document.querySelector('#hero-keyboard');
    return {
      sameDocument: previous?.document === document,
      sameHook: Boolean(piano) && previous?.api === piano,
      samePanel: previous?.panel === panel,
      sameListeners: previous?.advances === window.pianoAdvances && previous?.waves === window.pianoWaves,
      sameAudio: previous?.audio === window.pianoAudio,
      open: panel?.classList.contains('is-open') && !panel.inert,
      expanded: document.querySelector('#piano-toggle')?.getAttribute('aria-expanded'),
      song: piano?.currentSong().id, next: piano?.peekNextNote(),
      choices: piano?.availableSongs().map(song => song.id),
      contexts: window.pianoAudio?.contexts, attacks: window.pianoAudio?.attacks,
    };
  });
  assert.ok(after.sameDocument, `Resize must not reload the page: ${JSON.stringify(after)}`);
  assert.ok(after.sameHook && after.samePanel && after.sameListeners && after.sameAudio, 'Resize retains the hook, panel, listeners and audio context');
  assert.ok(after.open && after.expanded === 'true', 'The open piano stays open after resize/rotation');
  assert.equal(after.contexts, before.contexts, 'Resize creates no audio context');
  assert.equal(after.attacks, before.attacks, 'Resize plays no note');
  const portraitPhone = width <= 600 && height > width;
  assert.deepEqual(after.choices, portraitPhone ? phoneIds : songs.map(song => song.id));
  if (preserveSong || after.choices.includes(before.song)) {
    assert.equal(after.song, before.song, 'An available song is retained');
    assert.equal(after.next, before.next, 'An available song retains its position');
  } else {
    assert.ok(phoneIds.includes(after.song), 'An unavailable song switches to a phone song');
    assert.equal(after.next, songs.find(song => song.id === after.song).notes[0]);
  }
  await highlighted(page, after.next);
  if (portraitPhone) await noOverflow(page);
  report.resizes.push({ viewport, before, after });
  console.log('PASS RESIZE: document/hook/piano state retained', JSON.stringify({ viewport, song: after.song, next: after.next }));
}

async function waveSequences(page, song, kind) {
  let i = 0;
  const strike = async () => {
    const state = await highlighted(page, await page.evaluate(() => window.pianoUnderTest.peekNextNote()));
    await gesture(page, state, i++ % 2 ? 'sky-keyboard' : kind);
    return page.evaluate(() => window.pianoWaves.at(-1));
  };
  await wait(2500);
  const first = await strike();
  assert.equal(first.y, .5, 'First note after a pause is centred');
  const fast = [];
  for (let n = 0; n < 4; n++) { await wait(65); fast.push(await strike()); }
  const slow = [];
  for (let n = 0; n < 3; n++) { await wait(1250); slow.push(await strike()); }
  assert.ok(fast.at(-1).y < .35, `Fast notes start high: ${JSON.stringify(fast)}`);
  assert.ok(slow.at(-1).y > .7, `Slow notes start low: ${JSON.stringify(slow)}`);
  await wait(2500);
  const reset = await strike();
  assert.equal(reset.y, .5, 'A pause resets the smoothing');
  const result = { song: song.id, input: kind, first, fast, slow, reset };
  console.log('WAVE ORIGINS (y=0 top, y=1 bottom)', JSON.stringify(result));
  report.waves.push(result);
}

let page;
try {
  page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.pianoAudio = { contexts: 0, attacks: 0 };
    document.addEventListener('securitypolicyviolation', event => {
      (window.pianoCspErrors ||= []).push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
    const Original = window.AudioContext || window.webkitAudioContext;
    if (!Original) return;
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); window.pianoAudio.contexts++; }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => { window.pianoAudio.attacks++; return start(...args); };
        return oscillator;
      }
    };
  });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', request => report.errors.push(`${request.url()}: ${request.failure()?.errorText}`));

  for (const colour of ['light', 'dark']) {
    for (const viewport of [desktop, phone]) {
      const offered = viewport.isMobile ? songs.filter(song => phoneIds.includes(song.id)) : songs;
      for (const song of offered) {
        await openPiano(page, song.id, colour, viewport);
        const actual = await page.$eval('#hero-keyboard', panel => panel.dataset.song);
        assert.equal(actual, song.id);
        await highlighted(page, song.notes[0]);
        if (song.id === (viewport.isMobile ? 'runaway' : 'entertainer')) {
          await focusCoverRegression(page, viewport, colour);
        }
        await allVisibleKeysHittable(page, viewport, colour, song);
        await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-${colour}-${song.id}.png` });
        const overflow = viewport.isMobile ? await noOverflow(page) : null;
        const inputs = viewport.isMobile ? ['touch', 'sky-keyboard'] : ['mouse', 'computer', 'sky'];
        for (const input of inputs) {
          for (let i = 0; i < song.notes.length; i++) {
            await step(page, song.notes[i], song.notes[(i + 1) % song.notes.length], input);
          }
        }
        // A wrong visible key sounds without skipping the song's current note.
        const wrong = await page.evaluate(() => {
          const next = window.pianoUnderTest.peekNextNote();
          const button = [...document.querySelectorAll('.piano-key')].find(key => key.dataset.pitch !== next && key.getClientRects().length);
          const rect = button.getBoundingClientRect();
          return { key: button.dataset.key.toLowerCase(), x: (rect.left + rect.right) / 2, y: rect.bottom - 10 };
        });
        const beforeWrong = await counts(page);
        await gesture(page, wrong, viewport.isMobile ? 'touch' : 'computer');
        assert.equal((await counts(page)).next, beforeWrong.next, 'Wrong notes do not skip the highlight');
        assert.equal((await counts(page)).advances, beforeWrong.advances);
        assert.deepEqual(await page.evaluate(() => window.pianoCspErrors || []), [], 'CSP stays strict');
        if (viewport.isMobile) await noOverflow(page);
        report.cases.push({ viewport, colour, song: song.id, notes: song.notes.length, inputs, overflow });
        console.log(`PASS ${viewport.width}x${viewport.height} ${colour} ${song.id}: ${song.notes.length} notes per input; loop checked`);
        if (colour === 'light' && song.id === 'runaway') {
          await waveSequences(page, song, viewport.isMobile ? 'touch' : 'computer');
          await cycleSongs(page, viewport);
        }
      }
    }
  }

  // Disallowed and invalid URL overrides must not bypass the phone song filter.
  for (const id of ['entertainer', 'maple-leaf-rag', 'gymnopedie-1', 'unknown', '']) {
    await openPiano(page, id, 'light', phone);
    assert.ok(phoneIds.includes(await page.$eval('#hero-keyboard', panel => panel.dataset.song)));
    await noOverflow(page);
    await highlighted(page, await page.evaluate(() => window.pianoUnderTest.peekNextNote()));
  }

  // Tablet and narrow landscape retain all songs; resizing an open piano remaps it.
  await openPiano(page, 'entertainer', 'light', desktop);
  for (const viewport of [{ width: 768, height: 1024 }, { width: 600, height: 390 }]) {
    await resizeOpenPiano(page, viewport.width, viewport.height);
  }
  await resizeOpenPiano(page, phone.width, phone.height);
  await resizeOpenPiano(page, desktop.width, desktop.height);
  assert.equal(await page.$$eval('.piano-key', keys => keys.filter(key => key.getClientRects().length).length), 37);

  // Actual phone rotation keeps touch/mobile capabilities and the current note.
  for (const id of phoneIds) {
    const song = songs.find(song => song.id === id);
    await openPiano(page, id, 'light', phone);
    for (let i = 0; i < 3; i++) await step(page, song.notes[i], song.notes[i + 1], 'touch');
    await resizeOpenPiano(page, 844, 390, true);
    await resizeOpenPiano(page, 390, 844, true);
    // Both the input handlers and the existing probe listeners must still work.
    await step(page, song.notes[3], song.notes[4], 'touch');
    await page.screenshot({ path: `${output}/390x844-light-${id}-after-rotation.png` });
  }

  // Reduced motion keeps notes/highlights but produces no waves, as before.
  const runaway = songs.find(song => song.id === 'runaway');
  for (const viewport of [desktop, phone]) {
    await openPiano(page, runaway.id, 'dark', viewport, true);
    for (let i = 0; i < runaway.notes.length; i++) {
      await step(page, runaway.notes[i], runaway.notes[(i + 1) % runaway.notes.length], viewport.isMobile ? 'touch' : 'computer', true);
    }
    await step(page, runaway.notes[0], runaway.notes[1], 'sky-keyboard', true);
    assert.ok(await page.$eval('body', body => body.classList.contains('is-calm')));
  }
  assert.deepEqual(report.errors, [], 'No browser, asset, or CSP errors');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  if (page) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${output}/browser-report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(`Report and screenshots: ${output}`);
}
