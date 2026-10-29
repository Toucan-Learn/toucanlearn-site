// Called by project-showcase.mjs. The match document is a cross-origin fixture
// by default; DARTY_LIVE=1 uses the real game for a separate visual/audio check.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertImmediateProjectSwitch } from './project-showcase-switch-helpers.mjs';

const source = await readFile(new URL('../darty-match.js', import.meta.url), 'utf8');
const { dartyMatchURL } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const matchOrigin = new URL(dartyMatchURL).origin;
const matchRequestURL = dartyMatchURL.split('#')[0];
const live = process.env.DARTY_LIVE === '1';

export async function checkDartyLive({ open, load, project, selected, views, wait, base, output, report }) {
  assert.notEqual(new URL(base).origin, matchOrigin, 'Exercise a cross-origin iframe');
  async function prepare(view) {
    // Reduced motion keeps setup deterministic. The idle test enables motion
    // before Play; production still uses the source-tested 20-second delay.
    const session = await open(view, 'light', true, { fast: true });
    const requests = [];
    await session.page.setRequestInterception(true);
    session.page.on('request', request => {
      if (new URL(request.url()).origin === matchOrigin) {
        requests.push(request.url());
        if (!live) {
          void request.respond({
            status: 200,
            contentType: 'text/html',
            headers: { 'cache-control': 'no-store' },
            body: '<!doctype html><html lang="en"><title>CPU match fixture</title><body><button>Match controls</button></body></html>',
          });
          return;
        }
      }
      void request.continue();
    });
    return { ...session, requests };
  }
  async function poster(page, { visible = true } = {}) {
    await page.waitForSelector('[data-darty-play]', { visible });
    assert.equal(await page.$('.showcase-match'), null, 'Poster has no iframe');
    assert.equal(await page.$('[data-screenshot-gallery]'), null, 'Desktop has no gallery controls');
    assert.equal(await page.$$eval('.showcase-stage img', images => images.length), 1);
    assert.equal(await page.$eval('.showcase-stage img', img => img.getAttribute('src')), 'assets/projects/darty-still-01.webp');
    assert.equal(await page.$eval('.showcase-stage', stage => stage.textContent.trim()), 'Play', 'Only the Play button appears over the poster; no hint text');
    assert.equal(await page.$$eval('[data-darty-play]', buttons => buttons.length), 1);
  }
  async function start(page, keyboard = false) {
    await poster(page);
    // Allow the card's IntersectionObserver to see a programmatic scroll.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const before = await page.$eval('.showcase-stage', node => {
      const { width, height } = node.getBoundingClientRect();
      return { width, height };
    });
    const response = page.waitForResponse(response => response.url().split('#')[0] === matchRequestURL);
    if (keyboard) {
      await page.focus('[data-darty-play]');
      await page.keyboard.press('Enter');
    } else await page.click('[data-darty-play]');
    await response;
    await page.waitForSelector('.showcase-match');
    const frame = await page.$eval('.showcase-match', iframe => {
      window.dartyOldFrame = iframe;
      const { width, height } = iframe.getBoundingClientRect();
      return { src: iframe.getAttribute('src'), sandbox: iframe.getAttribute('sandbox'), allow: iframe.getAttribute('allow'), loading: iframe.loading, title: iframe.title, width, height };
    });
    assert.equal(frame.src, dartyMatchURL, 'Use the complete owner-approved URL, including its fragment');
    assert.equal(frame.sandbox, 'allow-scripts allow-same-origin');
    assert.equal(frame.allow, 'autoplay; fullscreen');
    assert.equal(frame.loading, 'eager');
    assert.equal(frame.title, 'DARTY CPU vs CPU football match');
    assert(Math.abs(frame.width - before.width) <= 1 && Math.abs(frame.height - before.height) <= 1, 'Iframe fills the existing media cell without resizing it');
    assert.equal(await page.$('[data-darty-play]'), null, 'Play button is replaced while playing');
  }
  async function stopped(page) {
    await page.waitForFunction(() => !document.querySelector('.showcase-match'));
    assert(await page.evaluate(() => !window.dartyOldFrame.isConnected), 'Remove the iframe document entirely');
  }

  const { context, page, requests } = await prepare(views[0]);
  try {
    await load(page, 'index.html?project=darty');
    await project(page, 'darty');
    await poster(page);
    assert.deepEqual(requests, [], 'No request to the game origin before Play');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await start(page, true);
    assert(await page.$eval('.showcase-match', frame => document.activeElement === frame), 'Keyboard activation transfers focus to the match');
    await page.keyboard.press('ArrowRight');
    assert.equal(await selected(page), 'darty', 'Iframe input does not navigate projects');
    await page.evaluate(() => document.activeElement.blur());
    await wait(1700);
    assert.equal(await selected(page), 'darty', 'Playing match blocks idle advance even after focus leaves');
    assert.notEqual(await page.$('.showcase-match'), null);
    await page.screenshot({ path: path.join(output, 'darty-desktop-playing.png') });

    await assertImmediateProjectSwitch(page);
    assert.equal(await selected(page), 'drinks');
    await stopped(page);
    const afterSwitch = requests.length;
    await project(page, 'darty');
    await poster(page);
    assert.equal(requests.length, afterSwitch, 'Returning to DARTY needs another click');

    // Leaving a playing match backwards must also meet the existing <50ms
    // switch budget and show only the incoming project's media in every paint.
    await start(page);
    await assertImmediateProjectSwitch(page, 'prev');
    await stopped(page);
    await project(page, 'darty');

    await start(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await stopped(page);
    await poster(page, { visible: false });
    const afterLeaving = requests.length;
    await page.$eval('[data-showcase]', root => root.focus({ preventScroll: true }));
    await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center' }));
    await poster(page);
    assert.equal(requests.length, afterLeaving, 'Scrolling back does not restart the match');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForFunction(() => document.querySelector('[data-showcase]').dataset.project === 'drinks', { timeout: 3000 });
    await project(page, 'darty');

    await start(page);
    await page.evaluate(() => {
      window.dartyTabHidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.dartyTabHidden });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await stopped(page);
    await poster(page);
    const afterHidden = requests.length;
    await page.$eval('[data-showcase]', root => root.focus({ preventScroll: true }));
    await page.evaluate(() => { window.dartyTabHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await poster(page);
    assert.equal(requests.length, afterHidden, 'Returning to the tab restores only the poster');

    await start(page);
    await page.setViewport({ width: 767, height: 844, deviceScaleFactor: 1 });
    await stopped(page);
    await page.waitForSelector('[data-screenshot-next]');
    assert.equal(await page.$('[data-darty-play]'), null, 'Crossing the phone breakpoint removes the live player');
    await page.setViewport({ ...views[0], deviceScaleFactor: 1 });
    await poster(page);

    await load(page, 'children.html?project=darty#learner-projects');
    await project(page, 'darty');
    await poster(page);
    await start(page);
    const cleanURL = page.url();
    await page.$eval('[data-panel-link][href="#getting-started"]', link => link.click());
    await page.waitForFunction(() => document.querySelector('#learner-projects').hidden);
    await stopped(page);
    assert.equal(page.url(), cleanURL, 'Hiding Projects keeps the clean URL');
    const afterPanel = requests.length;
    await page.$eval('[data-panel-link][href="#learner-projects"]', link => link.click());
    await poster(page);
    assert.equal(requests.length, afterPanel, 'Showing Projects again does not restart the game');
    assert.equal(page.url(), cleanURL, 'Showing Projects keeps the clean URL');
    await start(page);
    await assertImmediateProjectSwitch(page);
    await stopped(page);
    await project(page, 'darty');
    await poster(page);

    // The manual carousel has an extra intro entry before DARTY. Its resize
    // policy must use that carousel's entries rather than homepage indices.
    await start(page);
    await page.setViewport({ width: 767, height: 844, deviceScaleFactor: 1 });
    await stopped(page);
    await page.waitForSelector('[data-screenshot-next]');
    assert.equal(await page.$('[data-darty-play]'), null);
    await page.setViewport({ ...views[0], deviceScaleFactor: 1 });
    await poster(page);
    report.behaviour.push(`DARTY ${live ? 'live game' : 'cross-origin fixture'}: click-only exact URL, focus, fixed size, playing blocks idle, switch/scroll/tab/panel/resize teardown`);
  } finally {
    await context.close();
  }

  for (const view of [views[2], { width: 767, height: 844 }, { width: 768, height: 844 }, { width: 1024, height: 768, hasTouch: true }]) {
    const session = await prepare(view);
    try {
      for (const route of ['index.html?project=darty', 'children.html?project=darty#learner-projects']) {
        await load(session.page, route);
        await project(session.page, 'darty');
        const gallery = await session.page.evaluate(() => matchMedia('(max-width: 767px), (pointer: coarse) and (hover: none)').matches);
        assert.equal(gallery, view.width <= 767 || Boolean(view.hasTouch), 'Exercise both the width and coarse-pointer gates');
        if (gallery) {
          await session.page.waitForSelector('[data-screenshot-next]');
          assert.equal(await session.page.$('[data-darty-play]'), null);
          assert.equal(await session.page.$('iframe'), null);
          for (let i = 1; i <= 4; i++) {
            assert.equal(await session.page.$eval('[data-screenshot]', img => img.getAttribute('src')), `assets/projects/darty-still-0${i}.webp`);
            assert.equal(await session.page.$eval('[data-screenshot-status]', status => status.textContent), `Gameplay screenshots · ${i} of 4`);
            await session.page.click('[data-screenshot-next]');
          }
          await session.page.focus('[data-screenshot-next]');
          await session.page.keyboard.press('ArrowLeft');
          assert.equal(await selected(session.page), 'darty', 'Phone gallery retains its keyboard input');
        } else await poster(session.page);
        assert.deepEqual(session.requests, [], 'Gallery and unplayed desktop poster never request the game');
      }
    } finally {
      await session.context.close();
    }
  }
  report.behaviour.push('DARTY phones: unchanged four-image gallery on both pages, 767/768 boundary and wide coarse-pointer coverage');
}
