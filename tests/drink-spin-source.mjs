// Real controller and loader, with a deterministic clock and a small DOM adapter.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const source = await readFile(new URL('../drink-spin.js', import.meta.url), 'utf8');
const { spinMotion, frameAt, frameBlend, progressiveFrames, createDrinkSpin, renderDrinkInfo } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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
assert(Math.abs(motion.state.turns + 1) < 1e-9, 'Exactly one revolution in 16 seconds, turning the other way round');
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
assert(motion.state.turns < late, 'A flick against the usual direction swings round into it, never stopping');
assert.equal(motion.state.velocity, 0, 'The flick has eased into the idle spin');
const settled = motion.state.turns;
clock.tick(1600);
assert(Math.abs(motion.state.turns - settled + .1) < .002, 'Carries straight on at the slow idle speed, with no six-second pause');
motion.step(-1 / 72);
const keyed = motion.state.turns;
clock.tick(16);
assert(motion.state.turns < keyed, 'Keyboard rotation resumes on the next animation frame');
motion.begin();
clock.tick(500);
motion.end();
const stillRelease = motion.state.turns;
clock.tick(16);
assert(motion.state.turns < stillRelease, 'A still release resumes immediately');
for (const reason of ['hidden', 'off-screen', 'other project']) {
  motion.setActive(false);
  const paused = motion.state.turns;
  clock.tick(32000);
  assert.equal(motion.state.turns, paused, `${reason}: frozen angle`);
  assert.equal(clock.pending(), 0, `${reason}: no animation or idle work`);
  motion.setActive(true);
  clock.tick(1616);
  assert(motion.state.turns < paused && paused - motion.state.turns < .102, `${reason}: no catch-up jump`);
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
  assert.deepEqual(order.slice(0, Math.min(3, count)), count === 2 ? [0, 1] : [0, 1, count - 1], 'Adjacent frames preload across the wrap first');
}

for (const [turns, lower, upper, mix] of [[.15, 1, 2, .5], [-.025, 9, 0, .75], [1, 0, 1, 0]]) {
  const blend = frameBlend(turns, 10);
  assert.equal(blend.lower, lower);
  assert.equal(blend.upper, upper);
  assert(Math.abs(blend.mix - mix) < 1e-9, 'Continuous fractional angle, including reverse wrapping');
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
const images = [];
const requests = [];
let manifestData = { frameCount: 12, dragDirection: 1 };
const file = img => img.src?.split('/').pop().split('?')[0];
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
async function complete() {
  for (let round = 0; round < 150; round++) {
    const pending = images.filter(img => img.src && !img.settled);
    if (!pending.length) return;
    pending.forEach(img => img.resolve());
    await flush();
  }
  assert.fail('Preload queue did not drain');
}
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
    assert.equal(card.children.length, 2);
    assert.equal(card.children[0].textContent, name);
    assert.equal(card.children[1].textContent, text);
    assert.equal(card.getAttribute('aria-live'), 'polite');
  }
  globalThis.Image = class extends Element {
    constructor() { super('img'); images.push(this); }
    decode() { return new Promise((resolve, reject) => { this.accept = resolve; this.reject = reject; }); }
    resolve() { this.decoded = this.settled = true; this.accept?.(); }
    fail() { this.settled = true; this.reject?.(Error('decode failed')); }
  };
  globalThis.fetch = async (url, options) => { requests.push({ url, signal: options.signal }); return { ok: true, json: async () => manifestData }; };
  const screen = new Element();
  const domClock = fakeClock();
  let activity = 0;
  const viewer = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock, activity: () => activity++ });
  const button = screen.children[0];
  assert.equal(button.children.length, 0, 'Wait for poster decode before first paint');
  assert.equal(images.length, 1, 'Inactive cells request only the poster');
  images[0].resolve(); await flush();
  assert.equal(file(button.children[0]), 'poster.webp');
  assert.equal(button.getAttribute('aria-label'), 'Rotate Skids, 360° view');
  viewer.setActive(true); await flush();
  assert.deepEqual(images.slice(1).map(file), ['000.webp', '001.webp', '011.webp']);
  images[1].resolve(); await flush();
  domClock.tick(16);
  const held = [...button.children];
  assert.equal(file(held[0]), '000.webp');
  domClock.tick(32);
  assert.deepEqual(button.children, held, 'Hold the last composition while an adjacent frame is undecoded');
  images[3].resolve(); await flush();
  assert.equal(button.children.length, 2);
  assert(button.children.every(img => img.decoded));
  const mix1 = Number(button.dataset.blend);
  domClock.tick(16);
  assert.notEqual(Number(button.dataset.blend), mix1, 'Opacity interpolates every animation frame within the same 3-degree interval');
  assert.equal(Number(button.children[1].style.opacity), Number(button.dataset.blend));
  assert.equal(button.children[0].style.opacity, '1', 'Opaque bottom prevents the background bleeding through');
  await complete();
  assert.equal(images.length, 13);
  assert(requests.every(r => r.url.includes('/skids/')) && images.every(img => img.src.includes('/skids/')));
  button.dispatchEvent(event('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 300 }));
  assert(button.hasPointerCapture(1) && viewer.isDragging());
  domClock.tick(16);
  const start = Number(button.dataset.turns);
  button.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 250 }));
  assert(Math.abs(Number(button.dataset.turns) - start + 50 / 600) < 1e-9, 'One turn per viewer width, with the current dragDirection');
  const dragged = button.dataset.turns;
  button.dispatchEvent(event('pointermove', { pointerId: 2, clientX: 50 }));
  assert.equal(button.dataset.turns, dragged, 'Other pointers cannot take over');
  button.dispatchEvent(event('pointerup', { pointerId: 1 }));
  assert(!viewer.isDragging() && !button.hasPointerCapture(1));
  const beforeKey = Number(button.dataset.turns);
  const key = event('keydown', { key: 'ArrowRight' }); button.dispatchEvent(key);
  assert(key.defaultPrevented);
  assert(Math.abs(Number(button.dataset.turns) - beforeKey - 1 / 12) < 1e-9);
  const keyed = Number(button.dataset.turns); domClock.tick(16);
  assert(Number(button.dataset.turns) < keyed, 'Keyboard input resumes immediately');
  assert(activity >= 3);
  viewer.setActive(false);
  const still = button.dataset.turns; domClock.tick(32000);
  assert.equal(button.dataset.turns, still); assert.equal(domClock.pending(), 0);
  const lastGood = [...button.children]; viewer.destroy();
  const requested = images.length;
  const fizzy = createDrinkSpin(screen, { id: 'fizzy', name: 'Fizzy' }, { clock: domClock, reduced: true });
  fizzy.setActive(true); await flush();
  const fizzButton = screen.children[0];
  assert.deepEqual(fizzButton.children, lastGood, 'Switching drinks preserves the last decoded composition');
  assert.equal(images.length, requested + 1, 'Reduced motion only fetches the poster');
  images.at(-1).resolve(); await flush();
  assert.equal(fizzButton.children[0].dataset.drink, 'fizzy');
  assert.equal(fizzButton.dataset.frame, '0');
  fizzButton.dispatchEvent(event('pointerdown', { pointerId: 3, isPrimary: true, button: 0, clientX: 300 }));
  await flush(); assert.equal(images.length, requested + 1);
  fizzButton.releasePointerCapture(3); assert(!fizzy.isDragging());
  fizzButton.dispatchEvent(event('keydown', { key: 'ArrowLeft' })); await flush();
  await complete(); assert.equal(fizzButton.dataset.frame, '11', 'Keys queued before the manifest are preserved');
  const manual = fizzButton.dataset.turns; domClock.tick(32000);
  assert.equal(fizzButton.dataset.turns, manual, 'Reduced motion has no auto spin or inertia');
  fizzy.destroy();
  const partial = createDrinkSpin(screen, { id: 'ground-pinch', name: 'Ground Pinch' }, { clock: domClock });
  partial.setActive(true); await flush();
  const pending = images.slice(-3);
  partial.setActive(false);
  assert(pending.every(img => !img.src), 'Pausing cancels pending frame work');
  pending.forEach(img => img.resolve()); await flush();
  const pausedRequests = images.length;
  partial.setActive(true); await flush();
  assert.equal(images.length, pausedRequests + 3, 'Cancelled decodes never enter the ready cache');
  const oldComposition = [...screen.children[0].children];
  images.at(-1).fail(); await flush();
  assert.deepEqual(screen.children[0].children, oldComposition, 'Decode failure keeps the previous good image');
  partial.destroy();
  // A late manifest cannot mutate the replacement viewer.
  let deliver, lateSignal;
  globalThis.fetch = (url, options) => { lateSignal = options.signal; return new Promise(resolve => { deliver = resolve; }); };
  const late = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock }); late.setActive(true);
  const beforeLate = images.length; const latePoster = images.at(-1); late.destroy();
  assert(lateSignal.aborted); latePoster.resolve();
  deliver({ ok: true, json: async () => ({ frameCount: 120 }) }); await flush();
  assert.equal(images.length, beforeLate);
  globalThis.fetch = async () => ({ ok: true, json: async () => manifestData });
  manifestData = { frameCount: 120 };
  const finalFrames = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock }); finalFrames.setActive(true); await flush();
  assert.equal(screen.children[0].dataset.frameCount, '120'); finalFrames.destroy();
  manifestData = { frameCount: 0 };
  const broken = createDrinkSpin(screen, { id: 'skids', name: 'Skids' }, { clock: domClock }); broken.setActive(true);
  images.at(-1).resolve(); await flush(); assert.equal(file(screen.children[0].children[0]), 'poster.webp'); broken.destroy();
  assert.equal(domClock.pending(), 0);
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
console.log('Drink spin checks passed: 16-second turns, inertia, immediate resume, decoded adjacent-frame interpolation and drink-switch holds, visibility, pointer capture/direction, keys, reduced motion, progressive visible-only loading, exact card copy and complete 1200×900 assets.');
