// Real controller and loader, with a deterministic clock and a small DOM adapter.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const source = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const { spinMotion, frameAt, progressiveFrames, createDrinkSpin, renderDrinkInfo } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function fakeClock() {
  let time = 0;
  let nextId = 0;
  const tasks = new Map();
  const clock = {
    Date: { now: () => time },
    setTimeout(fn, ms) { const id = ++nextId; tasks.set(id, { at: time + ms, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    requestAnimationFrame(fn) { return clock.setTimeout(() => fn(time), 16); },
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
assert(Math.abs(motion.state.turns - 1) < 1e-9, 'Exactly one revolution in 16 seconds');
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
clock.tick(2640);
assert.equal(motion.state.velocity, 0, 'Inertia settles before automatic rotation resumes');
const settled = motion.state.turns;
clock.tick(3199);
assert.equal(motion.state.turns, settled, 'Auto rotation waits six seconds after release');
clock.tick(1601);
assert(Math.abs(motion.state.turns - settled - .1) < .002, 'Resumes at the slow speed after six seconds');
motion.step(-1 / 72);
const keyed = motion.state.turns;
clock.tick(5999);
assert.equal(motion.state.turns, keyed, 'Keyboard rotation also postpones auto rotation');
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
for (const count of [2, 71, 72, 120]) {
  const order = progressiveFrames(count);
  assert.equal(new Set(order).size, count);
  assert.deepEqual(order.slice(0, Math.ceil(count / 4)), Array.from({ length: Math.ceil(count / 4) }, (_, i) => i * 4));
}

class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag; this.dataset = {}; this.attributes = new Map(); this.children = []; this.captured = new Set(); }
  set src(value) { this.attributes.set('src', value); }
  get src() { return this.attributes.get('src'); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  getBoundingClientRect() { return { width: 600 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.dispatchEvent(event('lostpointercapture', { pointerId: id })); }
}
const event = (type, props) => Object.assign(new Event(type, { cancelable: true }), props);
const globals = Object.fromEntries(['document', 'window', 'Image', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const images = [];
const requests = [];
let manifestData = { frameCount: 12, dragDirection: -1 };
try {
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.window = new EventTarget();
  const card = new Element();
  for (const [name, lines, text] of [
    ['Skids', ["When you're in a rush, have some Skids."], "When you're in a rush, have some Skids."],
    ['Fizzy', ['Light, bright red.', 'Fizzy, extreme.'], 'Light, bright red. · Fizzy, extreme.'],
    ['Ground Pinch', ['Designed for everyone.'], 'Designed for everyone.'],
  ]) {
    renderDrinkInfo(card, { name, lines });
    assert.equal(card.className, 'drink-info');
    assert.equal(card.children.length, 2, 'Switching replaces the previous card copy');
    assert.equal(card.children[0].textContent, name);
    assert.equal(card.children[1].textContent, text);
    assert.equal(card.getAttribute('aria-live'), 'polite');
  }
  globalThis.Image = class extends Element {
    constructor() { super('img'); images.push(this); }
    resolve() { this.onload?.(); }
  };
  globalThis.fetch = async (url, options) => { requests.push({ url, signal: options.signal }); return { ok: true, json: async () => manifestData }; };
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const complete = () => { for (let i = 0; i < images.length; i++) if (images[i].src) images[i].resolve(); };
  const screen = new Element();
  const domClock = fakeClock();
  let activity = 0;
  const viewer = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock, activity: () => activity++ });
  const button = screen.children[0];
  assert.equal(button.children[0].src, 'assets/projects/drinks/skids/poster.webp', 'Poster is the first paint');
  assert.equal(button.getAttribute('aria-label'), 'Rotate Skids, 360° view');
  assert.equal(images.length, 0, 'Inactive cells request no frames');
  viewer.setActive(true);
  await flush();
  assert.deepEqual(images.map(img => img.src.split('/').pop()), ['000.webp', '004.webp', '008.webp']);
  images[0].resolve();
  images[1].resolve();
  assert.equal(images.length, 3, 'The fill pass waits for the entire sparse pass');
  complete();
  assert.equal(images.length, 12);
  assert(requests.every(r => r.url.includes('/skids/')) && images.every(img => img.src.includes('/skids/')), 'Only the visible drink is requested');
  const start = Number(button.dataset.frame);
  button.dispatchEvent(event('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 300 }));
  assert(button.hasPointerCapture(1));
  assert(viewer.isDragging());
  domClock.tick(16);
  button.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 250 }));
  assert.equal(Number(button.dataset.frame), (start + 1) % 12, 'Dragging left advances the clockwise sequence');
  button.dispatchEvent(event('pointermove', { pointerId: 2, clientX: 50 }));
  assert.equal(Number(button.dataset.frame), (start + 1) % 12, 'Other pointers cannot take over the drag');
  button.dispatchEvent(event('pointerup', { pointerId: 1 }));
  assert(!viewer.isDragging() && !button.hasPointerCapture(1));
  const beforeKey = Number(button.dataset.frame);
  const key = event('keydown', { key: 'ArrowRight' });
  button.dispatchEvent(key);
  assert(key.defaultPrevented);
  assert.equal(Number(button.dataset.frame), (beforeKey + 11) % 12, 'ArrowRight follows a rightward drag');
  assert(activity >= 3, 'Gestures and keyboard input reset the showcase deadline');
  viewer.setActive(false);
  const still = button.dataset.frame;
  domClock.tick(32000);
  assert.equal(button.dataset.frame, still);
  assert.equal(domClock.pending(), 0);
  viewer.destroy();
  const requested = images.length;
  const fizzy = createDrinkSpin(screen, { id: 'fizzy', name: 'Fizzy' }, { clock: domClock, reduced: true });
  fizzy.setActive(true);
  await flush();
  assert.equal(screen.children[0].dataset.frame, '0', 'Switching drinks resets to the front');
  assert.equal(images.length, requested, 'Reduced motion keeps the poster until manual input');
  const fizzButton = screen.children[0];
  fizzButton.dispatchEvent(event('pointerdown', { pointerId: 3, pointerType: 'pen', isPrimary: true, button: 0, clientX: 300 }));
  await flush();
  assert.equal(images.length, requested, 'Reduced motion keeps the poster when the pointer is held still');
  fizzButton.releasePointerCapture(3);
  assert(!fizzy.isDragging(), 'Losing pen capture cancels the gesture');
  fizzButton.dispatchEvent(event('keydown', { key: 'ArrowLeft' }));
  await flush();
  assert.equal(images.length, requested + 3, 'Manual input starts only the selected reduced-motion sequence');
  complete();
  assert.equal(fizzButton.dataset.frame, '1', 'Keys pressed before the manifest arrives are preserved');
  const stopped = fizzButton.dataset.frame;
  domClock.tick(32000);
  assert.equal(fizzButton.dataset.frame, stopped);
  fizzy.destroy();
  const partial = createDrinkSpin(screen, { id: 'ground-pinch', name: 'Ground Pinch' }, { clock: domClock });
  partial.setActive(true);
  await flush();
  const pending = images.slice(-3);
  partial.setActive(false);
  assert(pending.every(img => !img.src && img.onload === null), 'Pausing cancels in-flight image work');
  const pausedRequests = images.length;
  partial.setActive(true);
  await flush();
  assert.equal(images.length, pausedRequests + 3, 'Returning on-screen resumes the sparse preload pass');
  partial.destroy();
  assert.equal(domClock.pending(), 0);
  // A late manifest cannot mutate a replacement viewer or request old frames.
  let deliver;
  let lateSignal;
  globalThis.fetch = (url, options) => {
    lateSignal = options.signal;
    return new Promise(resolve => { deliver = resolve; });
  };
  const late = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock });
  late.setActive(true);
  const beforeLate = images.length;
  late.destroy();
  assert(lateSignal.aborted);
  deliver({ ok: true, json: async () => ({ frameCount: 120 }) });
  await flush();
  assert.equal(images.length, beforeLate);
  globalThis.fetch = async () => ({ ok: true, json: async () => manifestData });
  manifestData = { frameCount: 120 };
  const finalFrames = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock });
  finalFrames.setActive(true);
  await flush();
  assert.equal(screen.children[0].dataset.frameCount, '120', 'The real loader accepts the final frame count');
  finalFrames.destroy();
  // An invalid manifest retains the poster.
  manifestData = { frameCount: 0 };
  const broken = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock });
  broken.setActive(true);
  await flush();
  assert(screen.children[0].children[0].src.endsWith('/poster.webp'));
  broken.destroy();
} finally {
  for (const [key, descriptor] of Object.entries(globals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
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
  assert.deepEqual([manifest.width, manifest.height], [1200, 900], `${drink}: wide 4:3 framing`);
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
console.log('Drink spin checks passed: 16-second turns, inertia, six-second idle, visibility, pointer capture/direction, keys, reduced motion, progressive visible-only loading, exact card copy and complete 1200×900 assets.');
