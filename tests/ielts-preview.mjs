// Run from the IELTS worktree: node tests/ielts-preview.mjs
// Uses installed Playwright and Chrome; no downloads, external requests or form submissions.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/joshuagordonjones/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.IELTS_OUTPUT || resolve(root, '../outputs/final-pass-20261028/codex-ielts');
const report = { source: [], views: [], checks: [], errors: [] };
await mkdir(output, { recursive: true });

// Every existing full site menu gets IELTS immediately after Adults, including mobile.
for (const name of (await readdir(root)).filter(name => name.endsWith('.html'))) {
  const source = await readFile(resolve(root, name), 'utf8');
  const adults = [...source.matchAll(/<li><a href="adults.html">Adults<\/a><\/li>/g)];
  if (!adults.length) continue;
  assert.equal(adults.length, 2, `${name}: desktop and mobile Adults links`);
  assert.equal([...source.matchAll(/<li><a href="adults.html">Adults<\/a><\/li>\s*<li><a href="ielts.html">IELTS<\/a><\/li>/g)].length, 2, `${name}: IELTS menu links`);
  report.source.push({ page: name, menus: 2 });
}
const source = await readFile(resolve(root, 'ielts.html'), 'utf8');
assert.doesNotMatch(source, /<style\b|\sstyle=|\son\w+=|<script(?![^>]*\bsrc=)/i, 'CSP: no inline styles, handlers or scripts');
assert.doesNotMatch(source, /£|\bpsychologist\b|data-theme-toggle|route-boundary|scope-note/i);
assert.equal([...source.matchAll(/data-content-panel\b/g)].length, 4);
assert.match(await readFile(resolve(root, 'adults.html'), 'utf8'), /href="ielts.html">Explore IELTS preparation/);

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Outside checkout');
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end('Not found');
  }
});
let browser;
try {
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const sections = ['overview', 'how-we-prepare', 'which-ielts', 'pricing'];
  for (const viewport of [{ width: 1440, height: 750 }, { width: 390, height: 844 }]) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, colorScheme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
      await page.addInitScript(() => {
        window.ieltsCspViolations = [];
        document.addEventListener('securitypolicyviolation', event => window.ieltsCspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`));
      });
      await page.goto(`${base}/ielts.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelector('[data-content-panels][data-enhanced]'));
      const dimensions = `${viewport.width}x${viewport.height}`;
      let frameHeight;
      for (const section of sections) {
        await page.locator(`.framework-section-nav a[href="#${section}"]`).click();
        await page.waitForFunction(id => !document.getElementById(id).hidden, section);
        await page.evaluate(async () => {
          await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {})));
          await new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(accept)));
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const state = await page.evaluate(id => {
          const panel = document.getElementById(id);
          const frame = document.querySelector('.framework-panels').getBoundingClientRect();
          const main = document.getElementById('main').getBoundingClientRect();
          const active = [...document.querySelectorAll('[data-content-panel]')].filter(item => !item.hidden);
          const visible = [...panel.querySelectorAll('*')].filter(item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
          return { section: id, active: active.map(item => item.id), horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
            frame: { top: frame.top, bottom: frame.bottom, height: frame.height }, mainBottom: main.bottom,
            clipped: visible.filter(item => item.getBoundingClientRect().bottom > frame.bottom + 1).map(item => item.tagName),
            background: getComputedStyle(document.body).backgroundColor,
            frameBackground: getComputedStyle(document.querySelector('.framework-panels')).backgroundColor,
            brokenImages: [...document.images].filter(image => image.getClientRects().length && (!image.complete || !image.naturalWidth)).map(image => image.getAttribute('src')),
            csp: window.ieltsCspViolations,
          };
        }, section);
        assert.deepEqual(state.active, [section]);
        assert.equal(state.horizontalOverflow, false, `${dimensions} ${section}: horizontal overflow`);
        assert.deepEqual(state.brokenImages, []);
        assert.deepEqual(state.csp, []);
        assert.deepEqual(state.clipped, [], `${dimensions} ${section}: frame clips content`);
        if (viewport.width === 1440) {
          assert.ok(state.frame.bottom <= viewport.height + 1, `${section}: frame fits laptop, bottom ${state.frame.bottom}`);
          frameHeight ??= state.frame.height;
          assert.ok(Math.abs(state.frame.height - frameHeight) <= 1, 'Stable frame height between sections');
        }
        await page.screenshot({ path: resolve(output, `ielts-${dimensions}-${colorScheme}-${section}.png`) });
        if (viewport.width === 390) await page.screenshot({ path: resolve(output, `ielts-${dimensions}-${colorScheme}-${section}-full.png`), fullPage: true });
        report.views.push({ viewport, colorScheme, ...state });
      }
      // Deep links, browser history and keyboard focus must preserve section selection.
      await page.goto(`${base}/ielts.html#which-ielts`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#which-ielts').isVisible(), true);
      await page.locator('.framework-section-nav a[href="#how-we-prepare"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#prepare-heading').evaluate(element => element === document.activeElement), true);
      await page.goBack();
      assert.equal(await page.locator('#which-ielts').isVisible(), true);
      if (viewport.width === 390) {
        await page.locator('.mobile-menu summary').click();
        await page.locator('.mobile-menu a[href="ielts.html"]').click();
        assert.equal(await page.locator('.mobile-menu').getAttribute('open'), null);
      }
      await page.goto(`${base}/adults.html#english-for-work`, { waitUntil: 'networkidle' });
      await page.locator('#english-for-work a[href="ielts.html"]').click();
      assert.ok(page.url().endsWith('/ielts.html'));
      await page.locator('#overview a.button').click();
      assert.equal(new URL(page.url()).searchParams.get('service'), 'ielts');
      assert.equal(await page.locator('#campaign-source').inputValue(), 'ielts');
      report.checks.push(`${dimensions} ${colorScheme}: sections, history, keyboard, Adults link and IELTS enquiry attribution passed`);
      await context.close();
    }
  }
  assert.deepEqual(report.errors, [], 'No browser errors');
  console.log(`Passed: ${report.views.length} section views, ${report.source.length} site menus, enquiry attribution. Screenshots: ${output}`);
} catch (error) {
  report.failure = String(error.stack || error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  server.close();
}
