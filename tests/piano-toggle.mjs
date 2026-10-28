// Run independently so a phone homepage failure cannot hide the Projects result.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { activatePianoToggle, assertProjectPianoFits } from './piano-toggle-helpers.mjs';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const base = process.env.BASE_URL;
assert(base, 'Set BASE_URL to this served worktree');
const output = process.env.PIANO_TOGGLE_OUTPUT || fileURLToPath(new URL('../../outputs/shared-showcase-20261028/piano-toggle/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const views = [{ width: 1440, height: 750 }, { width: 1280, height: 720 }, { width: 390, height: 844, isMobile: true, hasTouch: true }];
const report = { cases: [], errors: [] };
try {
  for (const view of views) for (const theme of ['light', 'dark', 'system-dark']) for (const route of ['index.html', 'children.html']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const label = `${route}-${view.width}x${view.height}-${theme}`;
    const entry = { label, route, viewport: view, theme };
    report.cases.push(entry);
    try {
      await page.setViewport({ ...view, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(theme => {
        localStorage.removeItem('toucan-theme');
        if (theme !== 'system-dark') localStorage.setItem('toucan-theme', theme);
      }, theme);
      page.on('pageerror', error => report.errors.push(`${label}: ${error.message}`));
      await page.goto(`${base}/${route}?project=piano&song=runaway&sky=pixel${route === 'children.html' ? '#learner-projects' : ''}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      entry.open = await activatePianoToggle(page, label);
      await page.screenshot({ path: `${output}/${label}-open.png` });
      assert.equal(await page.$eval('#piano-toggle', button => button.getAttribute('aria-expanded')), 'true', `${label}: viewport capture closed the piano`);
      const keys = await page.$$eval('.piano-key', keys => keys.filter(key => key.getClientRects().length).map(key => {
        const r = key.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = key.classList.contains('piano-key--white') ? r.bottom - 10 : r.top + r.height / 2;
        return { note: key.dataset.pitch, x, y, inView: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight, hit: document.elementFromPoint(x, y) === key };
      }));
      assert(keys.some(key => key.inView && key.hit), `${label}: no usable piano keys after opening`);
      entry.close = await activatePianoToggle(page, `${label}: close`);
      assert.equal(entry.close.after.expanded, 'false');
      await page.$eval('[data-project-prev]', button => button.click());
      assert.equal(await page.$$eval('#piano-toggle', buttons => buttons.length), 0, `${label}: old toggle must be removed`);
      await page.$eval('[data-project-next]', button => button.click());
      entry.remount = await activatePianoToggle(page, `${label}: remount`);
      if (route === 'children.html' && view.isMobile) {
        entry.rotations = [];
        // Reproduce the failed run with a focused key and an advanced melody.
        // Do not scroll or refocus after resize: the component must reveal itself.
        for (let note = 0; note < 3; note++) {
          const point = await page.$eval('.piano-key.is-now', key => {
            const r = key.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: key.classList.contains('piano-key--white') ? r.bottom - 10 : r.top + r.height / 2 };
          });
          await page.touchscreen.tap(point.x, point.y);
        }
        await page.evaluate(() => {
          window.rotationPanel = document.querySelector('#hero-keyboard');
          window.rotationPitch = document.querySelector('.piano-key.is-now').dataset.pitch;
          window.rotationSong = window.rotationPanel.dataset.song;
        });
        for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
          await page.setViewport({ ...view, ...size, isLandscape: size.width > size.height, deviceScaleFactor: 1 });
          await new Promise(resolve => setTimeout(resolve, 550));
          const bounds = await assertProjectPianoFits(page, `${label}: rotate to ${size.width}x${size.height}`);
          const state = await page.evaluate(() => {
            const panel = document.querySelector('#hero-keyboard');
            const key = panel.querySelector('.piano-key.is-now');
            const r = key.getBoundingClientRect();
            const x = r.left + r.width / 2, y = key.classList.contains('piano-key--white') ? r.bottom - 10 : r.top + r.height / 2;
            return { samePanel: panel === window.rotationPanel, sameSong: panel.dataset.song === window.rotationSong,
              samePitch: key.dataset.pitch === window.rotationPitch, open: panel.classList.contains('is-open') && !panel.inert,
              visible: r.top >= 0 && r.bottom <= innerHeight && x >= 0 && x <= innerWidth, hit: document.elementFromPoint(x, y) === key, x, y };
          });
          assert(state.samePanel && state.sameSong && state.samePitch && state.open && state.visible && state.hit, `${label}: rotation must retain the open keyboard and a visible, hittable current key: ${JSON.stringify(state)}`);
          entry.rotations.push({ size, bounds, state });
          await page.screenshot({ path: `${output}/${label}-rotation-${size.width}x${size.height}.png` });
        }
      }
      entry.status = 'PASS';
    } catch (error) {
      entry.status = 'FAIL';
      entry.failure = error.stack;
      entry.probe = await page.evaluate(() => window.pianoToggleProbe && ({ state: window.pianoToggleProbe.state('failure'), trace: window.pianoToggleProbe.trace })).catch(() => null);
      await page.screenshot({ path: `${output}/${label}-failure.png` }).catch(() => {});
      console.error(`${label}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
  report.status = report.cases.every(entry => entry.status === 'PASS') && !report.errors.length ? 'PASS' : 'FAIL';
  if (report.status !== 'PASS') process.exitCode = 1;
  console.log(`Piano toggle: ${report.status}; ${report.cases.filter(entry => entry.status === 'PASS').length}/${report.cases.length} route/viewport/theme cases. Report: ${output}/report.json`);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
