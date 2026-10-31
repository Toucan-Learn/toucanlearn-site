// Offline checks: node tests/launch-offer-source.mjs
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { contactMarkup, contactScript } from './helpers/contact-markup.mjs';
import { navigationMarkup } from './helpers/navigation-markup.mjs';
import { contactSourceChecks } from './helpers/contact-layout.mjs';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('launch-offer.js', root), 'utf8');
const contact = await readFile(new URL('contact.js', root), 'utf8');
const html = await readFile(new URL('contact.html', root), 'utf8');
const css = await readFile(new URL('campaigns.css', root), 'utf8');
const contactCSS = await readFile(new URL('contact.css', root), 'utf8');
const output = new URL('../outputs/final-pass-20261028/codex-offer/', root);
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
check('Contact reading order, preserved controls, CSP, sky hierarchy and AA contrast', () => {
  const original = execFileSync('git', ['show', 'HEAD:contact.html'], { cwd: root, encoding: 'utf8' });
  const originalCSS = execFileSync('git', ['show', 'HEAD:contact.css'], { cwd: root, encoding: 'utf8' });
  assert.equal(contactMarkup(html), contactMarkup(original));
  assert.equal(contact, execFileSync('git', ['show', 'HEAD:contact.js'], { cwd: root, encoding: 'utf8' }), 'Enquiry logic is unchanged');
  const contrast = contactSourceChecks(html, original, contactCSS, originalCSS);
  console.log(`PASS: Contact controls, DOM order, CSP and CSS cache token; minimum contrast over white sky pixels: ${JSON.stringify(contrast)}.`);
});
// Run the contact regressions independently of the known pop-up baseline failure.
if (process.env.CONTACT_ONLY === '1') process.exit(0);
class Events {
  listeners = new Map();
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; this.listeners.set(type, [...list, fn]); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== fn)); }
  emit(type, data = {}) { const event = { type, preventDefault() { this.defaultPrevented = true; }, ...data }; for (const fn of [...(this.listeners.get(type) || [])]) fn(event); return event; }
}
function load({ path = 'index.html', query = '', active = true, date = '2026-10-28T12:00:00Z', storage = new Map(), storageThrows = false, loaded = true } = {}) {
  const clock = { now: Date.parse(date), next: 0, timers: new Map() };
  const document = Object.assign(new Events(), { hidden: false, readyState: loaded ? 'complete' : 'loading' });
  class Node extends Events {
    constructor(tag, text = '') { super(); this.tag = tag; this.textContent = text; this.children = []; this.attrs = {}; this.className = ''; this.value = ''; this.open = false; this.dataset = {}; this.classList = { add() {}, remove() {} }; }
    append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    removeAttribute(name) { delete this.attrs[name]; }
    get isConnected() { return this === document.body || !!this.parent?.isConnected; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    getBoundingClientRect() { return { left: 100, top: 100, right: 520, bottom: 500 }; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      if (selector.includes(':checked') || selector.startsWith('[aria-invalid')) return [];
      return this.all().filter(node => selector.startsWith('.') ? node.className.split(' ').includes(selector.slice(1)) : node.tag === selector);
    }
    snapshot() { return { tag: this.tag, text: this.textContent, attrs: this.attrs, className: this.className, children: this.children.map(node => node.snapshot()) }; }
  }
  document.body = new Node('body');
  const original = new Node('main', 'Your first session and diagnostic report are free.');
  const returnFocus = new Node('a', 'Book a free trial'); returnFocus.setAttribute('href', 'contact.html');
  document.body.append(original, returnFocus); returnFocus.focus();
  const menu = new Node('details'); menu.className = 'mobile-menu'; document.body.append(menu);
  const form = Object.assign(new Node('form'), { id: 'enquiry-form', dataset: { formEndpoint: 'https://script.google.com/macros/s/test/exec' } });
  if (path === 'contact.html') {
    document.body.append(form);
    for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
      if (id !== form.id) form.append(Object.assign(new Node('input'), { id }));
    }
  }
  document.getElementById = id => document.body.all().find(node => node.id === id) || null;
  if (path === 'contact.html') document.getElementById('campaign-source').value = 'Direct or unknown';
  document.scrollingElement = { scrollHeight: 2000, clientHeight: 750, scrollTop: 0 };
  document.querySelector = selector => selector === '.team-scroll' ? document.teamScroll || null : selector === 'details.mobile-menu[open], dialog[open]' ? (menu.open ? menu : document.body.all().find(node => node.tag === 'dialog' && node.open)) || null : null;
  document.createElement = tag => new Node(tag);
  const window = Object.assign(new Events(), {
    location: { pathname: '/' + path, href: 'https://example.invalid/' + path + query, search: query },
    setTimeout(fn, delay) { const id = ++clock.next; clock.timers.set(id, { fn, at: clock.now + delay }); return id; },
    clearTimeout(id) { clock.timers.delete(id); },
    localStorage: {
      getItem(key) { if (storageThrows) throw Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageThrows) throw Error('Storage denied'); storage.set(key, value); }
    }
  });
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } }
  const context = vm.createContext({ window, document, Date: FixedDate, Intl, URLSearchParams, URL });
  const before = structuredClone(document.body.snapshot());
  vm.runInContext(active ? source : source.replace('active: true', 'active: false'), context);
  if (path === 'contact.html') vm.runInContext(contact, context);
  function tick(ms) {
    const target = clock.now + ms;
    while (true) {
      const next = [...clock.timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      clock.now = next[1].at; clock.timers.delete(next[0]); next[1].fn();
    }
    clock.now = target;
  }
  return { document, window, clock, menu, before, storage, tick, returnFocus, form,
    get dialog() { return document.body.all().find(node => node.tag === 'dialog') || null; },
    pageSnapshot() { return { ...document.body.snapshot(), children: document.body.children.filter(node => node.tag !== 'dialog').map(node => node.snapshot()) }; } };
}
const pages = [];
for (const file of (await readdir(root)).filter(file => file.endsWith('.html'))) {
  const text = await readFile(new URL(file, root), 'utf8');
  if (!text.includes('<header')) continue;
  pages.push(file);
  check(`${file}: original HTML preserved except approved contact changes`, () => {
    assert.equal((text.match(/src="launch-offer\.js\?/g) || []).length, 1);
    // Owner, 31 Oct: Microsoft Clarity is the only outside script.
    assert.match(text, /script-src 'self' https:\/\/www\.clarity\.ms https:\/\/scripts\.clarity\.ms; style-src 'self'/);
    const original = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
    if (file === 'contact.html') {
      assert.equal(contactMarkup(text), contactMarkup(original));
      assert.doesNotMatch(text, /support-needed-hint/);
    } else {
      assert.equal(navigationMarkup(text.replace(/^  <script src="launch-offer\.js[^\n]+\n/gm, '')
        .replace('campaigns.css?v=20261028-launch-offer-3', 'campaigns.css?v=20261028-review-teal-2')
        .replace('contact.js?v=20261028-launch-offer-3', 'contact.js?v=20261028-quals-1')), navigationMarkup(original));
    }
    if (file !== 'contact.html') assert.doesNotMatch(text, /£\s*\d/);
  });
}
check('CSS scoped to dialog; no inline code, external hosts or page mutations', () => {
  const original = execFileSync('git', ['show', 'HEAD:campaigns.css'], { cwd: root, encoding: 'utf8' });
  assert.ok(css.startsWith(original));
  assert.doesNotMatch(css.slice(original.length), /(?:^|[\s,])(?:body|html|header|#main|\.cta|\.hero)\b|@import|url\(/m);
  assert.doesNotMatch(source, /innerHTML|\.style\b|setAttribute\(['"](?:style|on\w+)|https?:\/\/|launch-offer-slot|claim-launch-offer|launch-offer-pricing/);
  assert.equal(contactScript(contact), contactScript(execFileSync('git', ['show', 'HEAD:contact.js'], { cwd: root, encoding: 'utf8' })));
});
check('Six seconds starts after load; page copy remains untouched before and during display', () => {
  const state = load({ loaded: false }); state.tick(9000); assert.equal(state.dialog, null);
  state.window.emit('load'); state.tick(5999); assert.equal(state.dialog, null);
  assert.deepEqual(state.pageSnapshot(), state.before);
  state.tick(1); assert.ok(state.dialog?.open);
  assert.deepEqual(state.pageSnapshot(), state.before);
});
check('Scroll past 40 percent triggers first, including the team scroll container', () => {
  for (const internal of [false, true]) {
    const state = load();
    const scroll = internal ? (state.document.teamScroll = { scrollHeight: 2000, clientHeight: 750, scrollTop: 0 }) : state.document.scrollingElement;
    scroll.scrollTop = 500; state.window.emit('scroll'); assert.equal(state.dialog, null);
    scroll.scrollTop = 501; state.window.emit('scroll'); assert.ok(state.dialog?.open);
    assert.ok(state.clock.now < Date.parse('2026-10-28T12:00:06Z'));
  }
});
check('Menu blocks both triggers; deferred pop-up opens only after it closes', () => {
  const state = load(); state.menu.open = true; state.tick(6000); assert.equal(state.dialog, null);
  state.document.scrollingElement.scrollTop = 800; state.window.emit('scroll'); assert.equal(state.dialog, null);
  state.menu.open = false; state.document.emit('toggle'); assert.ok(state.dialog?.open);
});
check('No pop-up on contact, thank-you, inactive or expired pages', () => {
  for (const options of [{ path: 'contact.html', query: '?offer=launch' }, { path: 'thank-you.html' }, { active: false }, { date: '2026-12-01T00:00:00Z' }]) {
    const state = load(options); state.tick(60000); state.document.scrollingElement.scrollTop = 1000; state.window.emit('scroll');
    assert.equal(state.dialog, null); assert.deepEqual(state.pageSnapshot(), state.before);
  }
  const closingDay = load({ date: '2026-11-30T23:59:00Z' }); closingDay.tick(6000); assert.ok(closingDay.dialog?.open);
  const midnight = load({ date: '2026-11-30T23:59:58Z' }); midnight.tick(6000); assert.equal(midnight.dialog, null);
});
check('Exact pop-up content, accessible name/description and claim link', () => {
  const state = load(); state.tick(6000); const dialog = state.dialog;
  assert.equal(dialog.getAttribute('aria-labelledby'), 'launch-offer-heading');
  assert.equal(dialog.getAttribute('aria-describedby'), 'launch-offer-summary launch-offer-terms');
  assert.equal(dialog.querySelector('.launch-offer-dialog__eyebrow').textContent, 'Launch offer');
  assert.equal(dialog.querySelector('.launch-offer-dialog__heading').textContent, 'The next 5 new learners get their first 3 sessions free');
  assert.equal(dialog.querySelector('.launch-offer-dialog__summary').textContent, 'Book by 30 November.');
  assert.equal(dialog.querySelector('.launch-offer-dialog__terms').textContent, 'New learners only, one per family. Sessions used within 6 weeks; after that, the agreed band applies.');
  assert.equal(dialog.querySelector('a').getAttribute('href'), 'contact.html');
  assert.equal(dialog.querySelector('a').getAttribute('data-offer'), 'launch');
});
check('Esc, backdrop, close button and Maybe later remove the dialog and return focus', () => {
  for (const method of ['cancel', 'backdrop', 'close', 'later']) {
    const state = load(); state.tick(6000); const dialog = state.dialog;
    assert.equal(state.document.activeElement, dialog.querySelector('a'));
    if (method === 'cancel') assert.equal(dialog.emit('cancel').defaultPrevented, true);
    if (method === 'backdrop') dialog.emit('click', { target: dialog, clientX: 0, clientY: 0 });
    if (method === 'close') dialog.querySelector('.launch-offer-dialog__close').emit('click');
    if (method === 'later') dialog.querySelector('.launch-offer-dialog__later').emit('click');
    assert.equal(state.dialog, null); assert.equal(state.document.activeElement, state.returnFocus);
    assert.deepEqual(state.pageSnapshot(), state.before); state.tick(60000); state.window.emit('scroll'); assert.equal(state.dialog, null);
  }
});
check('Tab and Shift+Tab wrap within the native modal', () => {
  const state = load(); state.tick(6000); const dialog = state.dialog;
  dialog.querySelector('.launch-offer-dialog__later').focus(); dialog.emit('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(state.document.activeElement, dialog.querySelector('.launch-offer-dialog__close'));
  dialog.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(state.document.activeElement, dialog.querySelector('.launch-offer-dialog__later'));
});
check('Remember shown visitors for exactly 14 days; recheck storage at trigger time', () => {
  const first = load(); first.tick(6000); first.dialog.close();
  const shownAt = Number(first.storage.get('toucan-launch-offer-last-shown'));
  const during = load({ storage: first.storage, date: new Date(shownAt + 14 * 86400000 - 1).toISOString() }); during.tick(60000); assert.equal(during.dialog, null);
  const after = load({ storage: first.storage, date: new Date(shownAt + 14 * 86400000).toISOString() }); after.tick(6000); assert.ok(after.dialog?.open);
  const otherTab = load(); otherTab.storage.set('toucan-launch-offer-last-shown', String(otherTab.clock.now)); otherTab.tick(6000); assert.equal(otherTab.dialog, null);
});
check('Storage denial and a hidden tab are handled without changing the page', () => {
  const state = load({ storageThrows: true }); state.document.hidden = true; state.tick(6000); assert.equal(state.dialog, null);
  state.document.hidden = false; state.document.emit('visibilitychange'); assert.ok(state.dialog?.open);
  state.dialog.close(); state.tick(60000); assert.equal(state.dialog, null); assert.deepEqual(state.pageSnapshot(), state.before);
});
check('Only hidden offer attribution changes; existing service and UTM patterns remain', () => {
  for (const service of ['children', 'english-work', 'ielts', 'qualifications', 'languages', 'maths', 'in-person', 'not-sure', 'unknown', '']) {
    const tagged = load({ path: 'contact.html', query: `?offer=launch&service=${service}` });
    assert.equal(tagged.document.getElementById('campaign-source').value, 'launch-offer');
    assert.deepEqual(tagged.pageSnapshot(), tagged.before);
    const ordinary = load({ path: 'contact.html', query: `?service=${service}` });
    assert.equal(ordinary.document.getElementById('campaign-source').value, ['unknown', ''].includes(service) ? 'Direct or unknown' : service);
  }
  const state = load({ query: '?utm_source=test&utm_medium=site&utm_campaign=launch' }); state.tick(6000);
  assert.equal(state.dialog.querySelector('a').getAttribute('href'), 'contact.html');
  assert.equal(state.dialog.querySelector('a').getAttribute('data-offer'), 'launch');
});
await mkdir(output, { recursive: true });
await writeFile(new URL('source-report.json', output), JSON.stringify({ status: 'PASS', revision: 'popup-only', pages, checks, browser: 'Not run; Claude must rerun tests/launch-offer.mjs with BASE_URL.' }, null, 2) + '\n');
console.log(`PASS: ${checks.length} offline checks across ${pages.length} site pages. Browser layout unverified.`);
