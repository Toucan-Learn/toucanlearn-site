// Exercise actual piano mounting/disposal without launching a browser or GPU.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule } from 'node:vm';
const sourceRoot = new URL('../', import.meta.url);
let attacks = 0;
let audioState;
const frames = new Map();
const timers = new Map();
const observers = new Set();
let serial = 0;
class Classes {
  values = new Set();
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, enabled = !this.contains(name)) { if (enabled) this.add(name); else this.remove(name); }
}
class Element extends EventTarget {
  dataset = {};
  classList = new Classes();
  attributes = new Map();
  children = [];
  selectors = new Map();
  width = 300;
  height = 150;
  isConnected = true;
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.selectors.get(selector) || null; }
  querySelectorAll(selector) { return selector === '[data-note]' ? this.children : []; }
  closest() { return null; }
  contains(node) { return node === this || this.children.includes(node); }
  insertBefore(node) { this.children.push(node); node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.isConnected = false; }
  getBoundingClientRect() { return { left: 0, top: 100, right: 700, bottom: 200, width: 700, height: 100 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  scrollTo() {}
  getContext(type) {
    if (type === 'webgl2') return null;
    return Object.fromEntries(['fillRect', 'clearRect', 'setTransform', 'save', 'translate', 'rotate', 'scale', 'drawImage', 'restore'].map(name => [name, () => {}]));
  }
}
class Observer {
  constructor(callback) { this.callback = callback; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
}
class Image extends Element { complete = false; }
class DetailEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const audioNode = () => Object.assign({ connect() {}, disconnect() {}, start() { attacks++; }, stop() {} }, Object.fromEntries(['frequency', 'gain', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, parameter()])));
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = audioNode(); audioState = this; }
  createGain = audioNode;
  createOscillator = audioNode;
  createBiquadFilter = audioNode;
  createStereoPanner = audioNode;
  createDynamicsCompressor = audioNode;
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
const media = new Map();
const document = new Element();
document.body = new Element();
document.hidden = false;
document.createElement = () => new Element();
const window = new Element();
window.innerHeight = 900;
window.location = { search: '?song=runaway&sky=pixel' };
window.matchMedia = query => {
  if (!media.has(query)) { const target = new Element(); target.matches = false; media.set(query, target); }
  return media.get(query);
};
const context = createContext({ document, window, URLSearchParams, location: window.location, matchMedia: window.matchMedia, Image, CustomEvent: DetailEvent,
  AbortController, ResizeObserver: Observer, IntersectionObserver: Observer, performance: { now: () => 1000 }, AudioContext,
  requestAnimationFrame: callback => { frames.set(++serial, callback); return serial; }, cancelAnimationFrame: id => frames.delete(id),
  setTimeout: callback => { timers.set(++serial, callback); return serial; }, clearTimeout: id => timers.delete(id),
});
const modules = new Map();
async function moduleFor(name) {
  name = name.replace(/^\.\//, '').split('?')[0];
  if (!modules.has(name)) modules.set(name, new SourceTextModule(await readFile(new URL(name, sourceRoot), 'utf8'), { context, identifier: name }));
  return modules.get(name);
}
// Preload to ensure shared dependency callbacks resolve to one module object.
for (const name of ['hero-sky.js', 'hero-keyboard.js', 'hero-piano.js', 'hero-songs.js', 'hero-sky-shaders.js', 'sky-framing.js']) await moduleFor(name);
const sky = await moduleFor('hero-sky.js');
await sky.link(moduleFor);
await sky.evaluate();
const markup = await readFile(new URL('project-showcase.js', sourceRoot), 'utf8');
function world(view) {
  const root = new Element();
  for (const selector of ['.world-art', '#sky-canvas', '#flock-canvas', '#piano-toggle', '#hero-keyboard']) root.selectors.set(selector, new Element());
  const host = new Element();
  host.getBoundingClientRect = () => ({ bottom: view.phone ? 644 : 655 });
  root.querySelector('#piano-toggle').closest = selector => (selector === '.living-hero' ? view.route === 'index.html' : selector === '[data-showcase]') ? host : null;
  const header = new Element();
  header.getBoundingClientRect = () => ({ bottom: view.phone ? 64 : 95 });
  document.selectors.set('body > header', header);
  window.innerHeight = view.phone ? 844 : 750;
  const panel = root.querySelector('#hero-keyboard');
  document.children = [panel];
  let shift = 0, scrolled = 0;
  root.moveAfterLayout = () => { shift = -800; };
  window.scrollBy = ({ top }) => { scrolled += top; };
  // The long copy can stay on screen while the media above it has moved out.
  host.getBoundingClientRect = () => ({ bottom: (shift ? 335 : (view.phone ? 644 : 655)) - scrolled });
  panel.getBoundingClientRect = () => ({ left: 20, top: (view.phone ? 612 : 500) + shift - scrolled, right: 370, bottom: (view.phone ? 731 : 650) + shift - scrolled, width: 350, height: view.phone ? 119 : 150 });
  for (const selector of ['.piano-keys', '.piano-scroll', '.piano-credit', '.piano-next', '.piano-tempo', '.piano-tempo-bar', '.piano-tempo-label']) panel.selectors.set(selector, new Element());
  for (const [, note] of markup.matchAll(/data-note="([A-G]#?\d)"/g)) {
    const key = new Element();
    key.dataset.note = note;
    panel.querySelector('.piano-keys').children.push(key);
  }
  return root;
}
function key(type, value) {
  const event = new Event(type);
  event.key = value;
  document.dispatchEvent(event);
}
const views = ['index.html', 'children.html'].flatMap(route => [false, true].map(phone => ({ route, phone })));
for (const view of views) for (let cycle = 0; cycle < 3; cycle++) {
  const root = world(view);
  const before = attacks;
  const destroy = sky.namespace.initHeroSky(root);
  assert.equal(attacks, before, 'Mounting is silent');
  assert.equal(observers.size, 3, 'Only this world owns its observers');
  root.querySelector('#piano-toggle').dispatchEvent(new Event('click'));
  window.dispatchEvent(new Event('scroll'));
  assert.equal(root.querySelector('#piano-toggle').attributes.get('aria-expanded'), 'true', `${view.route}/${view.phone ? 'phone' : 'desktop'}: click opens and viewport scroll does not immediately close the piano`);
  assert.equal(root.querySelector('#hero-keyboard').inert, false);
  key('keydown', 'z');
  assert.equal(attacks - before, 4, 'Exactly one real piano voice after repeated remounts');
  assert(destroy.isPlaying(), 'Held keyboard input is visible to the idle policy');
  assert(frames.size > 0 && timers.size > 0, 'Sky/tempo and key feedback have work to cancel');
  if (view.route === 'children.html') {
    // Resize first sees the old position. The frame's later equalisation moves
    // the same keyboard above the viewport, just as in the rotation failure.
    window.dispatchEvent(new Event('resize'));
    root.moveAfterLayout();
    document.dispatchEvent(new Event('framework:layoutchange'));
    window.dispatchEvent(new Event('scroll'));
    assert.equal(root.querySelector('#piano-toggle').attributes.get('aria-expanded'), 'true', 'Pending reflow must not close the piano');
    for (let frame = 0; frame < 2; frame++) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(1000 + frame * 16));
    }
    const rect = root.querySelector('#hero-keyboard').getBoundingClientRect();
    assert(rect.top >= (view.phone ? 64 : 95) + 12 && rect.bottom <= window.innerHeight, 'Reveal uses the final frame position, keeping the complete keyboard on screen');
    assert.equal(root.querySelector('#piano-toggle').attributes.get('aria-expanded'), 'true');
    window.dispatchEvent(new Event('resize')); // Disposal also cancels pending layout work.
  }
  destroy();
  assert.equal(observers.size, 0, 'All resize/intersection observers disconnected');
  assert.equal(frames.size, 0, 'Both sky and tempo animation frames cancelled');
  assert.equal(timers.size, 0, 'Pressed-key feedback timers cleared');
  assert.equal(audioState.state, 'suspended', 'Switching away suspends audio');
  assert.equal(destroy.isPlaying(), false, 'Held input and live/releasing voices cleared');
  assert.equal(root.querySelector('.world-art').children.length, 0, 'Fallback canvas removed');
  const stopped = attacks;
  root.querySelector('.world-art').dispatchEvent(new Event('click'));
  key('keyup', 'z');
  key('keydown', 'x');
  assert.equal(attacks, stopped, 'Detached sky and document keyboard listeners cannot play');
}
console.log('Piano lifecycle checks passed: both routes at desktop/phone geometry, three mounts each, toggle/scroll stability, deferred frame reflow, one voice per input and complete teardown.');
