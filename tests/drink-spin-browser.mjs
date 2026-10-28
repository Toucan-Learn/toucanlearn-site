// Browser integration is run by Claude through check-shared-showcase.sh.
import assert from 'node:assert/strict';
import path from 'node:path';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = page => page.$eval('.drink-spin', button => Number(button.dataset.frame));
const copy = {
  skids: { name: 'Skids', line: "When you're in a rush, have some Skids." },
  fizzy: { name: 'Fizzy', line: 'Light, bright red. · Fizzy, extreme.' },
  'ground-pinch': { name: 'Ground Pinch', line: 'Designed for everyone.' },
};

export async function assertDrinkLayout(page, drink) {
  await page.waitForFunction(() => {
    const image = document.querySelector('.drink-spin img');
    return image?.complete && image.naturalWidth > 0;
  });
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
    return { screen: s, stage: rect(stage), image: rect(image), controls: rect(controls), caption: rect(caption), card: c,
      painted, fit: getComputedStyle(image).objectFit, position: getComputedStyle(image).objectPosition,
      backgrounds: [stage, screen, stage.querySelector('.showcase-drinks')].map(node => getComputedStyle(node).backgroundColor),
      buttons: [...controls.querySelectorAll('button')].map(rect),
      inset: parseFloat(getComputedStyle(caption).paddingLeft),
      cardName: card.querySelector('strong').textContent, cardLine: card.querySelector('p').textContent,
      cardBackground: getComputedStyle(card).backgroundColor, cardInk: getComputedStyle(card).color,
      cardPointerEvents: getComputedStyle(card).pointerEvents,
      cardPassesDrag: c.y + c.height / 2 < s.y || document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2)?.closest('.drink-spin') === document.querySelector('.drink-spin'),
      cardFits: card.scrollWidth <= card.clientWidth + 1 && card.scrollHeight <= card.clientHeight + 1,
      cardCoversDrink: c.x < subject.right && c.right > subject.x && c.y < subject.bottom && c.bottom > subject.y,
    };
  });
  assert.equal(layout.fit, 'cover', 'Drink frames cover the available image slot');
  assert.equal(layout.position, '50% 50%', 'The drink stays centred');
  assert(layout.painted.width >= layout.screen.width - 1 && layout.painted.height >= layout.screen.height - 1, 'No uncovered image edges');
  for (const edge of ['x', 'y', 'width', 'height']) assert(Math.abs(layout.image[edge] - layout.screen[edge]) <= 1, `Image fills the drag zone: ${edge}`);
  for (const edge of ['x', 'right']) assert(Math.abs(layout.screen[edge] - layout.stage[edge]) <= 1, 'The drink fills the slot edge to edge');
  assert.deepEqual(layout.backgrounds, Array(3).fill('rgb(31, 122, 117)'), 'Teal stays behind the poster and loading frames');
  assert(Math.abs(layout.controls.bottom - layout.stage.bottom) <= 1 && Math.abs(layout.controls.bottom - layout.caption.y) <= 1, 'The switch row sits against the caption edge');
  assert(Math.abs(layout.controls.y - layout.screen.bottom) <= 1, 'The switch never floats over the image');
  assert(Math.abs(layout.buttons[0].x - layout.stage.x - layout.inset) <= 1 && Math.abs(layout.stage.right - layout.buttons.at(-1).right - layout.inset) <= 1, 'Switch and caption use the same side inset');
  assert(layout.buttons.every(button => Math.abs(button.y - layout.buttons[0].y) <= 1 && Math.abs(button.height - layout.buttons[0].height) <= 1), 'All three drink buttons share one row');
  assert.equal(layout.cardName, copy[drink].name);
  assert.equal(layout.cardLine, copy[drink].line, 'The card uses the exact words for this drink');
  assert.equal(layout.cardPointerEvents, 'none', 'The card cannot intercept dragging');
  assert(layout.cardPassesDrag, 'The overlay passes input through to the underlying drag zone');
  assert.equal(layout.cardBackground, 'rgb(240, 235, 224)', 'The card stays cream in light and dark');
  assert.equal(layout.cardInk, 'rgb(10, 39, 44)', 'Cream card text stays readable');
  assert(layout.cardFits && !layout.cardCoversDrink, `The card stays clear of the drink: ${JSON.stringify(layout)}`);
  assert(Math.abs(layout.stage.right - layout.card.right - layout.inset) <= 1 && Math.abs(layout.card.y - layout.stage.y - layout.inset) <= 1, 'The card stays in the top-right corner');
  assert(layout.card.bottom < layout.controls.y, 'The card stays inside the image/header area');
  return layout;
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
      // Wait for the actual requests, allowing final 120-frame renders as well.
      const deadline = Date.now() + 15000;
      while ([...requested].filter(url => /\/skids\/\d{3}\.webp$/.test(url)).length < count && Date.now() < deadline) await wait(50);
      assert.equal([...requested].filter(url => /\/skids\/\d{3}\.webp$/.test(url)).length, count, 'The selected sequence loads completely');
      await page.waitForNetworkIdle({ idleTime: 100 });
      await assertDrinkLayout(page, 'skids');
      assert([...requested].every(url => url.includes('/skids/')), 'Only Skids is requested before a drink switch');
      assert(![...requested].some(url => /\.(mp4|webm)$/.test(url)), 'Drink videos are never requested');
      const button = await page.$('.drink-spin');
      await button.focus();
      await page.keyboard.press('ArrowLeft'); // Stops auto rotation for the manual assertions.
      const beforeKey = await frame(page);
      await page.keyboard.press('ArrowRight');
      assert.equal(await frame(page), (beforeKey + count - 1) % count, 'Right arrow rotates one frame to the right');
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
      assert(delta > 0 && delta < count / 2, 'Dragging left advances the clockwise turn');
      if (client) await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      await wait(100);
      assert.notEqual(await frame(page), dragged, 'Flick inertia continues after release');
      await wait(2700);
      const settled = await frame(page);
      await wait(300);
      assert.equal(await frame(page), settled, 'Inertia settles before the six-second auto-resume');
      assert.equal(await page.$eval('.drink-spin-hint', hint => getComputedStyle(hint).opacity), '0', 'The hint fades after interaction');
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
    assert((await page.$eval('.drink-spin img', img => img.src)).endsWith('/poster.webp'));
    await page.focus('.drink-spin');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => Number(document.querySelector('.drink-spin').dataset.frame) > 0);
    const manual = await frame(page);
    await wait(400);
    assert.equal(await frame(page), manual, 'Reduced motion has no inertia or automatic animation');
    assert(requested.every(url => url.includes('/skids/')));
  } finally { await context.close(); }
  report.behaviour.push('360 viewer: mouse/touch drag direction and capture, keyboard, inertia settle, off-screen/tab pause, visible-only loading, front resets, reduced motion; edge-to-edge cover, teal loading background, bottom-aligned switch and exact unobstructed cards on both routes; exact speed and idle delays checked with a test clock');
}
