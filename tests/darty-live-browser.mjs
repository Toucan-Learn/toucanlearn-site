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
const stillURL = n => `assets/projects/darty-still-${String(n).padStart(2, '0')}.webp?v=20261029-darty-title-5`;

export async function checkDartyLive({ open, load, project, selected, views, wait, base, output, report }) {
  assert.notEqual(new URL(base).origin, matchOrigin, 'Exercise a cross-origin iframe');
  async function prepare(view) {
    // Reduced motion keeps setup deterministic. The idle test enables motion
    // before Play; production still uses the source-tested 8-second delay.
    const session = await open(view, 'light', true, { fast: true });
    const requests = [];
    const stillRequests = [];
    await session.page.setRequestInterception(true);
    session.page.on('request', request => {
      if (request.url().includes('/darty-still-')) stillRequests.push(request.url());
      if (new URL(request.url()).origin === matchOrigin) {
        requests.push(request.url());
        if (!live) {
          void request.respond({
            status: 200,
            contentType: 'text/html',
            headers: { 'cache-control': 'no-store' },
            body: '<!doctype html><html lang="en"><title>CPU match fixture</title><body style="background:#10232a;color:#fff7e9"><button>Match controls</button><script>window.muteMessages=[];addEventListener("message",event=>window.muteMessages.push({data:event.data,origin:event.origin,fromParent:event.source===parent}));</script></body></html>',
          });
          return;
        }
      }
      void request.continue();
    });
    return { ...session, requests, stillRequests };
  }
  async function poster(page, { visible = true } = {}) {
    await page.waitForSelector('[data-darty-play]', { visible });
    assert.equal(await page.$('.showcase-match'), null, 'Poster has no iframe');
    assert.equal(await page.$('[data-screenshot-gallery]'), null, 'No device has gallery controls');
    assert.equal(await page.$$eval('.showcase-stage img', images => images.length), 1, 'Title uses one decorative still');
    assert.deepEqual(await page.$eval('.showcase-darty-title > img', img => [img.getAttribute('src'), img.alt, img.getAttribute('aria-hidden')]), [stillURL(7), '', 'true']);
    assert.deepEqual(await page.$$eval('.showcase-darty-heading > *', nodes => nodes.map(node => node.textContent)), ['DARTY', 'A student’s answer to FIFA', 'CPU vs CPU · live match', 'Press to play'], 'Title card has exactly the wordmark, subtitle and one large button');
    assert.equal(await page.$$eval('[data-darty-play]', buttons => buttons.length), 1);
    assert.equal(await page.$('[data-darty-mute]'), null, 'Mute only appears during playback');
  }
  async function start(page, keyboard = false, touch = false) {
    await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center', behavior: 'instant' }));
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
    } else {
      // The rectangular button's outer padding must activate it too.
      const box = await (await page.$('[data-darty-play]')).boundingBox();
      if (touch) await page.touchscreen.tap(box.x + 6, box.y + box.height / 2);
      else await page.mouse.click(box.x + 6, box.y + box.height / 2);
    }
    await response;
    await page.waitForSelector('.showcase-match');
    await page.waitForSelector('.showcase-match[data-showcase-revealed]');
    await page.waitForFunction(() => !document.querySelector('[data-darty-mute]').disabled);
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
    assert.equal(await page.$eval('[data-darty-mute]', button => button.getAttribute('aria-pressed')), 'false', 'Every new match starts unmuted');
    assert.equal(await page.$eval('[data-darty-mute]', button => button.getAttribute('aria-label')), 'Mute DARTY match');
    assert.equal(await page.$$eval('.showcase-stage > .showcase-preview', posters => posters.length), 1, 'Keep the incoming poster underneath the revealed iframe');
  }
  async function stopped(page) {
    await page.waitForFunction(() => !document.querySelector('.showcase-match'));
    assert(await page.evaluate(() => !window.dartyOldFrame.isConnected), 'Remove the iframe document entirely');
    assert.equal(await page.$('[data-darty-mute]'), null, 'Teardown removes the mute control');
  }

  async function checkTitleLayout(page, { phone = false, desktopReference = false } = {}) {
    await page.keyboard.press('Tab');
    await page.focus('[data-darty-play]');
    const button = await page.$eval('[data-darty-play]', node => {
      const css = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const title = getComputedStyle(document.querySelector('.showcase-darty-wordmark'));
      const card = document.querySelector('.showcase-darty-title').getBoundingClientRect();
      const heading = document.querySelector('.showcase-darty-heading');
      const menu = heading.getBoundingClientRect();
      return { width: rect.width, height: rect.height, menuWidth: menu.width, color: css.color, background: css.backgroundColor, outline: parseFloat(css.outlineWidth), radius: parseFloat(css.borderRadius), orange: title.color,
        rightSide: menu.left >= card.left + card.width * .53, compact: card.width <= 440,
        fits: [...heading.children].every(node => { const box = node.getBoundingClientRect(); return box.left >= menu.left && box.right <= card.right - 4 && box.top >= card.top && box.bottom <= card.bottom && node.scrollWidth <= node.clientWidth + 1; }),
        focusFits: rect.left - 8 >= card.left && rect.right + 8 <= card.right && rect.top - 8 >= card.top && rect.bottom + 8 <= card.bottom,
        pageFits: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    assert(button.width >= (desktopReference ? 200 : Math.min(200, button.menuWidth) - 1) && button.height >= (phone || button.compact ? 44 : 56) && button.radius <= 6 && button.outline >= 3, 'Large rectangular button has a clear keyboard focus ring');
    assert.equal(button.color, 'rgb(16, 35, 42)');
    assert.equal(button.background, 'rgb(255, 247, 233)');
    assert.equal(button.orange, 'rgb(232, 100, 44)', 'Use the game banner orange');
    assert(button.fits, 'Heading, subtitle and button fit inside the cell without clipping');
    // Narrow cells (phones, and the children's page below 1000px) centre the menu.
    if (phone || button.compact) assert(button.focusFits && button.pageFits, 'Narrow-cell focus ring fits and the page has no horizontal overflow');
    else assert(button.rightSide, 'Menu stays on the shaded right, clear of the centre-left player');
  }

  async function checkTitle(page, stillRequests, route) {
    await page.waitForSelector('.showcase-darty-title[data-active="false"][data-ready]');
    const reduced = await page.$$eval('.showcase-darty-title img', images => images.map(img => ({ opacity: getComputedStyle(img).opacity, transform: getComputedStyle(img).transform, animations: img.getAnimations().length, fit: getComputedStyle(img).objectFit, cap: getComputedStyle(img).maxHeight })));
    assert.deepEqual(reduced.map(img => img.opacity), ['1'], 'Reduced motion shows the single still');
    assert(reduced.every(img => img.transform === 'none' && img.animations === 0), 'Reduced motion has no animation');
    assert(reduced.every(img => img.fit === 'cover' && img.cap === 'none'), 'Back-page image rules must not letterbox or cap the title stills');
    await checkTitleLayout(page, { desktopReference: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.waitForSelector('.showcase-darty-title[data-active="true"][data-ready]');
    await page.$eval('[data-showcase]', root => root.focus({ preventScroll: true }));
    const sample = async time => page.$eval('.showcase-darty-title img', (img, time) => {
      const animation = img.getAnimations()[0];
      animation.currentTime = time;
      return { src: img.getAttribute('src'), opacity: Number(getComputedStyle(img).opacity), scale: new DOMMatrix(getComputedStyle(img).transform).a, duration: animation.effect.getTiming().duration,
        keyframes: animation.effect.getKeyframes().map(frame => Object.keys(frame)) };
    }, time);
    for (const time of [0, 12000, 24000, 36000, 48000]) {
      const image = await sample(time);
      assert.equal(image.src, stillURL(7), 'The desktop backdrop never changes');
      assert.equal(image.opacity, 1, 'The still remains opaque throughout');
      assert.equal(image.duration, 24000, 'Zoom takes 24 seconds in each direction');
      assert(image.scale >= 1 && image.scale <= 1.0351, 'Zoom stays subtle');
      assert(image.keyframes.every(keys => keys.filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)).join() === 'transform'), 'The only image animation changes transform');
    }
    assert((await sample(12000)).scale > 1, 'Allowed motion gently zooms the still');
    await sample(0);
    const pause = async () => {
      await page.waitForSelector('.showcase-darty-title[data-active="false"]');
      // A CSS pause settles on the next animation frame; read time once it holds.
      const before = await page.$eval('.showcase-darty-title img', async img => { const animation = img.getAnimations()[0]; await animation.ready; return animation.currentTime; });
      await wait(180);
      const after = await page.$eval('.showcase-darty-title img', img => ({ time: img.getAnimations()[0].currentTime, state: img.getAnimations()[0].playState }));
      assert(after.state === 'paused' && Math.abs(after.time - before) < 2, 'Title zoom pauses');
    };
    await page.evaluate(() => {
      window.dartyTitleHidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.dartyTitleHidden });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pause();
    await page.evaluate(() => { window.dartyTitleHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForSelector('.showcase-darty-title[data-active="true"]');
    // The compact children page can keep the card in view even at the bottom.
    // Provide enough scroll room and verify it really left the viewport first.
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.dataset.dartyScrollSpacer = '';
      spacer.style.height = `${innerHeight}px`;
      document.body.append(spacer);
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    try {
      await page.waitForFunction(() => {
        const rect = document.querySelector('.showcase-cell').getBoundingClientRect();
        return rect.bottom < 0 || rect.top > innerHeight;
      });
      await pause();
    } finally {
      await page.evaluate(() => document.querySelector('[data-darty-scroll-spacer]').remove());
      await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
    await page.waitForSelector('.showcase-darty-title[data-active="true"]');
    const requested = [...new Set(stillRequests.map(url => new URL(url).pathname))];
    assert(requested.includes('/assets/projects/darty-still-07.webp'));
    assert(requested.every(src => /darty-still-0[17]\.webp$/.test(src)), 'Desktop requests only its backdrop and any static HTML fallback');
    await page.screenshot({ path: path.join(output, `darty-title-${route}.png`) });
  }

  const { context, page, requests, stillRequests } = await prepare(views[0]);
  try {
    await load(page, 'index.html?project=darty');
    await project(page, 'darty');
    await poster(page);
    await checkTitle(page, stillRequests, 'home');
    assert.deepEqual(requests, [], 'No request to the game origin before Play');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await start(page, true);
    assert(await page.$eval('.showcase-match', frame => document.activeElement === frame), 'Keyboard activation transfers focus to the match');
    const match = page.frames().find(frame => frame.url() === dartyMatchURL);
    const initialIcon = await page.$eval('[data-darty-mute]', button => button.innerHTML);
    const cleanBeforeMute = page.url();
    for (const muted of [true, false]) {
      await page.focus('[data-darty-mute]');
      await page.keyboard.press('Space');
      assert.equal(await page.$eval('[data-darty-mute]', button => button.getAttribute('aria-pressed')), String(muted));
      assert.equal(await page.$eval('[data-darty-mute]', button => button.getAttribute('aria-label')), muted ? 'Unmute DARTY match' : 'Mute DARTY match');
      assert.equal((await page.$eval('[data-darty-mute]', button => button.innerHTML)) === initialIcon, !muted, 'Speaker icon follows mute state');
    }
    if (!live) {
      await match.waitForFunction(() => window.muteMessages.length === 2);
      assert.deepEqual(await match.evaluate(() => window.muteMessages), [true, false].map(muted => ({ data: { source: 'toucan-showcase', type: 'darty-mute', muted }, origin: new URL(base).origin, fromParent: true })), 'Cross-origin fixture receives the exact mute API messages');
    }
    assert.equal(page.url(), cleanBeforeMute, 'Mute controls preserve the URL');
    await page.$eval('.showcase-match', frame => frame.focus());
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
    await poster(page);
    await start(page);
    await page.setViewport({ width: 768, height: 844, deviceScaleFactor: 1 });
    await stopped(page);
    await poster(page);
    await page.setViewport({ ...views[0], deviceScaleFactor: 1 });
    await poster(page);

    await load(page, 'children.html?project=darty#learner-projects');
    await project(page, 'darty');
    await poster(page);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await checkTitle(page, stillRequests, 'children');
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
    await poster(page);
    await start(page);
    await page.setViewport({ width: 768, height: 844, deviceScaleFactor: 1 });
    await stopped(page);
    await poster(page);
    await page.setViewport({ ...views[0], deviceScaleFactor: 1 });
    await poster(page);
    report.behaviour.push(`DARTY ${live ? 'live game' : 'cross-origin fixture'}: click-only exact URL, focus, fixed size, playing blocks idle, switch/scroll/tab/panel/resize teardown`);
  } finally {
    await context.close();
  }

  for (const view of [views[2], views[3], { width: 767, height: 844 }, { width: 768, height: 844 }, { width: 1024, height: 768, hasTouch: true }]) {
    const session = await prepare(view);
    try {
      for (const route of ['index.html?project=darty', 'children.html?project=darty#learner-projects']) {
        const requestsBefore = session.requests.length;
        await load(session.page, route);
        await project(session.page, 'darty');
        const compact = await session.page.evaluate(() => matchMedia('(max-width: 767px), (pointer: coarse) and (hover: none)').matches);
        assert.equal(compact, view.width <= 767 || Boolean(view.hasTouch), 'Exercise narrow widths and wide coarse-pointer input');
        await poster(session.page);
        await checkTitleLayout(session.page, { phone: view.width <= 767 });
        await session.page.focus('[data-darty-play]');
        await session.page.keyboard.press('ArrowLeft');
        assert.equal(await selected(session.page), 'darty', 'The Play button retains its keyboard input');
        assert.equal(session.requests.length, requestsBefore, 'The title card never requests the game before Play');
        await session.page.screenshot({ path: path.join(output, `darty-title-${view.width}-${route.startsWith('children') ? 'children' : 'home'}.png`) });
        await start(session.page, false, Boolean(view.hasTouch));
        assert.equal(await selected(session.page), 'darty', 'Playing leaves the project selected');
        await session.page.click('[data-darty-mute]');
        assert.equal(await session.page.$eval('[data-darty-mute]', button => button.getAttribute('aria-pressed')), 'true', 'Phone and tablet mute controls work');
        await session.page.screenshot({ path: path.join(output, `darty-playing-${view.width}-${route.startsWith('children') ? 'children' : 'home'}.png`) });
        await assertImmediateProjectSwitch(session.page);
        await stopped(session.page);
        const afterSwitch = session.requests.length;
        await project(session.page, 'darty');
        await poster(session.page);
        assert.equal(session.requests.length, afterSwitch, 'Returning on a phone or tablet still requires another press');
      }
    } finally {
      await session.context.close();
    }
  }
  report.behaviour.push('DARTY title: one decorative number 2 still, shaded right-side menu, gentle zoom, static reduced motion, tab/off-screen pause, title/button/focus, playback poster reveal and accessible cross-origin mute');
  report.behaviour.push('DARTY phones/tablets: shared title, large fitting Press to play button, click/tap-only exact iframe URL, reveal, mute and switch teardown on both pages at 390, 320, 767/768 and wide coarse-pointer input');
}
