// Claude: serve this checkout, set BASE_URL, then run with the existing Puppeteer.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './project-showcase-source.mjs';
import { activatePianoToggle } from './piano-toggle-helpers.mjs';
import { checkDrinkSpin, assertDrinkLayout, dragOverDrink, checkDrinkMenuKeys } from './drink-spin-browser.mjs';
const site = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const base = process.env.BASE_URL || process.env.SHOWCASE_URL || 'http://127.0.0.1:4206';
const output = process.env.SHOWCASE_SCREENSHOTS || path.resolve(site, '../outputs/drink-spin-20261028/showcase');
const originalHome = execFileSync('git', ['show', `${process.env.SHOWCASE_BASE || 'd9d653b'}:index.html`], { cwd: site, encoding: 'utf8' });
const views = [{ width: 1440, height: 750 }, { width: 1280, height: 720 }, { width: 390, height: 844, isMobile: true, hasTouch: true }];
const ids = ['football', 'darty', 'drinks', 'piano'];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { layouts: [], pianoToggles: [], behaviour: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function open(view, theme, reduced = true, options = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ ...view, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now())); } catch {} }); // offer pop-up already seen
  await page.evaluateOnNewDocument(({ theme, random, fast }) => {
    localStorage.removeItem('toucan-theme');
    if (random !== undefined) Math.random = () => random;
    if (fast) {
      // Test-only acceleration. Production keeps 20,000 ms; source tests check it exactly.
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) => schedule(fn, delay >= 10000 && delay <= 20000 ? delay / 25 : delay, ...args);
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    window.showcaseAudio = [];
    if (Audio) {
      window.AudioContext = class extends Audio {
        constructor(...args) { super(...args); window.showcaseAudio.push(this); }
      };
    }
  }, { theme, ...options });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/WebGL.*CONTEXT_LOST|GPU stall/.test(message.text())) report.errors.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return { context, page };
}
async function load(page, route) {
  await page.goto(`${base}/${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-showcase-ready]');
  await page.evaluate(() => document.fonts.ready);
}
async function selected(page) { return page.$eval('[data-showcase]', root => root.dataset.project); }
async function project(page, id) {
  await page.$eval('[data-showcase]', root => root.focus({ preventScroll: true }));
  for (let i = 0; i < ids.length && await selected(page) !== id; i++) await page.$eval('[data-project-next]', button => button.click());
  assert.equal(await selected(page), id);
  await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center' }));
  if (id === 'piano') await page.waitForSelector('#hero-keyboard[data-song]');
}
async function metrics(page) {
  return page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    };
    const root = document.querySelector('[data-showcase]');
    const slide = root.querySelector('[data-project-slide]:not([hidden])');
    const copy = slide?.querySelector('.framework-project-copy');
    const media = slide?.querySelector('.framework-project-media');
    const stage = root.querySelector('.showcase-stage');
    return { id: root.dataset.project, slot: rect(root.querySelector('.showcase-cell')), stage: rect(stage), media: media && rect(media), copy: copy && rect(copy),
      copyFits: !copy || [...copy.querySelectorAll('h3, h4, p, a')].every(node => node.getBoundingClientRect().bottom <= copy.getBoundingClientRect().bottom + 1 && node.scrollWidth <= node.clientWidth + 1),
      rows: copy?.querySelectorAll('.project-copy-cells > div').length,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      inactiveInert: [...root.querySelectorAll('[data-project-slide][hidden]')].every(slide => slide.inert),
      heavyViews: root.querySelectorAll('iframe, video, #sky-canvas').length,
    };
  });
}
async function heroMetrics(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [r.x + scrollX, r.y + scrollY, r.width, r.height];
    };
    return Object.fromEntries(['.living-hero', '.hero-layout', '.hero-copy', '.hero-actions', '.hero-benefits', '.sky-studio'].map(selector => [selector, rect(selector)]));
  });
}
try {
  for (const view of views) for (const theme of ['light', 'dark']) {
    const { context, page } = await open(view, theme);
    const label = `${view.width}x${view.height}-${theme}`;
    await page.setRequestInterception(true);
    const intercept = request => {
      if (new URL(request.url()).pathname === '/index.html') void request.respond({ status: 200, contentType: 'text/html', body: originalHome });
      else void request.continue();
    };
    page.on('request', intercept);
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const before = await heroMetrics(page);
    page.off('request', intercept);
    await page.setRequestInterception(false);
    for (const route of ['index.html?project=football', 'children.html?project=football#learner-projects']) {
      await load(page, route);
      const sizes = [];
      for (const id of ids) {
        await project(page, id);
        await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center' }));
        await wait(100);
        const m = await metrics(page);
        sizes.push(m.slot.height);
        report.layouts.push({ label, route, ...m });
        await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-${id}.png`) });
        assert(m.horizontalOverflow <= 1, `${label}/${route}/${id}: horizontal overflow`);
        assert(m.copyFits && m.inactiveInert, `${label}/${id}: copy clipped or hidden copy focusable`);
        assert.equal(m.heavyViews, id === 'piano' || id === 'football' ? 1 : 0, 'Only the selected heavy view is mounted; reduced motion drinks use posters');
        if (route.startsWith('index')) {
          const after = await heroMetrics(page);
          for (const selector of Object.keys(before)) after[selector].forEach((value, i) => assert(Math.abs(value - before[selector][i]) <= 1, `${label}/${id}: ${selector} geometry changed`));
        } else {
          assert.equal(m.rows, 3);
          assert(Math.abs(m.slot.height - m.media.height) <= 1, 'Shared cell fills the media slot');
          if (view.width >= 1000) {
            const share = m.media.width / (m.media.width + m.copy.width);
            assert(share >= .59 && share <= .61, `${label}: media share ${share}`);
          } else assert(m.media.y >= m.copy.bottom - 1, 'Phone uses ordinary single-column flow');
        }
        if (id === 'football' && view.width === 1440 && view.height === 750 && theme === 'light') {
          const frameElement = await page.$('iframe');
          const frame = await frameElement.contentFrame();
          await frame.waitForSelector('.news-story-link');
          assert(await page.evaluate(() => document.activeElement !== document.querySelector('iframe')), 'Opening the newspaper must not take focus');
          await frame.click('.news-story-link');
          await frame.waitForSelector('.news-reader');
          await frame.waitForFunction(() => document.activeElement?.tagName === 'H1');
          assert.equal(await selected(page), 'football', 'Reading an article keeps the newspaper selected');
          await frame.click('.news-back');
          await frame.waitForSelector('.news-front');
        }
        if (id === 'darty') {
          const beforeImage = await page.$eval('[data-screenshot]', img => img.src);
          await page.click('[data-screenshot-next]');
          assert.notEqual(await page.$eval('[data-screenshot]', img => img.src), beforeImage);
          assert.equal(await selected(page), 'darty', 'Gallery controls leave the project selected');
        }
        if (id === 'drinks') for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
          await page.click(`[data-drink="${drink}"]`);
          assert.equal(await page.$eval(`[data-drink="${drink}"]`, button => button.getAttribute('aria-pressed')), 'true');
          assert.equal(await page.$('video'), null);
          assert((await page.$eval('.showcase-drink-screen img', img => img.src)).includes(`${drink}/poster.webp`));
          assert.equal(await page.$eval('.drink-spin', button => button.dataset.frame), '0');
          const drinkLayout = await assertDrinkLayout(page, drink);
          report.layouts.push({ label, route, drink, ...drinkLayout });
          await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-${drink}-card.png`) });
          if (drink === 'skids') {
            await dragOverDrink(page, view);
            if (view.width === 1440 && theme === 'light') await checkDrinkMenuKeys(page);
          }
        }
        if (id === 'piano') {
          report.pianoToggles.push(await activatePianoToggle(page, `${label}/${route}`));
          await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-piano-open.png`) });
          assert.equal(await page.$eval('#piano-toggle', button => button.getAttribute('aria-expanded')), 'true', `${label}/${route}: screenshot must leave the keyboard open`);
          assert.equal(await page.$$eval('.piano-key.is-now', keys => keys.length), 1);
          assert.equal(await page.$$eval('.piano-key.is-next', keys => keys.length), 1);
          if (view.width === 390) assert(['runaway', 'no-one-noticed'].includes(await page.$eval('#hero-keyboard', panel => panel.dataset.song)));
        }
      }
      assert(Math.max(...sizes) - Math.min(...sizes) <= 1, `${label}: project switch changes cell height`);
    }
    await context.close();
  }
  await checkDrinkSpin({ open, views, base, output, report });
  // Homepage opens on the piano for now (owner, 28 Oct), whatever the RNG says.
  for (let i = 0; i < ids.length; i++) {
    const { context, page } = await open(views[0], 'system-dark', true, { random: (i + .5) / ids.length });
    await load(page, 'index.html');
    assert.equal(await selected(page), 'piano', 'Homepage starts on the piano');
    await context.close();
  }
  const { context, page } = await open(views[0], 'system-dark', false, { fast: true });
  // Prevent networkidle0 consuming an accelerated idle period before assertions.
  await page.goto(`${base}/index.html?project=darty`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-showcase-ready]');
  await page.$eval('[data-showcase]', root => root.dispatchEvent(new Event('pointermove')));
  await wait(450);
  assert.equal(await selected(page), 'darty');
  await page.$eval('[data-showcase]', root => root.dispatchEvent(new Event('pointermove')));
  await wait(450);
  assert.equal(await selected(page), 'darty', 'Interaction postpones the deadline');
  await page.waitForFunction(() => document.querySelector('[data-showcase]').dataset.project === 'drinks');
  await page.$eval('[data-showcase]', root => root.focus());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Focused cell cannot advance');
  await page.waitForSelector('.drink-spin');
  for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
    await page.click(`[data-drink="${drink}"]`);
    await page.waitForFunction(() => document.querySelector('.drink-spin')?.dataset.frameCount);
    assert.equal(await page.$eval('.drink-spin', button => button.getAttribute('aria-label')), `Rotate ${drink === 'ground-pinch' ? 'Ground Pinch' : drink === 'skids' ? 'Skids' : 'Fizzy'}, 360° view`);
  }
  await page.evaluate(() => { window.oldSpin = document.querySelector('.drink-spin'); });
  await project(page, 'piano');
  assert(await page.evaluate(() => !window.oldSpin.isConnected), 'Switched frame viewer is disposed');
  report.pianoToggles.push(await activatePianoToggle(page, 'Idle/held-key check'));
  await page.keyboard.down('z');
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'piano', 'A held playing key blocks advance even after focus leaves');
  await page.keyboard.up('z');
  await page.$eval('[data-showcase]', root => root.focus());
  await page.evaluate(() => { window.oldSky = document.querySelector('#sky-canvas'); });
  await project(page, 'football');
  await page.waitForSelector('iframe');
  await page.waitForFunction(() => window.showcaseAudio.every(audio => audio.state !== 'running'));
  assert(await page.evaluate(() => !window.oldSky.isConnected && window.showcaseAudio.every(audio => audio.state !== 'running')), 'Piano sky detached and audio suspended');
  await page.evaluate(() => { window.oldFrame = document.querySelector('iframe'); });
  await project(page, 'darty');
  assert(await page.evaluate(() => !window.oldFrame.isConnected), 'Old iframe discarded');
  await project(page, 'drinks');
  await page.evaluate(() => {
    window.backgroundSpin = document.querySelector('.drink-spin');
    window.backgroundFrame = window.backgroundSpin.dataset.frame;
    window.showcaseHidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.showcaseHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Hidden document does not advance');
  assert(await page.evaluate(() => window.backgroundSpin.dataset.active === 'false' && window.backgroundSpin.dataset.frame === window.backgroundFrame), 'Background frame viewer is paused');
  await page.evaluate(() => { window.showcaseHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.$eval('[data-showcase]', root => root.focus());
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Reduced motion prevents automatic advance');
  assert((await page.$eval('.drink-spin img', img => img.src)).endsWith('/poster.webp'), 'Changing to reduced motion restores the poster before manual input');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await load(page, 'children.html?project=drinks#learner-projects');
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Projects remain manual');
  await page.focus('[data-showcase]');
  for (const [key, id] of [['End', 'piano'], ['ArrowLeft', 'drinks'], ['Home', 'football'], ['ArrowRight', 'darty']]) {
    await page.keyboard.press(key);
    assert.equal(await selected(page), id, `Manual keyboard navigation: ${key}`);
  }
  await page.focus('[data-screenshot-next]');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await selected(page), 'darty', 'Gallery keyboard input does not change projects');
  await project(page, 'drinks');
  await page.focus('[data-project-slide]:not([hidden]) .framework-project-copy > a');
  await page.keyboard.press('ArrowRight');
  assert.equal(await selected(page), 'drinks', 'Copy links retain keyboard input');
  await page.$eval('[data-project-next]', button => button.click());
  assert(await page.$eval('[data-showcase]', root => document.activeElement === root), 'Hiding focused copy recovers focus to the viewer');
  await project(page, 'drinks');
  await page.evaluate(() => { window.sectionSpin = document.querySelector('.drink-spin'); });
  await page.evaluate(() => { location.hash = 'getting-started'; });
  await page.waitForFunction(() => document.querySelector('#learner-projects').hidden);
  assert(await page.evaluate(() => window.sectionSpin.dataset.active === 'false'), 'Hidden Projects section pauses its frame viewer');
  report.behaviour.push('random start, interaction reset, idle advance, focus, held playing key, all drink sequences, piano/audio/iframe teardown, tab visibility, reduced motion, manual mode, hidden section');
  await context.close();
  // Keep readable static projects and all four copy cells for no-JS and print.
  const staticView = await open(views[0], 'light');
  await staticView.page.setJavaScriptEnabled(false);
  await staticView.page.goto(`${base}/children.html#learner-projects`, { waitUntil: 'networkidle0' });
  assert.equal(await staticView.page.$$eval('[data-project-slide]', slides => slides.filter(slide => getComputedStyle(slide).display !== 'none').length), 4);
  await staticView.context.close();
  const printView = await open(views[0], 'light');
  await load(printView.page, 'children.html#learner-projects');
  await printView.page.emulateMediaType('print');
  await printView.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await printView.page.$$eval('.showcase-fallback', images => images.filter(img => getComputedStyle(img).display !== 'none').length), 4);
  await printView.page.screenshot({ path: path.join(output, 'projects-print.png'), fullPage: true });
  await printView.context.close();
  assert.deepEqual(report.errors, [], 'No browser, asset or CSP errors');
  report.status = 'PASS';
  console.log(`Shared showcase browser checks passed. Screenshots: ${output}`);
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
