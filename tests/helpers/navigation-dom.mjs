// Small deterministic DOM fixture for navigation, events, focus and history.
// It deliberately does not simulate layout, browser scrolling or rendering.
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
class Events {
  listeners = new Map();
  addEventListener(type, fn, options) {
    const entries = this.listeners.get(type) || [];
    entries.push({ fn, options }); this.listeners.set(type, entries);
  }
  dispatchEvent(event) {
    event.target ||= this;
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      entry.fn(event);
      if (entry.options?.once) this.listeners.set(event.type, this.listeners.get(event.type).filter(item => item !== entry));
    }
    if (event.bubbles) (this.parentElement || this.parentTarget)?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
}
export function fixture(href, storage = new Map(), wide = true) {
  const frames = new Map(), timers = [], observers = new Set();
  let serial = 0, location = new URL(href);
  const document = new Events();
  class Element extends Events {
    constructor(tag, attrs = {}, text = '') {
      super(); this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = [];
      this.textContent = text; this.hidden = false; this.inert = false; this.scrollTop = 0;
      this.style = { setProperty() {} };
      this.classList = { add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
        toggle: (name, on) => { const names = new Set((this.attrs.class || '').split(' ')); on ? names.add(name) : names.delete(name); this.attrs.class = [...names].join(' '); } };
      this.dataset = new Proxy({}, { get: (_, key) => this.attrs['data-' + key.replace(/[A-Z]/g, char => '-' + char.toLowerCase())] });
    }
    get id() { return this.attrs.id || ''; }
    get href() { return new URL(this.attrs.href, location).href; }
    get target() { return this.attrs.target; }
    get firstChild() { return this.children[0]; }
    get offsetWidth() { return 400; }
    append(...nodes) {
      nodes.forEach(node => { if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node); node.parentElement = this; this.children.push(node); });
      const pending = [...observers];
      queueMicrotask(() => pending.forEach(observer => { if (observers.has(observer)) observer.callback([]); }));
    }
    contains(node) { return !!node && (node === this || this.children.some(child => child.contains(node))); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    hasAttribute(key) { return key in this.attrs; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    removeAttribute(key) { delete this.attrs[key]; }
    toggleAttribute(key, on) { on ? this.setAttribute(key, '') : this.removeAttribute(key); }
    matches(selectors) {
      return selectors.split(',').some(selector => {
        const match = selector.trim().match(/^([\w-]+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:(\*=|=)"([^"]*)")?\])?$/);
        if (!match) return false;
        const [, tag, cls, attr, op, value] = match;
        return (!tag || this.tagName === tag.toUpperCase()) && (!cls || (this.attrs.class || '').split(' ').includes(cls)) && (!attr || this.hasAttribute(attr) && (!op || (op === '=' ? this.attrs[attr] === value : this.attrs[attr].includes(value))));
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() { document.activeElement = this; }
    pause() { this.paused = true; }
    scrollIntoView(options) { this.scrolled = options; }
    scrollTo(options) { this.scrollTop = options.top; }
    getBoundingClientRect() { return { top: 0, bottom: 200, left: 0, right: 400, width: 400, height: 200 }; }
  }
  const node = (tag, attrs, text) => new Element(tag, attrs, text);
  document.body = node('body');
  document.documentElement = document.body;
  document.body.parentTarget = document;
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => document.querySelectorAll('*').find(element => element.id === id) || null;
  document.createElement = tag => node(tag);
  document.fonts = { ready: Promise.resolve() };
  const window = new Events();
  const calls = [];
  const history = { state: { retained: true }, length: 1,
    replaceState(state, _, url) { calls.push({ kind: 'replace', url }); this.state = state; location = new URL(url, location); },
    pushState(state, _, url) { calls.push({ kind: 'push', url }); this.state = state; this.length++; location = new URL(url, location); } };
  const context = vm.createContext({ document, window, history, URL, URLSearchParams,
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    matchMedia: query => ({ matches: /min-width/.test(query) ? wide : true, addEventListener() {} }),
    getComputedStyle: () => ({ height: '200', paddingTop: '0', paddingBottom: '0', borderTopWidth: '0', borderBottomWidth: '0' }),
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: fn => timers.push(fn),
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() { observers.add(this); } disconnect() { observers.delete(this); } }, getSelection: () => '',
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  });
  Object.defineProperty(context, 'location', { get: () => location });
  Object.assign(window, { matchMedia: context.matchMedia, scrollTo: options => { window.scrolled = options; }, getSelection: context.getSelection });
  Object.defineProperty(window, 'location', { get: () => location });
  context.addEventListener = window.addEventListener.bind(window);
  const emit = (target, type, extra = {}) => {
    const event = { type, button: 0, preventDefault() { this.defaultPrevented = true; }, ...extra };
    target.dispatchEvent(event); return event;
  };
  const flush = () => { while (frames.size) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
  return { node, document, window, history, calls, storage,
    get location() { return location; }, emit, flush,
    click(element, extra) { const event = emit(element, 'click', extra); document.dispatchEvent(event); flush(); return event; },
    async load() { emit(window, 'pageshow'); emit(window, 'load'); await Promise.resolve(); flush(); timers.splice(0).forEach(fn => fn()); },
    incoming(hash, type = 'hashchange') { location.hash = hash; emit(window, type); flush(); },
    runCode(code) { return vm.runInContext(code, context); },
    async run(file) { vm.runInContext(await readFile(new URL('../../' + file, import.meta.url), 'utf8'), context, { filename: file }); }
  };
}
