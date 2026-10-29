// Run the actual showcase with a deterministic DOM fixture. Rendering, focus
// styling and CSS animation timing remain covered by darty-live-browser.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from './helpers/navigation-dom.mjs';

const source = await readFile(new URL('../project-showcase.js', import.meta.url), 'utf8');
const matchSource = await readFile(new URL('../darty-match.js', import.meta.url), 'utf8');
const { dartyMatchURL } = await import(`data:text/javascript;base64,${Buffer.from(matchSource).toString('base64')}`);

function mount(manual = false, phone = false) {
  const f = fixture(`http://toucan.test/${manual ? 'children' : 'index'}.html?project=darty`);
  const pendingDecodes = [], decodeCalls = [], observers = [], messages = [];
  const prototype = Object.getPrototypeOf(f.node('div'));
  Object.defineProperties(prototype, {
    className: { configurable: true, get() { return this.attrs.class || ''; }, set(value) { this.attrs.class = value; } },
    isConnected: { configurable: true, get() { return f.document.body.contains(this); } },
    innerHTML: { configurable: true, get() { return this.markup || ''; }, set(value) {
      this.markup = value;
      this.replaceChildren();
      const stack = [this];
      for (const match of value.matchAll(/<\/?([\w-]+)([^>]*)>/g)) {
        if (match[0].startsWith('</')) { stack.pop(); continue; }
        const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, val]) => [key, val || '']));
        const child = node(match[1], attrs);
        stack.at(-1).append(child);
        if (!['img', 'input', 'br'].includes(match[1]) && !match[0].endsWith('/>')) stack.push(child);
      }
    } },
  });
  prototype.remove = function () { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; };
  prototype.prepend = function (...children) { children.forEach(child => child.remove()); this.children.unshift(...children); children.forEach(child => { child.parentElement = this; }); };
  prototype.replaceChildren = function (...children) { [...this.children].forEach(child => child.remove()); this.append(...children); };
  function node(tag, attrs = {}) {
    const element = f.node(tag, attrs);
    element.dataset = new Proxy({}, {
      get: (_, key) => element.attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())],
      set: (_, key, value) => { element.attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())] = String(value); return true; },
      deleteProperty: (_, key) => { delete element.attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())]; return true; },
    });
    element.decode = () => {
      decodeCalls.push(element.src);
      return new Promise(resolve => pendingDecodes.push(resolve));
    };
    if (tag === 'iframe') element.contentWindow = { postMessage: (data, target) => messages.push({ data: JSON.parse(JSON.stringify(data)), target }) };
    return element;
  }
  f.document.createElement = tag => node(tag);
  const root = node('div', { 'data-showcase': '', 'data-showcase-mode': manual ? 'manual' : 'auto' });
  if (manual) {
    root.append(node('div', { class: 'section-head' }));
    for (const id of ['intro', 'football', 'darty', 'drinks', 'piano']) {
      const slide = node('article', { 'data-project-slide': '', 'data-project': id });
      slide.append(node('div', { class: 'framework-project-media' }));
      root.append(slide);
    }
  }
  f.document.body.append(root);
  f.document.hidden = false;
  f.document.activeElement = f.document.body;
  const media = f.runCode(`
    globalThis.queueMicrotask = fn => Promise.resolve().then(fn);
    globalThis.clearTimeout = () => {};
    globalThis.Image = class { constructor(width, height) { const img = document.createElement('img'); img.width = width; img.height = height; return img; } };
    globalThis.matchMedia = query => {
      const target = document.createElement('media');
      target.matches = query.includes('max-width') ? ${phone} : false;
      return target;
    };
    const motion = matchMedia('reduce'), stillsOnly = matchMedia('max-width');
    globalThis.matchMedia = query => query.includes('max-width') ? stillsOnly : motion;
    [motion, stillsOnly];
  `);
  f.runCode('globalThis.IntersectionObserver = class { constructor(callback, options) { this.callback = callback; this.options = options; } observe(target) { this.target = target; document.body.intersections.push(this); } };');
  f.document.body.intersections = observers;
  const stubs = `const prefetchDrink = () => ({setActive(){}}); const initHeroSky = () => { throw new Error('Unexpected piano mount'); }; const SKY_PRESETS = [{ id: 'og' }]; const dartyMatchURL = ${JSON.stringify(dartyMatchURL)};`;
  f.runCode(stubs + source.replace(/^import .*;\n/gm, '').replace(/\bexport /g, ''));
  const intersection = active => observers.filter(observer => !observer.options).forEach(observer => observer.callback([{ target: observer.target, isIntersecting: active }]));
  intersection(true);
  return { ...f, root, messages, intersection, media, decodeCalls,
    async decode() { pendingDecodes.splice(0).forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); },
    get stage() { return root.querySelector('.showcase-stage'); },
    get title() { return root.querySelector('.showcase-darty-title'); },
    get play() { return root.querySelector('[data-darty-play]'); },
    get frame() { return root.querySelector('.showcase-match'); },
    get mute() { return root.querySelector('[data-darty-mute]'); },
  };
}

for (const manual of [false, true]) {
  const f = mount(manual);
  assert.equal(f.frame, null, 'No iframe before the visitor presses Play');
  assert.equal(f.title.dataset.active, 'true');
  assert.equal(f.stage.querySelectorAll('img').length, 1, 'One still is shared by the title and loading match');
  const backdrop = f.title.querySelector('img');
  assert(backdrop.src.includes('darty-still-07.webp'));
  assert.equal(f.decodeCalls.filter(src => src.includes('darty-still-07.webp')).length, 1, 'Warm the backdrop once before mounting, without restarting decode on selection');
  assert.equal(backdrop.alt, '');
  assert.equal(backdrop.getAttribute('aria-hidden'), 'true', 'The title still is decorative');
  assert.equal(f.title.dataset.ready, undefined, 'Wait for decode before zooming');
  await f.decode();
  assert.equal(f.title.dataset.ready, '');
  const title = f.title;
  const poster = f.stage.querySelector('.showcase-preview');
  const start = () => {
    f.play.focus();
    f.emit(f.play, 'click');
    assert.equal(f.frame.src, dartyMatchURL);
    assert.equal(f.document.activeElement, f.frame, 'Keyboard focus transfers to the frame');
    assert.equal(title.dataset.active, 'false', 'Title zoom is paused during playback');
    assert.equal(f.stage.querySelector('.showcase-preview'), poster, 'Retain the incoming poster during match loading');
    assert.equal(f.frame.dataset.showcaseRevealed, undefined);
    assert.equal(f.mute.disabled, true, 'Do not send mute messages before the game loads');
    f.emit(f.frame, 'load');
    f.flush();
    assert.equal(f.mute.disabled, false);
    assert.equal(f.frame.dataset.showcaseRevealed, '');
    assert.equal(f.mute.getAttribute('aria-pressed'), 'false', 'Every match starts unmuted');
  };
  start();
  const firstIcon = f.mute.innerHTML;
  for (const muted of [true, false]) {
    f.emit(f.mute, 'click');
    assert.equal(f.mute.getAttribute('aria-pressed'), String(muted));
    assert.equal(f.mute.getAttribute('aria-label'), muted ? 'Unmute DARTY match' : 'Mute DARTY match');
    assert.equal(f.mute.innerHTML === firstIcon, !muted);
  }
  assert.deepEqual(f.messages, [true, false].map(muted => ({ data: { source: 'toucan-showcase', type: 'darty-mute', muted }, target: 'https://joshtoucanlearn.github.io' })));
  const oldFrame = f.frame;
  const oldMute = f.mute;
  f.intersection(false);
  assert.equal(oldFrame.isConnected, false, 'Leaving the viewport destroys the iframe');
  assert.equal(oldMute.isConnected, false);
  assert.equal(f.title, title);
  assert.equal(f.title.querySelector('img'), backdrop, 'Teardown restores the same still without an image swap');
  assert.equal(title.dataset.active, 'false');
  f.intersection(true);
  assert.equal(title.dataset.active, 'true');
  assert.equal(f.frame, null, 'Returning never autostarts the match');
  f.document.hidden = true;
  f.emit(f.document, 'visibilitychange');
  assert.equal(title.dataset.active, 'false', 'Hidden tabs pause the title zoom');
  f.document.hidden = false;
  f.emit(f.document, 'visibilitychange');
  assert.equal(title.dataset.active, 'true');
  start();
  f.document.hidden = true;
  f.emit(f.document, 'visibilitychange');
  assert.equal(f.frame, null, 'Hiding the tab destroys a playing iframe');
  f.document.hidden = false;
  f.emit(f.document, 'visibilitychange');
  start();
  f.media[1].matches = true;
  f.emit(f.media[1], 'change');
  assert.equal(f.frame, null, 'Switching to phone mode destroys the iframe');
  assert.equal(f.title, null);
  assert(f.root.querySelector('[data-screenshot-gallery]'));
  for (let i = 1; i <= 12; i++) {
    assert(f.root.querySelector('[data-screenshot]').src.includes(`darty-still-${String(i).padStart(2, '0')}.webp`));
    f.emit(f.root.querySelector('[data-screenshot-next]'), 'click');
  }
  f.media[1].matches = false;
  f.emit(f.media[1], 'change');
  assert(f.play);
  f.media[0].matches = true;
  f.emit(f.media[0], 'change');
  assert.equal(f.title.dataset.active, 'false', 'Reduced motion keeps a static title');
  const outgoing = f.title;
  const decodeCount = f.decodeCalls.length;
  f.emit(f.root.querySelector('[data-project-prev]'), 'click');
  assert.equal(outgoing.isConnected, false, 'Project switches detach the title immediately');
  assert.equal(f.mute, null);
  f.emit(f.root.querySelector('[data-project-next]'), 'click');
  assert(f.play);
  assert.equal(f.decodeCalls.length, decodeCount, 'Project switches reuse the warm backdrop without decoding again');
  await f.decode();
  assert.equal(outgoing.dataset.ready, undefined, 'A stale decode cannot activate a detached title');
  assert.equal(f.title.dataset.ready, '', 'A remounted title can use the cached decode result');
  f.emit(f.window, 'pagehide');
  assert.equal(f.stage.children.length, 0, 'Page exit clears all media');
  assert.equal(f.location.href, `http://toucan.test/${manual ? 'children' : 'index'}.html?project=darty`, 'Controls keep the URL unchanged');
}

// A phone load must not decode the desktop backdrop. If the breakpoint changes
// on another slide, warm it there so the next project switch stays cheap.
const phone = mount(false, true);
assert(!phone.decodeCalls.some(src => src.includes('darty-still-07.webp')));
phone.emit(phone.root.querySelector('[data-project-prev]'), 'click');
phone.media[1].matches = false;
phone.emit(phone.media[1], 'change');
assert.equal(phone.decodeCalls.filter(src => src.includes('darty-still-07.webp')).length, 1);
const warmedCount = phone.decodeCalls.length;
phone.emit(phone.root.querySelector('[data-project-next]'), 'click');
assert(phone.title.querySelector('img').src.includes('darty-still-07.webp'));
assert.equal(phone.decodeCalls.length, warmedCount, 'Breakpoint warming happens before the title is selected');
await phone.decode();
assert.equal(phone.title.dataset.ready, '');
console.log('DARTY lifecycle checks passed on both carousels: one decorative still, decode guard, exact URL, click-only frame, reveal, mute messages/icon/labels, viewport/tab/resize/page teardown, nine-image phone gallery, reduced motion and clean URLs. Rendering remains a browser check.');
