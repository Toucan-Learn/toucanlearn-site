// node scripts/capture-mobile-mock.mjs
// With no BASE_URL, fulfil local assets in memory: no preview server is needed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../../outputs/growth-review-20261025/mobile-mock/', import.meta.url));
const base = new URL(process.env.BASE_URL || 'http://toucan-mock.test/');
const report = { captures: [], layouts: [], checks: [], errors: [], browserStarted: false };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(output, { recursive: true });
let browser;
async function pageFor(width, height, theme) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width <= 700, hasTouch: width <= 700 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => {
    localStorage.setItem('toucan-theme', theme);
    localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now()));
    Math.random = () => .25;
  }, theme);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (/Refused to|Content Security Policy/.test(message.text())) report.errors.push(message.text()); });
  if (!process.env.BASE_URL) {
    await page.setRequestInterception(true);
    page.on('request', async request => {
      try {
        const url = new URL(request.url());
        if (url.protocol === 'data:') return request.continue();
        if (url.origin !== base.origin) return request.abort();
        let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root)) return request.abort();
        const info = await stat(file).catch(() => null);
        if (info?.isDirectory()) file = path.join(file, 'index.html');
        else if (!info && !path.extname(file)) file += '.html';
        return request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: await readFile(file) });
      } catch { return request.respond({ status: 404, contentType: 'text/plain', body: 'Not found' }); }
    });
  }
  return { page, context };
}
async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await window.toucanStylesReady;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await pause(250);
}
async function wholePage(page) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  for (let i = 0; i < 150; i++) {
    await settled(page);
    const { top, height, total } = await page.evaluate(() => ({ top: scrollY, height: innerHeight, total: document.documentElement.scrollHeight }));
    if (top + height >= total - 1) break;
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top + height * .75);
  }
  // Phone profiles and subject cards are horizontally lazy-loaded too.
  for (const row of await page.$$('.framework-profiles, [data-mock-swipe-row]')) {
    if (!await row.evaluate(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX === 'auto')) continue;
    await row.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    for (const card of await row.$$(':scope > *')) {
      await card.evaluate(node => node.parentElement.scrollTo({ left: node.parentElement.scrollLeft + node.getBoundingClientRect().left - node.parentElement.getBoundingClientRect().left, behavior: 'instant' }));
      await settled(page);
    }
    await row.evaluate(node => node.scrollTo({ left: 0, behavior: 'instant' }));
  }
  await page.waitForFunction(() => [...document.images].filter(img => img.getClientRects().length && getComputedStyle(img).visibility !== 'hidden').every(img => img.complete), { timeout: 15000 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await settled(page);
}
function desktopLayout() {
  const nodes = [...document.querySelectorAll('header, main, footer, h1, h2, h3, p, a, button, img, [data-showcase]')];
  return nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').map(node => {
    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
    return { tag: node.tagName, class: node.className, text: /^(P|H[1-3]|A|BUTTON)$/.test(node.tagName) ? node.textContent.replace(/\s+/g, ' ').trim() : '', box: [r.x, r.y, r.width, r.height].map(value => Math.round(value * 10) / 10), font: s.font, color: s.color, background: s.backgroundColor };
  });
}
try {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, pipe: true, args: ['--no-sandbox'] });
  report.browserStarted = true;
  for (const theme of ['light', 'dark']) {
    const { page, context } = await pageFor(390, 844, theme);
    try {
      await page.goto(new URL('index-mobile-mock.html', base).href, { waitUntil: 'load' });
      await wholePage(page);
      const layout = await page.evaluate(() => {
        const offer = document.querySelector('.mobile-mock-offer');
        const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
        const title = offer.querySelector('h1'), style = getComputedStyle(title);
        const frame = document.querySelector('.framework-portrait-frame--joshua');
        const portrait = frame.querySelector('img');
        return {
          theme: document.documentElement.dataset.theme, header: rect(document.querySelector('body > header')),
          offer: rect(offer), title: { ...rect(title), text: title.textContent, display: style.display, visibility: style.visibility, opacity: style.opacity, fontSize: parseFloat(style.fontSize) },
          items: [...offer.querySelectorAll('h1, .mobile-mock-audience, .mobile-mock-free, .mobile-mock-stars, .mobile-mock-stats, .mobile-mock-stats-note, .mobile-mock-guarantee, .mobile-mock-primary > .button, .mobile-mock-reply')].map(rect),
          guarantee: rect(offer.querySelector('.mobile-mock-guarantee')), button: rect(offer.querySelector('.button')), reply: rect(offer.querySelector('.mobile-mock-reply')),
          columns: [...offer.querySelectorAll('.mobile-mock-stats > div')].map(rect), footnote: rect(offer.querySelector('.mobile-mock-stats-note')),
          portrait: { frame: rect(frame), image: rect(portrait), loaded: !!portrait.naturalWidth },
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
          stickyHidden: document.querySelector('.mobile-mock-bar').hidden,
        };
      });
      report.layouts.push(layout);
      assert.equal(layout.scrollWidth, layout.clientWidth);
      assert.equal(layout.columns.length, 3);
      assert.equal(layout.title.text, 'Learning built around you.');
      assert(layout.title.display !== 'none' && layout.title.visibility === 'visible' && Number(layout.title.opacity) > 0 && layout.title.height > 30 && layout.title.fontSize >= 32, 'Phone headline is visibly sized');
      assert(layout.title.top >= layout.header.bottom && layout.title.bottom <= 844, 'The headline sits below the header inside the first screen');
      assert(layout.items.length === 9 && layout.items.every((item, index) => !index || item.top >= layout.items[index - 1].bottom - 1), 'Offer items are visible in the approved order without overlap');
      assert(layout.offer.bottom <= 844 && layout.reply.bottom <= 844, 'The entire offer and reply line fit the first screen');
      assert(layout.button.top - layout.guarantee.bottom <= 16 && layout.button.height >= 56, 'Primary action follows the guarantee with a tight gap');
      assert(layout.columns.every(column => Math.abs(column.width - layout.columns[0].width) <= 1 && column.top === layout.columns[0].top), 'Three equal aligned stat columns');
      assert(layout.footnote.height <= 18, 'Qualifiers occupy one small line at 390px');
      assert(layout.portrait.loaded && Math.abs(layout.portrait.image.width / layout.portrait.frame.width - 2.2) < .02 && layout.portrait.image.top < layout.portrait.frame.top && layout.portrait.image.bottom >= layout.portrait.frame.bottom - 1, 'Josh portrait loads and retains the desktop crop');
      assert(layout.stickyHidden, 'No sticky bar over the first-screen action');
      const first = `index-mobile-mock-390x844-${theme}-first.png`;
      const full = `index-mobile-mock-390x844-${theme}-full.png`;
      await page.screenshot({ path: path.join(output, first), fullPage: false });
      await page.screenshot({ path: path.join(output, full), fullPage: true });
      report.captures.push(first, full);
      await page.$eval('.hero-world', node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await settled(page);
      assert.equal(await page.$eval('.mobile-mock-bar', node => node.hidden), false, 'Sticky bar appears beyond the first screen');
      const height = await page.$eval('.mobile-mock-bar', node => node.getBoundingClientRect().height);
      assert(height >= 56 && height <= 64, `Sticky bar is 56–64px without a device safe-area inset: ${height}`);
      await page.$eval('.site-footer', node => node.scrollIntoView({ block: 'end', behavior: 'instant' }));
      await settled(page);
      assert.equal(await page.$eval('.mobile-mock-bar', node => node.hidden), true, 'Sticky bar hides at footer');
      for (const name of ['Who we help', 'Review', 'Subjects']) {
        const row = await page.evaluateHandle(name => [...document.querySelectorAll('[data-mock-swipe-row]')].find(node => node.dataset.mockSwipeRow === name || (name === 'Subjects' && node.dataset.mockSwipeRow === 'Subject')), name);
        await row.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await row.evaluate(node => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }));
        await settled(page);
        const state = await row.evaluate(node => ({ left: node.scrollLeft, current: node.nextElementSibling.querySelector('[aria-current="true"]')?.getAttribute('aria-label') }));
        assert(state.left > 0 && state.current, `${name}: native swipe position and dots update`);
      }
      report.checks.push(`${theme}: visible headline, ordered compact offer, equal stats/one-line qualifiers, portrait coverage, first-screen fit, width, unchanged sticky height/show/footer hide, swipe rows/dots`);
    } finally { await context.close(); }
  }
  // Compare the real desktop copy and mock after the same deterministic load.
  const layouts = [];
  for (const file of ['index.html', 'index-mobile-mock.html']) {
    const { page, context } = await pageFor(1440, 750, 'light');
    try {
      await page.goto(new URL(`${file}?project=piano&sky=pixel`, base).href, { waitUntil: 'load' });
      await settled(page);
      await page.waitForSelector('[data-showcase-ready]');
      await pause(500);
      layouts.push(await page.evaluate(desktopLayout));
    } finally { await context.close(); }
  }
  assert.deepEqual(layouts[1], layouts[0], '1440x750 desktop layout/type/copy matches index');
  report.checks.push('Desktop parity at 1440x750');
  assert.deepEqual(report.errors, [], 'No page/CSP errors');
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
