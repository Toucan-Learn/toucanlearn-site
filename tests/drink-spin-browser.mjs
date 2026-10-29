// Browser integration is run by Claude through check-shared-showcase.sh.
import assert from 'node:assert/strict';
import path from 'node:path';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = page => page.$eval('.drink-spin', button => Number(button.dataset.frame));
const copy = {
  skids: { name: 'Skids', line: "When you're in a rush, have some Skids." },
  fizzy: { name: 'Fizzy', line: 'Light, bright red. Fizzy Extreme.' },
  'ground-pinch': { name: 'Ground Pinch', line: 'It’s sweet, fast, cheap, and will help you destroy your enemies.' },
};

// Delay decode independently of network completion and audit every mounted image.
async function auditDecodedImages(page) {
  await page.evaluateOnNewDocument(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const decoded = new WeakSet();
    window.spinDecodeErrors = [];
    window.spinDecodeWaiters = [];
    window.spinDecodeHold = null;
    window.spinStartupRows = [];
    window.spinPrematureRotation = [];
    window.spinFrameDecodes = new Set();
    window.releaseSpinDecodes = () => {
      window.spinDecodeHold = null;
      window.spinDecodeWaiters.splice(0).forEach(resolve => resolve());
    };
    HTMLImageElement.prototype.decode = async function () {
      await nativeDecode.call(this);
      if (this.src.includes(`/drinks/${window.spinDecodeHold}/`)) {
        await new Promise(resolve => window.spinDecodeWaiters.push(resolve));
      } else await new Promise(resolve => setTimeout(resolve, /\/skids\/060\.webp/.test(this.src) ? 1200 : 80));
      decoded.add(this);
      if (/\/skids\/\d{3}\.webp/.test(this.src)) window.spinFrameDecodes.add(new URL(this.src).pathname);
    };
    const check = () => document.querySelectorAll('.drink-spin img').forEach(img => {
      if (!decoded.has(img) || !img.complete || !img.naturalWidth) window.spinDecodeErrors.push(img.src);
    });
    new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    const tick = () => {
      check();
      const b = document.querySelector('.drink-spin');
      if (b?.dataset.active === 'true' && b.querySelector('img')?.dataset.drink === 'skids') {
        if (b.dataset.ready !== 'true' && (Number(b.dataset.turns || 0) !== 0 || !b.querySelector('img').src.includes('/poster.webp'))) {
          window.spinPrematureRotation.push(b.dataset.turns);
        }
        if (b.dataset.ready === 'true' && window.spinStartupRows.length < 90) {
          window.spinStartupRows.push([Number(b.dataset.lowerFrame), Number(b.dataset.upperFrame), Number(b.dataset.blend), window.spinFrameDecodes.size]);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const turns = page => page.$eval('.drink-spin', button => Number(button.dataset.turns || 0));
const posterPath = src => new URL(src).pathname.endsWith('/poster.webp');

export async function assertDrinkLayout(page, drink) {
  await page.waitForFunction(drink => {
    const images = [...document.querySelectorAll('.drink-spin img')];
    return images.length && images.every(image => image.dataset.drink === drink && image.dataset.decoded === 'true' && image.complete && image.naturalWidth > 0);
  }, {}, drink);
  const layout = await page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const image = document.querySelector('.drink-spin img');
    const screen = document.querySelector('.showcase-drink-screen');
    const stage = document.querySelector('.showcase-stage');
    const card = document.querySelector('.drink-info');
    const controls = document.querySelector('.showcase-drink-controls');
    const caption = document.querySelector('.showcase-caption');
    const s = rect(screen);
    const scale = Math.max(s.width / image.naturalWidth, s.height / image.naturalHeight);
    const painted = { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
    painted.x = s.x + (s.width - painted.width) / 2;
    painted.y = s.y + (s.height - painted.height) / 2;
    // A conservative central region contains the supplied bottle/can silhouettes.
    const subject = { x: painted.x + painted.width * .32, right: painted.x + painted.width * .68,
      y: Math.max(s.y, painted.y + painted.height * .06), bottom: Math.min(s.bottom, painted.y + painted.height * .94) };
    const c = rect(card);
    const menu = rect(controls);
    const coversDrink = box => box.x < subject.right && box.right > subject.x && box.y < subject.bottom && box.bottom > subject.y;
    return { screen: s, stage: rect(stage), slot: rect(stage.closest('.showcase-cell')), image: rect(image), controls: rect(controls), caption: caption && rect(caption), card: c,
      painted, fit: getComputedStyle(image).objectFit, position: getComputedStyle(image).objectPosition,
      backgrounds: [stage, screen, stage.querySelector('.showcase-drinks')].map(node => getComputedStyle(node).backgroundColor),
      buttons: [...controls.querySelectorAll('button')].map(rect),
      menuDirection: getComputedStyle(controls).flexDirection,
      phoneMenu: matchMedia('(max-width: 760px)').matches,
      menuCoversDrink: coversDrink(menu),
      menuInDragZone: Boolean(controls.closest('.drink-spin')),
      menuButtons: [...controls.querySelectorAll('button')].map(button => {
        const b = rect(button);
        const css = getComputedStyle(button);
        return { id: button.dataset.drink, pressed: button.getAttribute('aria-pressed'), tag: button.tagName,
          type: button.type, tabIndex: button.tabIndex, background: css.backgroundColor, ink: css.color,
          radius: parseFloat(css.borderRadius), receivesInput: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === button };
      }),
      hintCount: document.querySelectorAll('.drink-spin-hint').length,
      hintText: stage.textContent.includes('Drag to spin'),
      inset: parseFloat(getComputedStyle(stage.closest('[data-showcase]')).getPropertyValue('--showcase-inset')),
      cardName: card.querySelector('strong').textContent, cardLine: card.querySelector('p').textContent,
      cardBackground: getComputedStyle(card).backgroundColor, cardInk: getComputedStyle(card).color,
      cardPointerEvents: getComputedStyle(card).pointerEvents,
      cardPassesDrag: c.y + c.height / 2 < s.y || document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2)?.closest('.drink-spin') === document.querySelector('.drink-spin'),
      cardFits: card.scrollWidth <= card.clientWidth + 1 && card.scrollHeight <= card.clientHeight + 1,
      cardCoversDrink: coversDrink(c),
    };
  });
  assert.equal(layout.fit, 'cover', 'Drink frames cover the available image slot');
  assert.equal(layout.position, '50% 50%', 'The drink stays centred');
  assert(layout.painted.width >= layout.screen.width - 1 && layout.painted.height >= layout.screen.height - 1, 'No uncovered image edges');
  for (const edge of ['x', 'y', 'width', 'height']) assert(Math.abs(layout.image[edge] - layout.screen[edge]) <= 1, `Image fills the drag zone: ${edge}`);
  for (const edge of ['x', 'right']) assert(Math.abs(layout.screen[edge] - layout.stage[edge]) <= 1, 'The drink fills the slot edge to edge');
  assert.deepEqual(layout.backgrounds, Array(3).fill('rgb(31, 122, 117)'), 'Teal stays behind the poster and loading frames');
  assert.equal(layout.hintCount, 0, 'No drag hint is mounted');
  assert.equal(layout.hintText, false, 'No drag hint copy is shown');
  assert(Math.abs(layout.screen.bottom - layout.stage.bottom) <= 1 && Math.abs(layout.screen.bottom - (layout.caption?.y ?? layout.slot.bottom)) <= 1, 'The image fills the media area up to the homepage caption or the section cell edge');
  assert(Math.abs(layout.controls.x - layout.stage.x - layout.inset) <= 1, 'The menu uses the left inset');
  assert(!layout.menuInDragZone && !layout.menuCoversDrink, `The menu stays outside the central drink region: ${JSON.stringify(layout)}`);
  assert(layout.controls.width < layout.stage.width - 2 * layout.inset - 1, 'The menu stays compact');
  if (layout.phoneMenu) {
    assert.equal(layout.menuDirection, 'row', 'Phone uses a compact horizontal menu');
    assert(layout.buttons.every(button => Math.abs(button.y - layout.buttons[0].y) <= 1), 'Phone pills share one row');
    assert(layout.controls.y >= layout.card.bottom + 4 && layout.controls.bottom <= layout.screen.y - 4, 'The phone menu sits between the card and drink');
  } else {
    assert.equal(layout.menuDirection, 'column', 'Desktop uses a vertical menu');
    assert(Math.abs(layout.controls.y - layout.card.y) <= 1 && Math.abs(layout.controls.y - layout.stage.y - layout.inset) <= 1, 'Menu and card share the top inset');
    assert(layout.buttons.every((button, i, buttons) => Math.abs(button.x - buttons[0].x) <= 1 && (!i || button.y >= buttons[i - 1].bottom + 4)), 'Desktop pills are stacked at the left');
    assert(layout.controls.right < layout.stage.x + layout.stage.width / 2, 'The desktop menu stays left of centre');
  }
  assert.equal(layout.menuButtons.filter(button => button.pressed === 'true').length, 1, 'Exactly one drink is selected');
  for (const button of layout.menuButtons) {
    const selected = button.id === drink;
    assert.equal(button.pressed, String(selected));
    assert(button.tag === 'BUTTON' && button.type === 'button' && button.tabIndex >= 0, 'Every drink remains keyboard accessible');
    assert(button.receivesInput, 'Menu pills receive their own pointer input');
    assert.equal(button.background, selected ? 'rgb(10, 39, 44)' : layout.cardBackground, 'Selected pill is filled; other pills match the cream card');
    assert.equal(button.ink, selected ? layout.cardBackground : layout.cardInk, 'Pill labels retain readable contrast');
    assert(button.radius >= 16, 'Drink controls use compact cream pills');
  }
  assert.equal(layout.cardName, copy[drink].name);
  assert.equal(layout.cardLine, copy[drink].line, 'The card uses the exact words for this drink');
  assert.equal(layout.cardPointerEvents, 'none', 'The card cannot intercept dragging');
  assert(layout.cardPassesDrag, 'The overlay passes input through to the underlying drag zone');
  assert.equal(layout.cardBackground, 'rgb(240, 235, 224)', 'The card stays cream in light and dark');
  assert.equal(layout.cardInk, 'rgb(10, 39, 44)', 'Cream card text stays readable');
  assert(layout.cardFits && !layout.cardCoversDrink, `The card stays clear of the drink: ${JSON.stringify(layout)}`);
  assert(Math.abs(layout.stage.right - layout.card.right - layout.inset) <= 1 && Math.abs(layout.card.y - layout.stage.y - layout.inset) <= 1, 'The card stays in the top-right corner');
  assert(layout.card.bottom <= layout.stage.bottom, 'The card stays inside the image/header area');
  return layout;
}

export async function checkDrinkMenuKeys(page) {
  await page.focus('[data-drink="skids"]');
  for (const [drink, key] of [['fizzy', 'Space'], ['ground-pinch', 'Enter']]) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.drink), drink, 'Tab reaches the next drink pill');
    await page.keyboard.press(key);
    assert.equal(await page.$eval(`[data-drink="${drink}"]`, button => button.getAttribute('aria-pressed')), 'true', `${key} selects the focused drink`);
    assert.equal(await page.$eval('.drink-spin', button => button.hasAttribute('data-dragging')), false, 'Menu input never starts a spin gesture');
    assert.equal(await frame(page), 0, 'Selecting with the keyboard resets to the front');
  }
  await page.focus('[data-drink="skids"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-showcase]', root => root.dataset.project), 'drinks', 'Menu keys leave the showcase on drinks');
}

export async function dragOverDrink(page, view) {
  const button = await page.$('.drink-spin');
  const box = await button.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const distance = Math.min(80, box.width / 5);
  assert(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.drink-spin'), { x, y }), 'The centre of the drink receives drag input');
  const before = await frame(page);
  if (view.hasTouch) {
    const client = await page.createCDPSession();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - distance, y);
    await page.mouse.up();
  }
  await page.waitForFunction(previous => Number(document.querySelector('.drink-spin').dataset.frame) !== previous, {}, before);
  assert.equal(await page.$eval('[data-showcase]', root => root.dataset.project), 'drinks', 'Dragging the drink leaves the project selected');
}

export async function checkDrinkSpin({ open, views, base, output, report }) {
  for (const view of views) for (const theme of ['light', 'dark']) {
    const { context, page } = await open(view, theme, false);
    await auditDecodedImages(page);
    const requested = new Set();
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.includes('/assets/projects/drinks/')) requested.add(pathname);
    });
    try {
      await page.goto(`${base}/children.html?project=drinks#learner-projects`, { waitUntil: 'networkidle0' });
      await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center' }));
      await page.waitForSelector('.drink-spin[data-frame-count]');
      const count = await page.$eval('.drink-spin', button => Number(button.dataset.frameCount));
      // Render direction from the delivered manifest: -1 (label moves left as frames increase) or 1.
      const dir = await page.evaluate(() => fetch('assets/projects/drinks/skids/manifest.json').then(r => r.json()).then(m => m.dragDirection ?? -1));
      // Wait for the actual requests, allowing final 120-frame renders as well.
      const deadline = Date.now() + 15000;
      while ([...requested].filter(url => /\/skids\/\d{3}\.webp$/.test(url)).length < count && Date.now() < deadline) await wait(50);
      assert.equal([...requested].filter(url => /\/skids\/\d{3}\.webp$/.test(url)).length, count, 'The selected sequence loads completely');
      await page.waitForFunction(() => window.spinStartupRows.length === 90);
      const startup = await page.evaluate(() => ({ rows: window.spinStartupRows, early: window.spinPrematureRotation }));
      assert.deepEqual(startup.early, [], 'The poster remains still until every frame has decoded, including a delayed middle frame');
      assert(startup.rows.every(row => row[3] === count), 'All 120 frames are requested and decoded on activation before the first rotation');
      for (let i = 1; i < startup.rows.length; i++) for (const column of [0, 1]) {
        assert((startup.rows[i][column] - startup.rows[i - 1][column] + count) % count <= 1, 'No frame skips greater than one on consecutive animation frames from the first rotation');
      }
      await page.waitForNetworkIdle({ idleTime: 100 });
      await assertDrinkLayout(page, 'skids');
      assert([...requested].every(url => url.includes('/skids/')), 'Only Skids is requested before a drink switch');
      assert(![...requested].some(url => /\.(mp4|webm)$/.test(url)), 'Drink videos are never requested');
      const button = await page.$('.drink-spin');
      await button.focus();
      const keyDelta = await page.$eval('.drink-spin', button => {
        const before = Number(button.dataset.turns);
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        return Number(button.dataset.turns) - before;
      });
      assert(Math.abs(keyDelta - dir / count) < 1e-9, 'Right arrow rotates exactly one frame with no timing race');
      const afterKey = await turns(page); await wait(80);
      assert(await turns(page) > afterKey, 'Idle spin resumes immediately after a key press');
      const samples = await page.evaluate(() => new Promise(resolve => {
        const rows = [];
        const sample = () => {
          const b = document.querySelector('.drink-spin');
          rows.push([b.dataset.lowerFrame, b.dataset.upperFrame, Number(b.dataset.blend)]);
          if (rows.length === 24) resolve(rows); else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }));
      assert(samples.some((row, i) => i && row[0] === samples[i - 1][0] && row[1] === samples[i - 1][1] && row[2] !== samples[i - 1][2]), 'Adjacent stills crossfade on animation frames between the 7.5 fps source steps');
      assert(samples.some(row => row[2] > .05 && row[2] < .95), 'Intermediate opacity is actually painted');
      for (let i = 1; i < samples.length; i++) for (const column of [0, 1]) {
        assert((Number(samples[i][column]) - Number(samples[i - 1][column]) + count) % count <= 1, 'Idle crossfades never skip a source frame');
      }
      assert.equal(await page.$eval('[data-showcase]', root => root.dataset.project), 'drinks', 'Viewer keys do not navigate the showcase');
      const box = await button.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const start = await frame(page);
      let client;
      if (view.hasTouch) {
        client = await page.createCDPSession();
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 40, y }] });
        await wait(20);
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 80, y }] });
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 40, y);
        await wait(20);
        await page.mouse.move(x - 80, y);
      }
      assert(await page.$eval('.drink-spin', button => button.hasAttribute('data-dragging')), 'Pointer capture keeps the gesture active');
      const dragged = await frame(page);
      const delta = (dragged - start + count) % count;
      const withHand = dir === -1 ? delta : (count - delta) % count;
      assert(withHand > 0 && withHand < count / 2, 'Dragging left turns the label left with the hand');
      if (client) await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      await wait(100);
      assert.notEqual(await frame(page), dragged, 'Flick inertia continues after release');
      const coast = await page.evaluate(() => new Promise(resolve => {
        const rows = [];
        const sample = () => {
          const b = document.querySelector('.drink-spin');
          rows.push([Number(b.dataset.lowerFrame), Number(b.dataset.upperFrame)]);
          if (rows.length === 60) resolve(rows); else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }));
      // Owner: a flick keeps its inertia (it may cover several views per frame) rather than being capped.
      const travelled = coast.slice(1).reduce((sum, row, i) => { const d = (row[0] - coast[i][0] + count) % count; return sum + Math.min(d, count - d); }, 0);
      assert(travelled > 3, 'A fast flick coasts on instead of snapping back');
      await wait(5000);
      const settled = await frame(page);
      await wait(1100);
      assert.notEqual(await frame(page), settled, 'A flick eases back into the idle spin and never stops');
      assert.equal(await page.$('.drink-spin-hint'), null, 'The hint stays absent after interaction');
      assert.equal(await page.$eval('.drink-spin', button => getComputedStyle(button).cursor), 'grab');
      await page.screenshot({ path: path.join(output, `${view.width}x${view.height}-${theme}-spin.png`) });
      // Exercise the real IntersectionObserver while retaining the same viewer.
      await page.evaluate(() => {
        const cell = document.querySelector('.showcase-cell');
        window.spinParent = cell.parentNode;
        window.spinCell = cell;
        window.spinHiddenHost = document.createElement('div');
        window.spinHiddenHost.hidden = true;
        document.body.append(window.spinHiddenHost);
        window.spinHiddenHost.append(cell);
      });
      await page.waitForFunction(() => window.spinCell.querySelector('.drink-spin').dataset.active === 'false');
      const offscreen = await page.evaluate(() => window.spinCell.querySelector('.drink-spin').dataset.frame);
      await wait(400);
      assert.equal(await page.evaluate(() => window.spinCell.querySelector('.drink-spin').dataset.frame), offscreen, 'An off-screen cell freezes');
      await page.evaluate(() => { window.spinParent.append(window.spinCell); window.spinHiddenHost.remove(); window.spinCell.scrollIntoView({ block: 'center' }); });
      await page.waitForFunction(() => document.querySelector('.drink-spin').dataset.active === 'true');
      await page.evaluate(() => {
        window.spinHidden = true;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.spinHidden });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const hidden = await frame(page);
      await wait(400);
      assert.equal(await frame(page), hidden, 'A hidden tab freezes');
      await page.evaluate(() => { window.spinHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      // Reset checks run in the click task, before the next animation frame.
      for (const drink of ['fizzy', 'ground-pinch', 'skids']) {
        const reset = await page.$eval(`[data-drink="${drink}"]`, button => {
          button.click();
          return document.querySelector('.drink-spin').dataset.frame;
        });
        assert.equal(reset, '0', 'Every drink switch resets to the front');
      }
      await page.waitForSelector('.drink-spin[data-ready="true"]');
      // A still pointer release must resume on the next tick, too.
      if (client) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await wait(160);
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(x, y); await page.mouse.down(); await wait(160); await page.mouse.up();
      }
      const afterStill = await turns(page); await wait(80);
      assert(await turns(page) > afterStill, 'A still release resumes immediately');
      // Keep a decoded Skids composition while every Fizzy decode is held.
      await assertDrinkLayout(page, 'skids');
      await page.evaluate(() => { window.spinDecodeHold = 'fizzy'; });
      const carried = await page.evaluate(() => {
        const sources = [...document.querySelectorAll('.drink-spin img')].map(img => img.src);
        document.querySelector('[data-drink="fizzy"]').click();
        return sources;
      });
      await page.waitForFunction(() => window.spinDecodeWaiters.length > 0);
      assert.deepEqual(await page.$$eval('.drink-spin img', imgs => imgs.map(img => img.src)), carried, 'Drink switches hold the last good composition until the new drink decodes');
      await page.evaluate(() => window.releaseSpinDecodes());
      await assertDrinkLayout(page, 'fizzy');
      assert.deepEqual(await page.evaluate(() => window.spinDecodeErrors), [], 'No undecoded, blank or failed image was mounted on any animation frame');
      assert.equal(await page.$('video'), null);
      if (client) await client.detach();
    } finally { await context.close(); }
  }
  const { context, page } = await open(views[0], 'light', true);
  const requested = [];
  page.on('request', request => { if (/\/drinks\/.*\d{3}\.webp/.test(request.url())) requested.push(request.url()); });
  try {
    await page.goto(`${base}/index.html?project=drinks`, { waitUntil: 'networkidle0' });
    await page.$eval('.showcase-cell', cell => cell.scrollIntoView({ block: 'center' }));
    await page.waitForSelector('.drink-spin');
    await wait(300);
    assert.equal(requested.length, 0, 'Reduced motion fetches no frames before manual input');
    assert(posterPath(await page.$eval('.drink-spin img', img => img.src)));
    await page.focus('.drink-spin');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => Number(document.querySelector('.drink-spin').dataset.frame) > 0);
    const manual = await frame(page);
    await wait(400);
    assert.equal(await frame(page), manual, 'Reduced motion has no inertia or automatic animation');
    assert(requested.every(url => url.includes('/skids/')));
  } finally { await context.close(); }
  report.behaviour.push('360 viewer: all 120 frames requested on activation, still poster until every decode (including delayed middle frame), consecutive animation frames skip no more than one view from first rotation; mouse/touch direction and capture, coast to idle, immediate resume, visibility pause, reduced motion, decoded crossfades and drink switches, layout/menu checks');
}
