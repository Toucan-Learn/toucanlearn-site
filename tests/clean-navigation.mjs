// Run with installed Chrome/Playwright. Without BASE_URL, serve files by request
// interception so no HTTP server is needed. No forms are submitted or messages sent.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.env.BASE_URL || 'http://toucan.test/');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || '/Users/joshuagordonjones/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
const errors = [];
let checks = 0;
async function context(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.addInitScript(() => { try { localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now())); } catch {} });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base.origin) return route.abort();
    if (process.env.BASE_URL) return route.continue();
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice(base.pathname.length - 1)));
    if (file !== root && !file.startsWith(root + path.sep)) return route.abort();
    try {
      // Like GitHub Pages: /subjects serves subjects.html.
      if (!path.extname(file) && !(await stat(file).catch(() => null))) file += '.html';
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      return route.fulfill({ path: file });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  return context;
}
async function clean(page, pathname) {
  // 29 Oct: pages running menu.js also drop .html from the address.
  await page.waitForFunction(() => !location.hash && !location.pathname.endsWith('/index.html')
    && !(location.pathname.endsWith('.html') && document.querySelector('script[src^="menu.js"]')));
  const url = new URL(page.url());
  if (pathname) assert.equal(url.pathname, new URL(pathname, base).pathname.replace(/\.html$/, ''));
  checks++;
}
async function open(page, route) {
  await page.goto(new URL(route, base).href, { waitUntil: 'load' });
  await clean(page);
}
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await context(viewport), page = await ctx.newPage();
    for (const file of (await readdir(root)).filter(file => file.endsWith('.html'))) {
      if (!(await readFile(path.join(root, file), 'utf8')).includes('<header')) continue;
      await open(page, file);
      const initial = await page.evaluate(() => history.length);
      const skip = page.locator('.skip-link'); await skip.focus(); await page.keyboard.press('Enter');
      await clean(page); assert.equal(await page.locator('#main').evaluate(main => document.activeElement === main), true);
      const links = page.locator('[data-panel-link]');
      for (let index = 0; index < await links.count(); index++) {
        const link = links.nth(index), id = (await link.getAttribute('href')).split('#')[1];
        await link.click(); await clean(page);
        assert.equal(await page.locator(`#${id}`).evaluate(panel => !panel.hidden && !panel.inert), true);
        assert.equal(await page.evaluate(() => history.length), initial);
      }
      if (viewport.width < 1000) {
        await page.locator('.mobile-menu > summary').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.mobile-menu').evaluate(menu => menu.open), false);
        assert.equal(await page.locator('.mobile-menu > summary').evaluate(summary => document.activeElement === summary), true);
      }
    }
    for (const [route, panel] of [['children.html#learner-projects', 'learner-projects'], ['approach.html#online-sessions', 'where-we-teach'], ['subjects.html#science', 'science']]) {
      await open(page, route);
      assert.equal(await page.locator(`#${panel}`).evaluate(node => !node.closest('[data-content-panel]').hidden), true);
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      assert.equal(await page.locator(`#${panel}`).evaluate(node => !node.closest('[data-content-panel]').hidden), true);
    }
    await open(page, 'index.html?project=darty&sky=night&reviewart=a,b#reviews');
    assert.equal(new URL(page.url()).search, '?project=darty&sky=night&reviewart=a,b');
    await page.waitForFunction(() => document.querySelector('[data-showcase]')?.dataset.project === 'darty');
    await page.locator('[data-project-next]').click(); await clean(page, './');
    await page.locator('.logo').click(); await clean(page);
    await open(page, 'team.html#aaron');
    assert.equal(await page.locator('[data-team-card][aria-current]').getAttribute('id'), 'aaron');
    const length = await page.evaluate(() => history.length);
    await page.locator('[data-team-next]').click(); await clean(page);
    assert.notEqual(await page.locator('[data-team-card][aria-current]').getAttribute('id'), 'aaron');
    await page.locator('[data-team-deck]').press('Home'); await clean(page);
    assert.equal(await page.locator('[data-team-card][aria-current]').getAttribute('id'), 'joshua');
    assert.equal(await page.evaluate(() => history.length), length);
    await open(page, 'children.html');
    await page.locator('[data-panel-link][href="#learner-projects"]').click();
    await page.locator('.logo').click(); await clean(page, './');
    await page.goBack({ waitUntil: 'commit' }); await clean(page, 'children.html'); // bfcache restores fire no 'load'
    await page.goForward({ waitUntil: 'commit' }); await clean(page, './');
    await open(page, 'children.html?utm_source=test&utm_medium=site&utm_campaign=launch');
    await page.locator('a[data-service="children"]:visible').first().click(); await clean(page, 'contact.html'); // the header CTA is hidden on phones
    assert.equal(new URL(page.url()).search, '');
    for (const [id, value] of [['campaign-source', 'children'], ['traffic-source', 'test'], ['traffic-medium', 'site'], ['campaign-name', 'launch']]) assert.equal(await page.locator('#' + id).inputValue(), value);
    for (const route of ['ielts.html', 'languages.html', 'in-person.html']) { await open(page, route); assert.equal(new URL(page.url()).search, ''); }
    await open(page, 'projects/football-journalism/index.html');
    const article = await page.locator('.news-story-link').first().getAttribute('href');
    const articleHistory = await page.evaluate(() => history.length);
    await page.locator('.news-story-link').first().click(); await page.locator('.news-reader').waitFor(); await clean(page);
    assert.equal(await page.evaluate(() => history.length), articleHistory);
    await page.locator('.news-back').click(); await page.locator('.news-front').waitFor(); await clean(page);
    await open(page, 'projects/football-journalism/' + article); await page.locator('.news-reader').waitFor(); await clean(page);
    await ctx.close();
  }
  assert.deepEqual(errors, [], 'No page exceptions');
  console.log(`PASS: ${checks} browser URL checks, desktop/phone panels, deep links, focus, menus, showcase, team cards, history, enquiry attribution and newspaper articles.`);
} finally { await browser.close(); }
