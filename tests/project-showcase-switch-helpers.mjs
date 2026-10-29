import assert from 'node:assert/strict';

// Sample in the click task itself, at every DOM mutation and before successive
// paints. A waitForSelector after settling would miss the reported flash.
export async function assertImmediateProjectSwitch(page, direction = 'next') {
  const result = await page.evaluate(async direction => {
    const root = document.querySelector('[data-showcase]');
    const ids = root.dataset.showcaseMode === 'auto' ? ['football', 'darty', 'drinks', 'piano'] : ['intro', 'football', 'darty', 'drinks', 'piano'];
    const from = root.dataset.project;
    const expected = ids[(ids.indexOf(from) + (direction === 'next' ? 1 : -1) + ids.length) % ids.length];
    const url = location.href;
    const outgoing = [...root.querySelectorAll('.showcase-stage *, .showcase-piano-control *')];
    const samples = [];
    const visible = element => element?.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) && element.getClientRects().length > 0;
    const sample = phase => {
      const stage = root.querySelector('.showcase-stage');
      const selectedMedia = expected === 'piano' ? stage.querySelector('.world-art')
        : expected === 'intro' ? root.querySelector('[data-project="intro"] .project-intro-image img')
        : expected === 'drinks' ? stage.querySelector('.showcase-drink-screen img')
        : expected === 'darty' ? stage.querySelector('[data-screenshot]') : stage.querySelector('img, iframe:not([hidden])');
      samples.push({ phase, project: root.dataset.project, stale: outgoing.filter(node => node.isConnected).map(node => node.id || node.className || node.tagName),
        outgoingVisible: outgoing.some(node => node.isConnected && visible(node)), incomingVisible: Boolean(visible(selectedMedia)),
        toggle: expected !== 'piano' || Boolean(root.querySelector('#piano-toggle')), url: location.href });
    };
    const observer = new MutationObserver(() => sample('mutation'));
    observer.observe(root, { subtree: true, attributes: true, childList: true });
    try {
      const start = performance.now();
      root.querySelector(`[data-project-${direction}]`).click();
      const duration = performance.now() - start;
      sample('click return');
      for (let frame = 0; frame < 4; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        sample(`frame ${frame}`);
      }
      return { from, expected, url, duration, samples };
    } finally { observer.disconnect(); }
  }, direction);
  const label = `${result.from} → ${result.expected}`;
  for (const sample of result.samples) {
    assert.equal(sample.project, result.expected, `${label}: selection changed again: ${JSON.stringify(sample)}`);
    assert.deepEqual(sample.stale, [], `${label}: outgoing media remains attached after switching starts: ${JSON.stringify(sample)}`);
    assert(!sample.outgoingVisible, `${label}: outgoing media was visible after switching starts`);
    assert(sample.incomingVisible && sample.toggle, `${label}: incoming project must be visible immediately: ${JSON.stringify(sample)}`);
    assert.equal(sample.url, result.url, `${label}: project controls must not navigate`);
  }
  assert(result.duration < 50, `${label}: switch blocked rendering for ${result.duration.toFixed(1)}ms`);
  return result;
}

// Multiple switches in one task deliberately cancel not-yet-mounted pianos and
// newspapers. An old deferred callback must never overwrite the final choice.
export async function assertRapidProjectSwitches(page) {
  const result = await page.evaluate(async () => {
    const root = document.querySelector('[data-showcase]');
    const ids = root.dataset.showcaseMode === 'auto' ? ['football', 'darty', 'drinks', 'piano'] : ['intro', 'football', 'darty', 'drinks', 'piano'];
    const trace = [];
    for (let i = 0; i < ids.length * 3; i++) {
      const from = root.dataset.project;
      const outgoing = [...root.querySelectorAll('.showcase-stage *, .showcase-piano-control *')];
      root.querySelector('[data-project-next]').click();
      const expected = ids[(ids.indexOf(from) + 1) % ids.length];
      trace.push({ expected, actual: root.dataset.project, stale: outgoing.some(node => node.isConnected),
        piano: Boolean(root.querySelector('.showcase-stage .world-art')) });
    }
    const expected = root.dataset.project;
    for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    return { trace, expected, actual: root.dataset.project,
      skyCount: root.querySelectorAll('#sky-canvas').length, iframeCount: root.querySelectorAll('iframe').length,
      pianoReady: Boolean(root.querySelector('#hero-keyboard[data-song]')) };
  });
  for (const step of result.trace) {
    assert.equal(step.actual, step.expected, 'Rapid switching must select the incoming project synchronously');
    assert(!step.stale, 'Rapid switching must detach all outgoing media in the switch task');
    assert.equal(step.piano, step.expected === 'piano', 'Rapid switching must show real piano markup only for the piano');
  }
  assert.equal(result.actual, result.expected, 'Cancelled mounts cannot change the final selection');
  assert.equal(result.skyCount, Number(result.expected === 'piano'));
  assert.equal(result.iframeCount, Number(result.expected === 'football'));
  assert.equal(result.pianoReady, result.expected === 'piano', 'Only the final piano mount may activate');
  return result;
}
