// Real controller and loader, with a deterministic clock and a small DOM adapter.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const source = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const { spinMotion, frameAt, frameBlend, progressiveFrames, createDrinkSpin, renderDrinkInfo, prefetchDrink } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function fakeClock(frameDelay = 16) {
  let time = 0;
  let nextId = 0;
  const tasks = new Map();
  const clock = {
    Date: { now: () => time },
    setTimeout(fn, ms) { const id = ++nextId; tasks.set(id, { at: time + ms, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    requestAnimationFrame(fn) { return clock.setTimeout(() => fn(time), frameDelay); },
    cancelAnimationFrame(id) { tasks.delete(id); },
    tick(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      time = end;
    },
    pending: () => tasks.size,
  };
  return clock;
}
const clock = fakeClock();
const motion = spinMotion({ clock, draw() {} });
motion.setActive(true);
clock.tick(16000);
assert(Math.abs(motion.state.turns - 1) < 1e-9, 'Exactly one revolution in 16 seconds (clockwise)');
const atHold = motion.state.turns;
motion.begin();
clock.tick(22000);
assert.equal(motion.state.turns, atHold, 'A held pointer stops auto rotation, even after 20 seconds');
motion.end(true);
motion.begin();
clock.tick(16);
motion.drag(.125);
assert.equal(frameAt(motion.state.turns, 72), 9);
assert.equal(frameAt(motion.state.turns, 120), 15, 'The same drag angle works with the final 120 frames');
motion.end();
const released = motion.state.turns;
clock.tick(160);
assert(motion.state.turns > released, 'A flick continues in the drag direction');
clock.tick(4740);
const late = motion.state.turns;
clock.tick(100);
assert(motion.state.turns > late, 'A flick with the usual direction eases back into it, never stopping');
assert.equal(motion.state.velocity, 0, 'The flick has eased into the idle spin');
const settled = motion.state.turns;
clock.tick(1600);
assert(Math.abs(motion.state.turns - settled - .1) < .002, 'Carries straight on at the slow idle speed, with no six-second pause');
motion.step(-1 / 72);
const keyed = motion.state.turns;
clock.tick(16);
assert(motion.state.turns > keyed, 'Keyboard rotation resumes on the next animation frame');
motion.begin();
clock.tick(500);
motion.end();
const stillRelease = motion.state.turns;
clock.tick(16);
assert(motion.state.turns > stillRelease, 'A still release resumes immediately');
for (const reason of ['hidden', 'off-screen', 'other project']) {
  motion.setActive(false);
  const paused = motion.state.turns;
  clock.tick(32000);
  assert.equal(motion.state.turns, paused, `${reason}: frozen angle`);
  assert.equal(clock.pending(), 0, `${reason}: no animation or idle work`);
  motion.setActive(true);
  clock.tick(1616);
  assert(motion.state.turns > paused && motion.state.turns - paused < .102, `${reason}: no catch-up jump`);
}
motion.begin();
motion.drag(.05);
motion.end(true);
assert.equal(motion.state.velocity, 0, 'Cancelled gestures cannot start inertia');
motion.destroy();
assert.equal(clock.pending(), 0, 'Disposal cancels all scheduled work');
const reducedClock = fakeClock();
const reduced = spinMotion({ clock: reducedClock, reduced: true, draw() {} });
reduced.setActive(true);
reducedClock.tick(32000);
assert.equal(reduced.state.turns, 0);
assert.equal(reducedClock.pending(), 0, 'Reduced motion schedules nothing');
reduced.begin();
reduced.drag(-.1);
reduced.end();
const manual = reduced.state.turns;
reducedClock.tick(32000);
assert.equal(reduced.state.turns, manual, 'Reduced motion permits manual rotation without inertia or auto rotation');
assert.equal(frameAt(-1 / 72, 72), 71, 'Frame wrapping is seamless in reverse');
const slowClock = fakeClock(1000);
const slow = spinMotion({ clock: slowClock, maxStep: () => (1 - 1e-9) / 120, draw() {} });
slow.setActive(true);
for (let i = 0; i < 5; i++) {
  const before = slow.state.turns;
  slowClock.tick(1000);
  assert(slow.state.turns > before && slow.state.turns - before <= 1 / 120, 'A delayed animation tick cannot skip a view');
}
slow.destroy();
const flickClock = fakeClock();
const flick = spinMotion({ clock: flickClock, maxStep: () => (1 - 1e-9) / 360, draw() {} });
flick.setActive(true); flick.begin(); flickClock.tick(16); flick.drag(.1); flick.end();
const flickStart = flick.state.turns; flickClock.tick(160);
assert(flick.state.turns - flickStart > 3 / 360, 'The idle step cap never limits a flick');
flick.destroy();
for (const count of [2, 71, 72, 120, 360]) {
  const order = progressiveFrames(count);
  assert.equal(new Set(order).size, count);
  const indices = Array.from({ length: count }, (_, i) => i);
  assert.deepEqual(order, [...indices.filter(i => i % 4 === 0), ...indices.filter(i => i % 4 === 2), ...indices.filter(i => i % 2 === 1)], 'Coarse quarter, half, then full resolution');
}
for (const [turns, lower, upper, mix] of [[.15, 1, 2, .5], [-.025, 9, 0, .75], [1, 0, 1, 0]]) {
  const blend = frameBlend(turns, 10);
  assert.equal(blend.lower, lower); assert.equal(blend.upper, upper);
  assert(Math.abs(blend.mix - mix) < 1e-9);
}
class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag; this.dataset = {}; this.style = {}; this.attributes = new Map(); this.children = []; this.captured = new Set(); }
  set src(value) { this.attributes.set('src', value); }
  get src() { return this.attributes.get('src'); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) {
    assert(children.every(child => child.tagName !== 'img' || child.decoded), 'Never mount an undecoded image');
    this.children = children;
  }
  getBoundingClientRect() { return { width: 600 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.dispatchEvent(event('lostpointercapture', { pointerId: id })); }
}
const event = (type, props) => Object.assign(new Event(type, { cancelable: true }), props);
const globals = Object.fromEntries(['document', 'window', 'Image', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const images = [], requests = [];
let cachedDecodes = false;
let manifestData = { frameCount: 12, dragDirection: -1 };
const file = img => img.src?.split('/').pop().split('?')[0];
const index = img => Number(file(img)?.slice(0, 3));
const pendingFrames = () => images.filter(img => img.src && !img.settled && /^\d{3}\.webp$/.test(file(img)));
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const loadBatch = async clock => { clock.tick(17); await flush(); };
async function complete(clock, count = manifestData.frameCount, start = 0, concurrency = 6) {
  for (let round = 0; round < 400; round++) {
    await loadBatch(clock);
    const batch = pendingFrames();
    assert(batch.length <= concurrency, `At most ${concurrency} concurrent fetch/decode jobs`);
    batch.forEach(img => img.resolve()); await flush();
    const decoded = images.slice(start).filter(img => img.decoded && /^\d{3}\.webp$/.test(file(img)));
    if (decoded.length === count) return;
  }
  assert.fail('Preload queue did not drain');
}
try {
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.window = new EventTarget();
  globalThis.Image = class extends Element {
    constructor() { super('img'); images.push(this); }
    decode() {
      if (cachedDecodes) { this.decoded = this.settled = true; return Promise.resolve(); }
      return new Promise((resolve, reject) => { this.accept = resolve; this.reject = reject; });
    }
    resolve() { this.decoded = this.settled = true; this.accept?.(); }
    fail() { this.settled = true; this.reject?.(Error('decode failed')); }
  };
  const fetchManifest = async (url, options) => { requests.push({ url, ...options }); return { ok: true, json: async () => manifestData }; };
  globalThis.fetch = fetchManifest;
  const card = new Element();
  for (const [name, line] of [['Skids', "When you're in a rush, have some Skids."], ['Fizzy', 'Light, bright red. Fizzy Extreme.'], ['Ground Pinch', 'It’s sweet, fast, cheap, and will help you destroy your enemies.']]) {
    renderDrinkInfo(card, { name, lines: [line] });
    assert.equal(card.children[0].textContent, name); assert.equal(card.children[1].textContent, line);
    assert.equal(card.getAttribute('aria-live'), 'polite'); assert.equal(card.getAttribute('aria-atomic'), 'true');
  }
  const screen = new Element(), domClock = fakeClock();
  let activity = 0;
  const viewer = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock, activity: () => activity++ });
  const button = screen.children[0];
  assert.equal(button.children.length, 0, 'Wait for poster decode');
  images[0].resolve(); await flush();
  viewer.setActive(true); await flush();
  assert.equal(requests.length, 0, 'No manifest or frame loading in the switch task');
  await loadBatch(domClock);
  assert.deepEqual(pendingFrames().map(file), ['000.webp', '004.webp', '008.webp']);
  pendingFrames().slice(0, 2).forEach(img => img.resolve()); await flush();
  await loadBatch(domClock);
  assert.equal(images.length, 4, 'A pending coarse decode holds back finer requests');
  domClock.tick(1000);
  assert.equal(file(button.children[0]), 'poster.webp', 'Poster stays still until the whole coarse set decodes');
  assert.equal(Number(button.dataset.turns || 0), 0);
  pendingFrames()[0].resolve(); await flush();
  assert.equal(button.dataset.ready, 'true', 'The coarse quarter alone starts automatic rotation');
  assert.equal(Number(button.dataset.turns), 0, 'Loading never advances the motion clock');
  await loadBatch(domClock);
  assert.deepEqual(pendingFrames().map(file), ['002.webp', '006.webp', '010.webp']);
  assert(Number(button.dataset.turns) > 0, 'Automatic motion runs while finer frames are undecoded');
  assert.equal(button.dataset.lowerFrame, '0'); assert.equal(button.dataset.upperFrame, '4');
  assert(Number(button.dataset.blend) > 0 && Number(button.dataset.blend) < 1, 'Crossfade spans the nearest decoded neighbours');
  assert.equal(button.children[0].style.opacity, '1', 'Opaque bottom prevents background bleeding');
  const angle = button.dataset.turns;
  pendingFrames()[0].resolve(); await flush();
  assert.equal(button.dataset.turns, angle, 'A finer decode does not reset the angle');
  assert.equal(button.dataset.upperFrame, '2', 'Finer views slot into the decoded bracket');
  assert.equal(button.dataset.frame, '0', 'Frame metadata also names a decoded view');
  await complete(domClock);
  assert.equal(images.length, 13);
  button.dispatchEvent(event('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 300 }));
  assert(button.hasPointerCapture(1) && viewer.isDragging());
  domClock.tick(16);
  const start = Number(button.dataset.turns);
  button.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 250 }));
  assert(Math.abs(Number(button.dataset.turns) - start - 0.6 * 50 / 600) < 1e-9, 'Owner drag gain 0.6 and direction -1');
  const dragged = button.dataset.turns;
  button.dispatchEvent(event('pointermove', { pointerId: 2, clientX: 50 }));
  assert.equal(button.dataset.turns, dragged, 'Other pointers cannot take over');
  button.dispatchEvent(event('pointerup', { pointerId: 1 }));
  domClock.tick(160); assert(Number(button.dataset.turns) > Number(dragged), 'A flick coasts freely');
  domClock.tick(6000);
  const beforeKey = Number(button.dataset.turns);
  const key = event('keydown', { key: 'ArrowRight' }); button.dispatchEvent(key);
  assert(key.defaultPrevented && Math.abs(Number(button.dataset.turns) - beforeKey + 1 / 12) < 1e-9);
  const keyed = Number(button.dataset.turns); domClock.tick(16);
  assert(Number(button.dataset.turns) > keyed && activity >= 3);
  viewer.setActive(false);
  const still = button.dataset.turns; domClock.tick(32000);
  assert.equal(button.dataset.turns, still); assert.equal(domClock.pending(), 0);
  const lastGood = [...button.children]; viewer.destroy();
  const preview = new Element('img'); preview.decoded = true;
  screen.replaceChildren(preview, button);
  const fizzyStart = images.length;
  const fizzy = createDrinkSpin(screen, { id: 'fizzy', name: 'Fizzy' }, { clock: domClock, reduced: true });
  const fizzButton = screen.children[0]; fizzy.setActive(true);
  assert.deepEqual(fizzButton.children, lastGood, 'Switching drinks preserves the last decoded composition');
  images.at(-1).resolve(); await flush(); await loadBatch(domClock);
  assert.equal(images.length, fizzyStart + 1, 'Reduced motion only fetches the poster');
  fizzButton.dispatchEvent(event('keydown', { key: 'ArrowRight' })); await flush();
  assert.deepEqual(pendingFrames().map(index), [0, 4, 8], 'New drinks begin with the coarse set, even for manual input');
  pendingFrames().filter(img => [0, 8].includes(index(img))).forEach(img => img.resolve()); await flush();
  assert.equal(fizzButton.dataset.lowerFrame, '8'); assert.equal(fizzButton.dataset.upperFrame, '0', 'Decoded brackets wrap across the seam');
  assert(Math.abs(Number(fizzButton.dataset.blend) - .75) < 1e-9);
  assert.equal(fizzButton.dataset.ready, 'false', 'Manual input works before the coarse set is complete');
  await complete(domClock, 12, fizzyStart);
  const manual = fizzButton.dataset.turns; domClock.tick(32000);
  assert.equal(fizzButton.dataset.turns, manual, 'Reduced motion has no automatic animation or inertia');
  fizzy.destroy();
  // A held first gesture records its angle before the manifest and updates on decode.
  for (const reducedMotion of [false, true]) {
    const dragClock = fakeClock();
    const dragViewer = createDrinkSpin(screen, { id: 'fizzy', name: 'Fizzy' }, { clock: dragClock, reduced: reducedMotion });
    const dragButton = screen.children[0]; images.at(-1).resolve(); await flush(); dragViewer.setActive(true);
    dragButton.dispatchEvent(event('pointerdown', { pointerId: 8, isPrimary: true, button: 0, clientX: 300 }));
    dragButton.dispatchEvent(event('pointermove', { pointerId: 8, clientX: 200 }));
    assert(Math.abs(Number(dragButton.dataset.turns) - .1) < 1e-9);
    await flush(); assert.equal(file(dragButton.children[0]), 'poster.webp');
    pendingFrames().slice(0, 2).forEach(img => img.resolve()); await flush();
    assert.equal(dragButton.dataset.lowerFrame, '0'); assert.equal(dragButton.dataset.upperFrame, '4');
    assert(Math.abs(Number(dragButton.dataset.blend) - .3) < 1e-9);
    assert(dragViewer.isDragging() && dragButton.dataset.ready === 'false');
    dragButton.releasePointerCapture(8); assert(!dragViewer.isDragging());
    const heldAngle = dragButton.dataset.turns; dragClock.tick(1000);
    assert.equal(dragButton.dataset.turns, heldAngle, 'Release cannot start idle before coarse decode');
    dragViewer.destroy(); assert.equal(dragClock.pending(), 0);
  }
  // Cancellation, failed-frame retry and a late manifest cannot mutate a replacement.
  const partial = createDrinkSpin(screen, { id: 'ground-pinch', name: 'Ground Pinch' }, { clock: domClock });
  images.at(-1).resolve(); await flush(); partial.setActive(true); await loadBatch(domClock);
  const cancelled = pendingFrames(); partial.setActive(false);
  assert(cancelled.every(img => !img.src)); cancelled.forEach(img => img.resolve()); await flush();
  partial.setActive(true); await loadBatch(domClock);
  const retry = pendingFrames()[0]; retry.fail();
  pendingFrames().forEach(img => img.resolve()); await flush();
  await loadBatch(domClock);
  while (pendingFrames().length) { pendingFrames().forEach(img => img.resolve()); await flush(); await loadBatch(domClock); }
  assert.equal(screen.children[0].dataset.ready, 'false', 'A failed coarse view cannot pass the startup gate');
  partial.setActive(false); partial.setActive(true); await loadBatch(domClock);
  assert.equal(pendingFrames().length, 1, 'Reactivation retains good decodes and retries the failed frame');
  pendingFrames()[0].resolve(); await flush();
  assert.equal(screen.children[0].dataset.ready, 'true'); partial.destroy();
  let deliver, lateSignal;
  globalThis.fetch = (url, options) => { lateSignal = options.signal; return new Promise(resolve => { deliver = resolve; }); };
  // A fresh clock: drinks already seen on domClock keep their decoded sequence for the visit.
  const lateClock = fakeClock();
  const late = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: lateClock }); late.setActive(true); await loadBatch(lateClock);
  const beforeLate = images.length; const latePoster = images.at(-1); late.destroy();
  assert(lateSignal.aborted); latePoster.resolve();
  deliver({ ok: true, json: async () => ({ frameCount: 360 }) }); await flush();
  assert.equal(images.length, beforeLate); globalThis.fetch = fetchManifest;
  // Cached foreground batches yield, and the 12th decode starts a full 360 turn.
  manifestData = { frameCount: 360, dragDirection: -1 }; cachedDecodes = true;
  for (const idle of [false, true]) {
    const batchClock = fakeClock();
    if (idle) { batchClock.requestIdleCallback = fn => batchClock.setTimeout(fn, 1); batchClock.cancelIdleCallback = id => batchClock.clearTimeout(id); }
    const before = images.length, beforeRequests = requests.length;
    const cached = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: batchClock });
    const cachedButton = screen.children[0]; await flush(); cached.setActive(true); await flush();
    assert.equal(requests.length, beforeRequests, 'Cached startup still yields past activation');
    if (idle) batchClock.tick(16);
    cached.setActive(false); batchClock.tick(100); await flush();
    assert.equal(requests.length, beforeRequests, 'Pausing cancels deferred startup');
    cached.setActive(true);
    for (let frames = 6; frames <= 360; frames += 6) {
      batchClock.tick(17); await flush();
      assert.equal(images.length - before - 1, frames, 'Only six cached decodes per paint/idle batch');
      assert.equal(cachedButton.dataset.ready, String(frames >= 12), 'The turn starts once the first two seconds of views decode');
      if (frames < 12) assert.equal(file(cachedButton.children[0]), 'poster.webp');
    }
    const loadedOrder = images.slice(before + 1).map(index);
    assert.deepEqual(loadedOrder, progressiveFrames(360));
    let previous = Number(cachedButton.dataset.frame);
    for (let tick = 0; tick < 1010; tick++) {
      batchClock.tick(16);
      const next = Number(cachedButton.dataset.frame);
      assert((next - previous + 360) % 360 <= 1, 'Full-resolution idle never skips a source view, including the seam'); previous = next;
    }
    cached.destroy(); assert.equal(batchClock.pending(), 0);
  }
  cachedDecodes = false;
  // Warm-up runs only near the viewport (caller activation), after paint and idle.
  for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
    const skipClock = fakeClock(), before = requests.length;
    prefetchDrink({ id: 'skids' }, { clock: skipClock, connection }).setActive(true);
    skipClock.tick(1000); await flush();
    assert.equal(requests.length, before, 'Save-Data and 2G skip speculative loading'); assert.equal(skipClock.pending(), 0);
  }
  for (const idle of [false, true]) {
    const warmClock = fakeClock(); let idleCalls = 0;
    if (idle) { warmClock.requestIdleCallback = fn => { idleCalls++; return warmClock.setTimeout(fn, 1); }; warmClock.cancelIdleCallback = id => warmClock.clearTimeout(id); }
    const before = images.length, beforeRequests = requests.length;
    const warm = prefetchDrink({ id: 'skids' }, { clock: warmClock, connection: { effectiveType: '4g' } });
    warmClock.tick(1000); assert.equal(requests.length, beforeRequests, 'Far-away showcase does not prefetch');
    warm.setActive(true); warmClock.tick(32); await flush();
    assert.equal(requests.length, beforeRequests, 'Prefetch waits until after first paint');
    await complete(warmClock, 90, before, 3);
    assert.equal(images.length - before, 90, 'Background warm-up fetches exactly the coarse quarter');
    assert(images.slice(before).every(img => index(img) % 4 === 0 && img.decoding === 'sync' && img.fetchPriority === 'low'));
    assert.equal(requests.at(-1).priority, 'low'); if (idle) assert(idleCalls > 0);
    warmClock.tick(1000); await flush(); assert.equal(images.length - before, 90, 'Background work never fills finer frames');
    const warmViewer = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: warmClock });
    const warmButton = screen.children[0]; warmViewer.setActive(true);
    assert.equal(requests.length, beforeRequests + 1, 'Switch reuses the prefetched manifest');
    assert.equal(warmButton.dataset.ready, 'true', 'Decoded coarse set is immediately available on selection');
    assert(warmButton.children.every(img => img.decoded));
    warm.setActive(false); await loadBatch(warmClock);
    assert(pendingFrames().every(img => index(img) % 4 === 2), 'Warm-up handoff continues with the half set');
    assert.equal(pendingFrames().length, 6, 'Claimed viewer continues loading independently of prefetch activation');
    warmViewer.destroy(); assert.equal(warmClock.pending(), 0);
  }
  // A partially warmed sequence transfers cancellation to the inactive viewer.
  const handoffClock = fakeClock(), beforeHandoff = images.length;
  const warming = prefetchDrink({ id: 'skids' }, { clock: handoffClock }); warming.setActive(true);
  handoffClock.tick(48); await flush(); assert.equal(pendingFrames().length, 3);
  const handoffImages = pendingFrames(); handoffImages[0].resolve(); await flush();
  const inactive = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: handoffClock });
  warming.setActive(false); handoffClock.tick(1000); await flush();
  assert(handoffImages.slice(1).every(img => !img.src), 'Claiming a warm-up stops pending work until viewer activation');
  assert.equal(images.length, beforeHandoff + 4);
  inactive.setActive(true); await loadBatch(handoffClock);
  assert(!pendingFrames().some(img => index(img) === 0), 'The handoff retains successfully decoded coarse views');
  inactive.destroy(); assert.equal(handoffClock.pending(), 0);
  assert(images.filter(img => img.src).every(img => img.fetchPriority === 'low' && img.decoding === 'sync'));
} finally {
  for (const [key, descriptor] of Object.entries(globals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
function webpSize(bytes) {
  for (let offset = 12; offset < bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8 ') return [bytes.readUInt16LE(data + 6) & 0x3fff, bytes.readUInt16LE(data + 8) & 0x3fff];
    if (type === 'VP8L') {
      const size = bytes.readUInt32LE(data + 1);
      return [(size & 0x3fff) + 1, ((size >>> 14) & 0x3fff) + 1];
    }
    if (type === 'VP8X') return [bytes.readUIntLE(data + 4, 3) + 1, bytes.readUIntLE(data + 7, 3) + 1];
    offset = data + length + (length % 2);
  }
  throw new Error('Missing WebP dimensions');
}
for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
  const directory = new URL(`../assets/projects/drinks/${drink}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  assert(Number.isInteger(manifest.frameCount) && manifest.frameCount >= 2);
  assert([1200, 1600].includes(manifest.width) && manifest.width * 3 === manifest.height * 4, `${drink}: 4:3 framing for current assets or the new 1600×1200 export`);
  const files = await readdir(directory);
  assert.equal(files.filter(file => /^\d{3}\.webp$/.test(file)).length, manifest.frameCount, `${drink}: manifest matches the complete turn`);
  const poster = await readFile(new URL('poster.webp', directory));
  assert.deepEqual(poster, await readFile(new URL('000.webp', directory)), `${drink}: poster is frame zero`);
  for (let i = 0; i < manifest.frameCount; i++) {
    const frame = await readFile(new URL(`${String(i).padStart(3, '0')}.webp`, directory));
    assert.equal(frame.toString('ascii', 0, 4), 'RIFF');
    assert.equal(frame.toString('ascii', 8, 12), 'WEBP');
    assert.deepEqual(webpSize(frame), [manifest.width, manifest.height], `${drink}/${i}: actual dimensions match the manifest`);
  }
}
console.log('Drink spin checks passed: progressive 90/180/360 startup, decoded-only wrapped crossfades, idle prefetch and handoff, Save-Data/2G, bounded concurrency, cancellation, 16-second clockwise idle, free coasting, drag gain/direction, visibility, reduced motion and complete assets.');
