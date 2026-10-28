// Claude: serve this worktree, set BASE_URL, then node tests/launch-offer.mjs.
// Uses installed Chrome/Playwright. No downloads or enquiry submissions.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
assert.ok(process.env.BASE_URL, 'Set BASE_URL to the server serving website-codex-offer.');
const base = new URL(process.env.BASE_URL.replace(/\/?$/, '/'));
const root = new URL('../', import.meta.url);
const output = new URL('../outputs/final-pass-20261028/codex-offer/', root);
const source = await readFile(new URL('launch-offer.js', root), 'utf8');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || '/Users/joshuagordonjones/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const pages = [];
for (const file of (await readdir(root)).filter(file => file.endsWith('.html'))) {
  if ((await readFile(new URL(file, root), 'utf8')).includes('<header')) pages.push(file);
}
const baselineRef = process.env.BASELINE_REF || 'HEAD';
const head = execFileSync('git', ['rev-parse', baselineRef], { cwd: root, encoding: 'utf8' }).trim();
const originalAssets = new Map([...pages, 'campaigns.css', 'contact.js'].map(file => [file,
  execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root, encoding: 'utf8' })]));
const report = { revision: 'popup-only', baseline: `Original site checkout HEAD ${head}, served locally by interception`, cases: [], failures: [], errors: [], csp: [] };
const viewports = [{ width: 1440, height: 750 }, { width: 1280, height: 720 }, { width: 390, height: 844 }];
const storageKey = 'toucan-launch-offer-last-shown';
const modes = ['baseline', 'active', 'inactive', 'expired'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) });
const url = path => new URL(path, base).href;
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`popup-${name}.png`, output)), animations: 'disabled' });
async function run(name, fn) {
  try { const detail = await fn(); report.cases.push({ name, status: 'PASS', ...detail }); }
  catch (error) { report.failures.push({ name, message: error.stack }); report.cases.push({ name, status: 'FAIL' }); }
}
async function setup({ viewport = viewports[0], colour = 'light', mode = 'active', resetSeen = false, storageThrows = false, motion = 'reduce', date = '2026-11-01T09:00:00Z' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme: colour, reducedMotion: motion });
  context.on('page', page => page.on('pageerror', error => report.errors.push({ mode, viewport, colour, url: page.url(), message: error.message })));
  await context.route('https://script.google.com/**', route => route.abort());
  await context.route('https://script.googleusercontent.com/**', route => route.abort());
  if (mode === 'baseline') await context.route('**/*', route => {
    const target = new URL(route.request().url());
    const file = decodeURIComponent(target.pathname.slice(base.pathname.length));
    if (target.origin === base.origin && originalAssets.has(file)) return route.fulfill({
      contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript', body: originalAssets.get(file)
    });
    return route.fallback();
  });
  if (mode === 'inactive') await context.route('**/launch-offer.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace('active: true', 'active: false') }));
  await context.addInitScript(({ resetSeen, storageThrows, storageKey }) => {
    // Context scripts also run on about:blank, whose opaque origin denies storage access.
    if (!['http:', 'https:'].includes(window.location.protocol)) return;
    // Hold the site's decorative art/photo/song choices constant for exact comparisons.
    Math.random = () => 0.25;
    if (storageThrows) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } });
    else if (resetSeen) localStorage.removeItem(storageKey);
    window.offerCSP = [];
    document.addEventListener('securitypolicyviolation', event => window.offerCSP.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
    window.addEventListener('load', () => { window.offerTestLoadedAt = Date.now(); }, { once: true });
  }, { resetSeen, storageThrows, storageKey });
  const page = await context.newPage();
  const startsAt = Date.parse(mode === 'expired' ? '2026-12-01T00:00:00Z' : date);
  // Pause before any site navigation. The initial forward jump runs only on about:blank;
  // from here every navigation and timing assertion shares a paused, deterministic clock.
  await page.clock.install({ time: new Date(startsAt - 60000) });
  await page.clock.pauseAt(startsAt);
  return { context, page };
}
async function open(page, path) {
  await page.bringToFront();
  await page.goto(url(path), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(500); // Existing hash alignment and size measurements settle before six seconds.
}
async function elapsed(page, target) {
  await page.bringToFront();
  const ms = await page.evaluate(target => window.offerTestLoadedAt + target - Date.now(), target);
  assert.ok(ms >= 0, `Test setup exceeded the ${target}ms observation point`);
  await page.clock.fastForward(ms);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const excluded = node => node.closest?.('.launch-offer-dialog, script, style, noscript');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const text = []; let node;
    while ((node = walker.nextNode())) {
      if (excluded(node.parentElement)) continue;
      const css = getComputedStyle(node.parentElement);
      const range = document.createRange(); range.selectNodeContents(node);
      if (css.visibility !== 'hidden' && css.visibility !== 'collapse' && range.getClientRects().length) text.push(node.nodeValue);
    }
    const layout = [];
    for (const element of document.querySelectorAll('body *')) {
      if (excluded(element)) continue;
      const css = getComputedStyle(element), r = element.getBoundingClientRect();
      if (!r.width || !r.height || css.visibility === 'hidden' || css.visibility === 'collapse') continue;
      layout.push({ tag: element.tagName, id: element.id || '', className: element.getAttribute('class') || '', x: r.x, y: r.y, width: r.width, height: r.height });
    }
    return { text, layout, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight,
      links: [...document.querySelectorAll('a[href]')].filter(a => !a.closest('.launch-offer-dialog')).map(a => a.getAttribute('href')),
      oldUI: !!document.querySelector('.launch-offer-slot, .launch-offer-pricing, .launch-offer-claim, .launch-offer-banner, #claim-launch-offer') };
  });
}
function unchanged(actual, expected, name) {
  assert.deepEqual(actual.text, expected.text, `${name}: byte-for-byte original visible page text (dialog excluded)`);
  assert.deepEqual(actual.links, expected.links, `${name}: all original page links preserved`);
  assert.equal(actual.oldUI, false, 'No banner, slot swap, pricing line or visible form additions');
  assert.equal(actual.layout.length, expected.layout.length, `${name}: same visible page elements`);
  actual.layout.forEach((element, index) => {
    const original = expected.layout[index];
    for (const key of ['tag', 'id', 'className']) assert.equal(element[key], original[key], `${name}: element ${index} identity`);
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(element[key] - original[key]) <= 1, `${name}: ${element.tag}#${element.id}.${key} ${element[key]} vs ${original[key]}`);
  });
  assert.ok(actual.scrollWidth <= actual.width + 1, `${name}: horizontal overflow`);
  assert.equal(actual.scrollHeight, expected.scrollHeight, `${name}: unchanged document height`);
}
async function collect(page, name) {
  const violations = await page.evaluate(() => window.offerCSP);
  report.csp.push(...violations.map(item => ({ name, ...item })));
  assert.equal(violations.length, 0, `CSP violations: ${JSON.stringify(violations)}`);
}
async function popupFits(page) {
  const dialog = page.locator('dialog.launch-offer-dialog[open]'); await dialog.waitFor({ state: 'visible' });
  const info = await dialog.evaluate(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight,
      overflow: node.scrollWidth > node.clientWidth + 1,
      focused: node.contains(document.activeElement), labelledBy: node.getAttribute('aria-labelledby'), describedBy: node.getAttribute('aria-describedby'),
      animation: getComputedStyle(node).animationName, bg: getComputedStyle(node).backgroundColor,
      text: node.innerText, href: node.querySelector('a').getAttribute('href') };
  });
  assert.ok(info.left >= 15 && info.top >= 15 && info.right <= info.width - 15 && info.bottom <= info.height - 15, `Dialog fits viewport: ${JSON.stringify(info)}`);
  assert.equal(info.overflow, false); assert.equal(info.focused, true);
  assert.equal(info.labelledBy, 'launch-offer-heading'); assert.equal(info.describedBy, 'launch-offer-summary launch-offer-terms');
  assert.equal(info.animation, 'none', 'Reduced motion suppresses the dialog animation');
  assert.match(info.text, /The next 5 new learners get their first 3 sessions free/); assert.match(info.text, /Book by 30 November\./);
  assert.match(info.text, /New learners only, one per family\. Sessions used within 6 weeks; after that, the agreed band applies\./);
  return info;
}
try {
  const receipt = await browser.newContext();
  assert.equal(await (await receipt.request.get(url('launch-offer.js?v=20261028-launch-offer-3'))).text(), source, 'BASE_URL must serve the edited worktree'); await receipt.close();
  for (const viewport of viewports) for (const colour of ['light', 'dark']) {
    const label = `${viewport.width}x${viewport.height}-${colour}`;
    const sessions = new Map();
    try {
      for (const mode of modes) sessions.set(mode, await setup({ viewport, colour, mode, resetSeen: true }));
      for (const path of pages) await run(`${label}-${path}-strict-page-preservation`, async () => {
        const before = {}, during = {};
        for (const mode of modes) { const { page } = sessions.get(mode); await open(page, path); before[mode] = await snapshot(page); }
        for (const mode of ['active', 'inactive', 'expired']) unchanged(before[mode], before.baseline, `${mode} before pop-up`);
        for (const mode of modes) {
          const { page } = sessions.get(mode); await elapsed(page, 6000); during[mode] = await snapshot(page);
          if (mode === 'baseline' || mode === 'active') await shot(page, `${mode}-${path.replace('.html', '')}-${label}`);
          await collect(page, `${mode}-${label}-${path}`);
        }
        for (const mode of ['active', 'inactive', 'expired']) unchanged(during[mode], during.baseline, `${mode} during pop-up`);
        for (const mode of ['baseline', 'inactive', 'expired']) assert.equal(await sessions.get(mode).page.locator('dialog.launch-offer-dialog').count(), 0);
        const page = sessions.get('active').page;
        const eligible = !['contact.html', 'thank-you.html'].includes(path);
        let popup;
        if (eligible) {
          await page.bringToFront(); popup = await popupFits(page);
          assert.equal(popup.href, 'contact.html?offer=launch');
          await page.keyboard.press('Escape'); await page.locator('dialog.launch-offer-dialog').waitFor({ state: 'hidden' });
          unchanged(await snapshot(page), during.baseline, 'After closing pop-up');
        } else assert.equal(await page.locator('dialog.launch-offer-dialog').count(), 0, 'Excluded page never receives a dialog');
        return { visibleText: 'identical', layoutElementsCompared: during.baseline.layout.length, popup };
      });
      await run(`${label}-home-team-landing-unchanged`, async () => {
        const scenes = {};
        for (const mode of ['baseline', 'active']) {
          const { page } = sessions.get(mode); await open(page, 'index.html#team'); await elapsed(page, 6000); scenes[mode] = await snapshot(page);
          await shot(page, `${mode}-home-team-${label}`);
        }
        unchanged(scenes.active, scenes.baseline, 'Our team landing with dialog open');
      });
    } finally { for (const { context } of sessions.values()) await context.close(); }
  }
  await run('six-second-timing-focus-trap-Escape-and-focus-return', async () => {
    const { context, page } = await setup();
    try {
      await open(page, 'index.html'); const origin = page.locator('body > header .logo'); await origin.focus();
      await elapsed(page, 5999); assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      await elapsed(page, 6000); await popupFits(page);
      assert.equal(await page.locator('.launch-offer-dialog__claim').evaluate(node => document.activeElement === node), true);
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('.launch-offer-dialog')), true); }
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('.launch-offer-dialog')), true); }
      await page.keyboard.press('Escape'); await page.locator('.launch-offer-dialog').waitFor({ state: 'hidden' });
      assert.equal(await origin.evaluate(node => node === document.activeElement), true);
      await collect(page, 'focus-trap');
    } finally { await context.close(); }
  });
  for (const method of ['later', 'close', 'backdrop']) await run(`${method}-closes-and-remembers`, async () => {
    const { context, page } = await setup();
    try {
      await open(page, 'index.html'); await page.locator('body > header .logo').focus(); await elapsed(page, 6000);
      if (method === 'backdrop') {
        const r = await page.locator('.launch-offer-dialog').boundingBox();
        await page.mouse.click(r.x + 4, r.y + r.height / 2); assert.equal(await page.locator('.launch-offer-dialog[open]').count(), 1, 'Inside padding is not the backdrop');
        await page.mouse.click(1, 1);
      } else await page.locator(`.launch-offer-dialog__${method}`).click();
      await page.locator('.launch-offer-dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('body > header .logo').evaluate(node => node === document.activeElement), true);
      await open(page, 'adults.html'); await elapsed(page, 60000); assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
    } finally { await context.close(); }
  });
  await run('scroll-past-40-percent-before-six-seconds', async () => {
    const { context, page } = await setup();
    try {
      await open(page, 'privacy.html');
      await page.evaluate(() => { const root = document.scrollingElement; root.scrollTop = Math.floor((root.scrollHeight - root.clientHeight) * .39); dispatchEvent(new Event('scroll')); });
      assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      await page.evaluate(() => { const root = document.scrollingElement; root.scrollTop = Math.ceil((root.scrollHeight - root.clientHeight) * .41); dispatchEvent(new Event('scroll')); });
      await popupFits(page);
      assert.ok(await page.evaluate(() => Date.now() - window.offerTestLoadedAt < 6000));
    } finally { await context.close(); }
  });
  for (const colour of ['light', 'dark']) await run(`mobile-menu-defers-both-triggers-${colour}`, async () => {
    const { context, page } = await setup({ viewport: viewports[2], colour });
    try {
      await open(page, 'index.html'); await page.locator('.mobile-menu summary').click(); await elapsed(page, 6000);
      assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      await page.evaluate(() => { const root = document.scrollingElement; root.scrollTop = (root.scrollHeight - root.clientHeight) * .5; dispatchEvent(new Event('scroll')); });
      assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      await shot(page, `mobile-menu-${colour}`);
      await page.keyboard.press('Escape'); await page.locator('.mobile-menu nav').waitFor({ state: 'hidden' });
      await popupFits(page); await shot(page, `mobile-menu-closed-${colour}`);
      await collect(page, `mobile-menu-${colour}`);
    } finally { await context.close(); }
  });
  await run('once-per-visitor-across-reload-tabs-and-14-day-expiry', async () => {
    const { context, page } = await setup();
    try {
      await open(page, 'index.html'); await elapsed(page, 6000);
      const shownAt = await page.evaluate(key => Number(localStorage.getItem(key)), storageKey);
      await page.locator('.launch-offer-dialog__later').click();
      await open(page, 'index.html'); await elapsed(page, 60000); assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      const tab = await context.newPage(); await open(tab, 'children.html'); await elapsed(tab, 60000); assert.equal(await tab.locator('.launch-offer-dialog').count(), 0); await tab.close();
      await page.clock.pauseAt(shownAt + 13 * 86400000); await open(page, 'adults.html'); await elapsed(page, 6000); assert.equal(await page.locator('.launch-offer-dialog').count(), 0);
      await page.clock.pauseAt(shownAt + 14 * 86400000 + 1000); await open(page, 'adults.html'); await elapsed(page, 6000); await popupFits(page);
    } finally { await context.close(); }
  });
  await run('claim-link-hidden-tagging-and-UTM-no-visible-form-change', async () => {
    const { context, page } = await setup();
    try {
      await open(page, 'index.html?utm_source=test&utm_medium=site&utm_campaign=launch'); await elapsed(page, 6000);
      await page.locator('.launch-offer-dialog__claim').click(); await page.waitForURL('**/contact.html?**');
      assert.equal(new URL(page.url()).searchParams.get('offer'), 'launch');
      assert.equal(await page.locator('#campaign-source').inputValue(), 'launch-offer');
      for (const [id, expected] of [['traffic-source', 'test'], ['traffic-medium', 'site'], ['campaign-name', 'launch']]) assert.equal(await page.locator(`#${id}`).inputValue(), expected);
      assert.equal(await page.locator('.launch-offer-dialog, .launch-offer-pricing, .launch-offer-claim, #claim-launch-offer').count(), 0);
      const payload = await page.locator('#enquiry-form').evaluate(form => Object.fromEntries(new FormData(form)));
      assert.equal(payload['Campaign source'], 'launch-offer'); assert.equal(Object.keys(payload).some(key => /claim/i.test(key)), false);
      await open(page, 'contact.html?service=ielts'); assert.equal(await page.locator('#campaign-source').inputValue(), 'ielts');
      await open(page, 'contact.html?service=ielts&offer=launch'); assert.equal(await page.locator('#campaign-source').inputValue(), 'launch-offer');
      await collect(page, 'hidden-tagging');
    } finally { await context.close(); }
  });
  for (const [label, date, expected] of [['closing-day', '2026-11-30T23:59:00Z', 1], ['crossing-midnight', '2026-11-30T23:59:58Z', 0]]) await run(label, async () => {
    const { context, page } = await setup({ date });
    try { await open(page, 'index.html'); await elapsed(page, 6000); assert.equal(await page.locator('.launch-offer-dialog[open]').count(), expected); }
    finally { await context.close(); }
  });
  await run('storage-denied-still-once-on-current-page', async () => {
    const { context, page } = await setup({ storageThrows: true });
    try {
      await open(page, 'index.html'); await elapsed(page, 6000); await popupFits(page);
      await page.locator('.launch-offer-dialog__later').click(); await elapsed(page, 60000);
      assert.equal(await page.locator('.launch-offer-dialog').count(), 0); await collect(page, 'storage-denied');
    } finally { await context.close(); }
  });
} catch (error) { report.failures.push({ name: 'suite', message: error.stack }); }
finally {
  await browser.close(); report.status = report.failures.length || report.errors.length || report.csp.length ? 'FAIL' : 'PASS';
  await writeFile(new URL('browser-report.json', output), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.status}: ${report.cases.length} cases; ${report.failures.length} failed; ${report.errors.length} page errors; ${report.csp.length} CSP violations. Screenshots/report: ${fileURLToPath(output)}`);
if (report.status !== 'PASS') process.exitCode = 1;
