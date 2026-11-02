// Claude: BASE_URL=http://127.0.0.1:4206 node scripts/capture-mobile-pages.mjs
// No form submission, publication or mutations to the served site.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
assert(process.env.BASE_URL, 'Set BASE_URL to the served mobile-hormozi worktree.');
const base = new URL(process.env.BASE_URL.endsWith('/') ? process.env.BASE_URL : process.env.BASE_URL + '/');
const output = fileURLToPath(new URL('../../outputs/growth-review-20261025/mobile-polish/', import.meta.url));
const pages = ['index', 'subjects', 'children', 'adults', 'approach', 'team', 'contact', 'hoc-tieng-anh', 'privacy', 'terms', 'safeguarding', 'complaints', 'thank-you', '404'];
const views = [{ width: 390, height: 844 }, { width: 360, height: 780 }, { width: 320, height: 780 }];
const report = { base: base.href, theme: 'light', browserStarted: false, captures: [], layouts: [], reviewChecks: [], errors: [], failures: [] };
await mkdir(output, { recursive: true });
let browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await window.toucanStylesReady;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await pause(120);
}
async function loadWholePage(page) {
  // A fullPage capture alone does not fetch off-screen lazy images. Walk the
  // document to exercise the actual visibility-based modules and image loaders.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  let end = false;
  for (let step = 0; step < 200; step++) {
    await settle(page);
    const state = await page.evaluate(() => ({ top: scrollY, height: innerHeight, bottom: document.documentElement.scrollHeight }));
    if (state.top + state.height >= state.bottom - 1) { end = true; break; }
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), state.top + Math.floor(state.height * .75));
  }
  assert(end, 'The document must finish its loading/scrolling pass.');
  // Native rows can contain horizontally lazy-loaded portraits. Visit each
  // card as well as walking vertically, then restore the first card.
  const rows = await page.$$('.framework-profiles, .reviews-grid');
  for (const row of rows) {
    if (!await row.evaluate(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX === 'auto')) continue;
    await row.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    for (const card of await row.$$(':scope > *')) {
      await card.evaluate(node => node.parentElement.scrollTo({ left: node.parentElement.scrollLeft + node.getBoundingClientRect().left - node.parentElement.getBoundingClientRect().left, behavior: 'instant' }));
      await settle(page);
    }
    await row.evaluate(node => node.scrollTo({ left: 0, behavior: 'instant' }));
  }
  await page.waitForFunction(() => [...document.images].filter(img => img.getClientRects().length && getComputedStyle(img).visibility !== 'hidden').every(img => img.complete), { timeout: 15000 });
  const broken = await page.evaluate(() => [...document.images]
    .filter(img => img.getClientRects().length && getComputedStyle(img).visibility !== 'hidden' && !img.naturalWidth)
    .map(img => img.currentSrc || img.src));
  assert.deepEqual(broken, [], 'Visible images must load before capture.');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page);
}
async function checkReviewFixes(page, label, view) {
  const checks = await page.evaluate(() => {
    const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
    const footer = document.querySelector('.site-footer');
    return {
      height: document.documentElement.scrollHeight,
      afterFooter: footer ? document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + scrollY) : 0,
      portraits: [...document.querySelectorAll('.framework-portrait-frame--joshua')].filter(node => getComputedStyle(node).visibility !== 'hidden' && node.getClientRects().length).map(frame => ({ frame: box(frame), image: box(frame.querySelector('img')), loaded: !!frame.querySelector('img').naturalWidth })),
      steps: [...document.querySelectorAll('#how-it-works .how-steps > li')].map(node => {
        const parts = [box(node.querySelector('.how-number')), box(node.querySelector('h3')), box(node.querySelector('.how-step-media'))];
        return { overlap: parts.some((a, i) => parts.slice(i + 1).some(b => overlap(a, b))) };
      }),
      rows: [...document.querySelectorAll('.homepage .framework-profiles, .homepage .reviews-grid')].map(node => ({ snap: getComputedStyle(node).scrollSnapType, overflow: getComputedStyle(node).overflowX, width: node.clientWidth, scrollWidth: node.scrollWidth })),
    };
  });
  report.reviewChecks.push({ page: label, ...view, ...checks });
  assert(checks.afterFooter <= 2, `${label}: ${checks.afterFooter}px of blank document after footer`);
  for (const { frame, image, loaded } of checks.portraits) {
    assert(loaded, `${label}: Josh portrait loaded`);
    assert(Math.abs(image.width / frame.width - 2.2) < .02, `${label}: desktop Joshua crop must retain its 220% width`);
    assert(image.top < frame.top && image.bottom >= frame.bottom - 1, `${label}: Joshua crop must cover its frame`);
  }
  assert(checks.steps.every(step => !step.overlap), `${label}: approach badge/title/art overlap`);
  assert(checks.rows.every(row => row.snap === 'x mandatory' && row.overflow === 'auto' && row.scrollWidth > row.width), `${label}: team/reviews must be native swipe rows`);
}
async function checkWidth(page, label, view) {
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // Diagnostics only: clipped carousel neighbours may intentionally be wider
    // than their container, without making the document itself overflow.
    suspects: [...document.querySelectorAll('main *, footer *')].filter(node => {
      const box = node.getBoundingClientRect();
      return box.width && getComputedStyle(node).visibility !== 'hidden' && (box.right > innerWidth || box.left < 0);
    }).slice(0, 15).map(node => ({ tag: node.tagName, id: node.id, class: node.className })),
  }));
  report.layouts.push({ page: label, ...view, ...layout });
  assert.equal(layout.clientWidth, view.width, `${label}: viewport meta must preserve the requested ${view.width}px width`);
  assert.equal(layout.scrollWidth, layout.clientWidth, `${label} ${view.width}px: document overflow; ${JSON.stringify(layout.suspects)}`);
}
async function capture(page, label, view, suffix = '') {
  await loadWholePage(page);
  await checkWidth(page, label + suffix, view);
  await checkReviewFixes(page, label + suffix, view);
  if (view.width === 320) return;
  const file = `${label}${suffix}-${view.width}x${view.height}-${view.width === 390 ? 'full' : 'first'}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: view.width === 390 });
  report.captures.push(file);
}
try {
  browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  report.browserStarted = true;
  for (const view of views) for (const name of pages) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ ...view, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('toucan-theme', 'light');
      localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now()));
    });
    page.on('pageerror', error => report.errors.push({ page: name, width: view.width, message: error.message }));
    page.on('console', message => {
      if (/Refused to|Content Security Policy/.test(message.text())) report.errors.push({ page: name, width: view.width, message: message.text() });
    });
    try {
      // Use .html entry points so an ordinary static preview server works;
      // the site's existing navigation controller can clean the URL afterwards.
      const response = await page.goto(new URL(`${name}.html`, base).href, { waitUntil: 'load' });
      assert(response?.ok(), `${name}: HTTP ${response?.status()}`);
      await settle(page);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme.includes('light')), true, `${name}: light theme`);
      await capture(page, name, view);
      // Inspect the hidden subject/approach/adult panels too. Keep the requested
      // primary screenshots and save additional 390px panel captures separately.
      const panels = await page.$$eval('[data-panel-link]', links => links.map(link => link.getAttribute('href')));
      for (const href of panels.slice(1)) {
        await page.$$eval('[data-panel-link]', (links, href) => links.find(link => link.getAttribute('href') === href).click(), href);
        await settle(page);
        const id = href.slice(1).replace(/[^a-z0-9-]/gi, '-');
        if (view.width === 390) await capture(page, name, view, `--${id}`);
        else {
          await loadWholePage(page);
          await checkWidth(page, `${name}--${id}`, view);
        }
      }
    } catch (error) {
      report.failures.push({ page: name, ...view, message: error.stack });
      await page.screenshot({ path: path.join(output, `${name}-${view.width}-failure.png`), fullPage: true }).catch(() => {});
    } finally { await context.close(); }
  }
} catch (error) {
  report.failures.push({ stage: report.browserStarted ? 'capture' : 'browser-start', message: error.stack });
} finally {
  await browser?.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.captures.length} captures; ${report.layouts.length} width assertions; ${report.failures.length} failures; ${report.errors.length} page/CSP errors. ${output}`);
assert.deepEqual(report.failures, [], 'Capture/layout failures; see mobile-polish/report.json');
assert.deepEqual(report.errors, [], 'Page/CSP errors; see mobile-polish/report.json');
