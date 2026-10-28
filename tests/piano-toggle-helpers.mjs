import assert from 'node:assert/strict';

// Use the emulated device's real input path. Do not dispatch a scripted click:
// a passing test must hit the visible control through the page's actual layers.
export async function activatePianoToggle(page, label = 'Piano toggle') {
  await page.waitForSelector('[data-showcase] #hero-keyboard[data-song]');
  const ids = ['piano-toggle', 'hero-keyboard', 'sky-canvas', 'flock-canvas'];
  const counts = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.querySelectorAll(`[id="${id}"]`).length])), ids);
  for (const id of ids) assert.equal(counts[id], 1, `${label}: #${id} must be unique: ${JSON.stringify(counts)}`);
  const closedBounds = await projectPianoBounds(page);
  await page.$eval('#piano-toggle', button => button.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const before = await page.evaluate(() => {
    const button = document.querySelector('#piano-toggle');
    const panel = document.querySelector('#hero-keyboard');
    const controller = new AbortController();
    const trace = [];
    const describe = element => element && ({ tag: element.tagName, id: element.id, className: element.getAttribute?.('class') });
    const rect = element => {
      const r = element?.getBoundingClientRect();
      return r && { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
    };
    const state = event => ({ event, expanded: button.getAttribute('aria-expanded'), open: panel.classList.contains('is-open'), inert: panel.inert,
      sameButton: button === document.querySelector('#piano-toggle'), samePanel: panel === document.querySelector('#hero-keyboard'),
      scrollY, viewport: { width: innerWidth, height: innerHeight, top: visualViewport?.offsetTop, scale: visualViewport?.scale },
      button: rect(button), panel: rect(panel), hero: rect(button.closest('.living-hero')), header: rect(document.querySelector('body > header')) });
    const sample = event => { if (trace.length < 40) trace.push({ ...state(event.type), target: describe(event.target) }); };
    for (const type of ['pointerdown', 'touchstart', 'click', 'scroll', 'resize']) document.addEventListener(type, sample, { capture: true, passive: true, signal: controller.signal });
    const observer = new MutationObserver(() => { if (trace.length < 40) trace.push(state('mutation')); });
    observer.observe(button, { attributes: true, attributeFilter: ['aria-expanded'] });
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'inert'] });
    window.pianoToggleProbe = { state, trace, stop() { controller.abort(); observer.disconnect(); } };
    const r = button.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { ...state('before'), x, y, hit: describe(hit), clickable: hit === button || button.contains(hit) };
  });
  const expected = before.expanded !== 'true';
  let after;
  try {
    assert(before.clickable, `${label}: control is covered: ${JSON.stringify(before)}`);
    if (page.viewport()?.hasTouch) await page.touchscreen.tap(before.x, before.y);
    else await page.mouse.click(before.x, before.y);
    // Check after both the panel transition and viewport-reveal scroll, rather
    // than accepting a momentary aria-expanded change that immediately closes.
    await new Promise(resolve => setTimeout(resolve, 550));
    after = await page.evaluate(() => ({ ...window.pianoToggleProbe.state('after'), trace: window.pianoToggleProbe.trace }));
    assert.equal(after.expanded, String(expected), `${label}: ${JSON.stringify({ before, after })}`);
    assert.equal(after.open, expected, `${label}: panel class disagrees with the toggle`);
    assert.equal(after.inert, !expected, `${label}: panel inert state disagrees with the toggle`);
    assert(after.sameButton && after.samePanel, `${label}: piano was remounted during activation`);
    const click = after.trace.find(entry => entry.event === 'click');
    assert(click, `${label}: the pointer/tap did not dispatch a click: ${JSON.stringify(after.trace)}`);
    const slot = expected ? await assertProjectPianoFits(page, label, closedBounds) : null;
    return { label, slot, input: page.viewport()?.hasTouch ? 'touch' : 'mouse', ids: counts, before, after };
  } finally {
    await page.evaluate(() => window.pianoToggleProbe?.stop());
  }
}

export async function projectPianoBounds(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#learner-projects #hero-keyboard');
    if (!panel) return null;
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const media = panel.closest('.framework-project-media');
    return { panel: rect(panel), inner: rect(panel.querySelector('.piano-panel-inner')), stage: rect(panel.closest('.showcase-stage')),
      media: rect(media), frame: rect(media.closest('.framework-panels')), headerBottom: document.querySelector('body > header')?.getBoundingClientRect().bottom || 0,
      viewport: { width: innerWidth, height: innerHeight }, scrollY };
  });
}

export async function assertProjectPianoFits(page, label, closed = null) {
  const bounds = await projectPianoBounds(page);
  if (!bounds) return null;
  const { panel, inner, stage, media, viewport, headerBottom } = bounds;
  const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  assert(inside(panel, stage) && inside(panel, media) && inside(inner, panel), `${label}: complete keyboard must fit its media slot: ${JSON.stringify(bounds)}`);
  assert(panel.top >= Math.max(0, headerBottom) && panel.bottom <= viewport.height && panel.left >= 0 && panel.right <= viewport.width,
    `${label}: complete keyboard must stay on screen below the header: ${JSON.stringify(bounds)}`);
  if (closed) for (const element of ['media', 'frame']) for (const dimension of ['width', 'height']) {
    assert(Math.abs(bounds[element][dimension] - closed[element][dimension]) <= 1, `${label}: opening the piano grew the ${element}: ${JSON.stringify({ closed, bounds })}`);
  }
  return bounds;
}
