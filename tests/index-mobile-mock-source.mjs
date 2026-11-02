// Browser-free isolation, offer, responsive and actual mock-controller checks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [html, home, css, script] = await Promise.all(['index-mobile-mock.html', 'index.html', 'index-mobile-mock.css', 'index-mobile-mock.js'].map(read));
assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive"/);
assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0], home.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0]);
let copy = html.replace(/  <meta name="robots"[^>]*>\n/, '')
  .replace(/  <link rel="stylesheet" href="index-mobile-mock\.css[^\n]+\n/, '')
  .replace(/  <script src="index-mobile-mock\.js[^\n]+\n/, '')
  .replace(' data-mobile-mock>', '>');
for (const name of ['offer', 'subjects', 'bar']) copy = copy.replace(new RegExp(`^[ \\t]*<!-- mobile-mock-${name}:start -->[\\s\\S]*?<!-- mobile-mock-${name}:end -->\\n`, 'm'), '');
assert.equal(copy, home, 'Removing the isolated hidden additions exactly reconstructs the current index.html');
assert.doesNotMatch(home, /index-mobile-mock/);
assert.doesNotMatch(await read('sitemap.xml'), /index-mobile-mock/);
for (const sentence of ['One-to-one tutoring for children and adults.', 'Free first session and diagnostic report.', "If your first paid lesson isn't right, you don't pay, or we switch tutor at no cost.", 'We usually reply within a couple of hours, especially on WhatsApp.']) assert(html.includes(sentence));
assert.match(html, /One learner · mock to mock/);
assert.match(html, /31%<\/strong><span>more IB points<\/span><\/div>/);
const stats = html.match(/<div class="mobile-mock-stats"[^>]*>([\s\S]*?)\n          <\/div>/)[1];
assert.equal((stats.match(/<div>/g) || []).length, 3);
assert.doesNotMatch(stats, /<small>/, 'Qualifiers sit below the equal stat columns');
assert.match(html, /<small class="mobile-mock-stats-note">Up 2: One learner · mock to mock · 31%: From the review<\/small>/);
const offerMarkup = html.match(/<!-- mobile-mock-offer:start -->([\s\S]*?)<!-- mobile-mock-offer:end -->/)[1];
const ordered = ['id="mobile-mock-title"', 'class="mobile-mock-audience"', 'class="mobile-mock-free"', 'class="mobile-mock-stars"', 'class="mobile-mock-stats"', 'class="mobile-mock-stats-note"', 'class="mobile-mock-guarantee"', 'href="/contact"', 'class="mobile-mock-reply"'].map(marker => offerMarkup.indexOf(marker));
assert(ordered.every((position, index) => position >= 0 && (!index || position > ordered[index - 1])), 'The complete offer is in the owner-approved reading order');
assert.match(css, /\.mobile-mock-offer h1\s*\{\s*display: block;/);
assert.doesNotMatch(css, /height: calc\(100svh|margin-top: auto|min-height: 680px/, 'The opening uses its content height with no auto-spacer before the button');
assert.match(css, /\.framework-portrait-frame--joshua > \.framework-portrait\s*\{\s*max-width: none; width: 220%; height: auto; left: -42%; top: -82%;/);
assert.match(html, /href="https:\/\/wa.me\/447307045816"/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /scroll-snap-type: x mandatory/);
assert.doesNotMatch(html, /\s(?:style|on\w+)\s*=/i);
// All new CSS, including the short-screen fallback, is phone-only.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
let depth = 0, start = 0, quote = '';
for (let i = 0; i < stripped.length; i++) {
  const ch = stripped[i];
  if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
  if (ch === '"' || ch === "'") { quote = ch; continue; }
  if (ch === '{') {
    if (!depth) assert.match(stripped.slice(start, i).trim(), /^@media screen and \(max-width: 700px\)/);
    depth++;
  } else if (ch === '}') { assert(--depth >= 0); if (!depth) start = i + 1; }
}
assert.equal(depth, 0);

class Node {
  constructor(tag = 'div', classes = '') { this.tag = tag; this.classes = classes; this.children = []; this.attrs = new Map(); this.events = new Map(); this.hidden = false; this.tabIndex = -1; this.scrollLeft = 0; this.rect = { top: 900, bottom: 1000, left: 16, width: 358 }; }
  append(child) { this.children.push(child); child.parent = this; }
  after(child) { this.afterNode = child; }
  matches(selector) { return selector === '.reviews-grid' ? this.classes === 'reviews-grid' : selector.includes('input:not(') ? !!this.editing : selector.split(',').map(word => word.trim()).includes(this.tag); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  closest() { return this.orbit; }
  getBoundingClientRect() { return this.parent?.step ? { ...this.rect, left: 16 + this.index * this.parent.step - this.parent.scrollLeft } : this.rect; }
  getClientRects() { return this.hidden ? [] : [this.rect]; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(selector === '[aria-hidden="true"]' && child.attrs.get('aria-hidden') === 'true' ? [child] : []), ...child.querySelectorAll(selector)]); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  addEventListener(name, callback) { const events = this.events.get(name) || []; events.push(callback); this.events.set(name, events); }
  emit(name) { for (const callback of this.events.get(name) || []) callback({ target: this, stopImmediatePropagation() {}, preventDefault() {} }); }
  scrollTo({ left }) { this.scrollLeft = left; this.emit('scroll'); }
  scrollBy({ left }) { this.scrollTo({ left: this.scrollLeft + left }); }
  get dataset() { return this.data ||= {}; }
}
const offer = new Node(), bar = new Node(), footer = new Node(), header = new Node(), subjects = new Node();
offer.rect = { top: 64, bottom: 844, left: 16, width: 358 }; bar.hidden = true;
footer.rect.top = 6000; footer.rect.bottom = 6300; header.rect.bottom = 64;
const rows = [new Node('div', 'audience-route-grid'), new Node('div', 'reviews-grid'), new Node('div', 'mobile-mock-subject-row')];
for (const [i, row] of rows.entries()) {
  row.step = 338; row.orbit = new Node();
  for (let n = 0; n < [2, 5, 7][i]; n++) {
    const card = new Node(i === 1 ? 'figure' : i === 2 ? 'a' : 'article'); card.index = n;
    const paragraph = new Node('blockquote'); paragraph.setAttribute('aria-hidden', 'true'); card.append(paragraph); row.append(card);
  }
}
const phone = new Node(); phone.matches = true;
const reduced = new Node(); reduced.matches = true;
const viewport = new Node(); viewport.height = 844; viewport.scale = 1;
const window = new Node(); window.innerHeight = 844; window.visualViewport = viewport;
let forms = [];
const selectors = new Map([['.mobile-mock-offer', offer], ['.mobile-mock-bar', bar], ['.site-footer', footer], ['body > header', header], ['.audience-route-grid', rows[0]], ['.reviews-grid', rows[1]], ['.mobile-mock-subject-row', rows[2]]]);
const document = new Node(); document.activeElement = new Node();
document.querySelector = selector => selectors.get(selector) || null;
document.querySelectorAll = selector => selector === '[data-mobile-mock-only]' ? [offer, bar, subjects] : forms;
document.createElement = tag => new Node(tag);
class Observer { observe() {} }
const context = vm.createContext({ window, document, innerHeight: 844, matchMedia: query => query.includes('max-width') ? phone : reduced, requestAnimationFrame: fn => fn(), MutationObserver: Observer, IntersectionObserver: Observer });
const instrumented = script.replace('  syncMode();\n})();', '  globalThis.controller = { syncBar, syncMode, dotSets };\n  syncMode();\n})();');
vm.runInContext(instrumented, context);
const controller = context.controller;
assert(controller);
assert.equal(offer.hidden, false);
assert.equal(bar.hidden, true, 'First-screen action suppresses sticky bar');
offer.rect.bottom = 65; controller.syncBar(); assert.equal(bar.hidden, true, 'Bar stays hidden until the whole offer clears the header');
offer.rect.bottom = 64; controller.syncBar(); assert.equal(bar.hidden, false, 'Bar appears when the first screen has passed');
footer.rect.top = 843; controller.syncBar(); assert.equal(bar.hidden, true, 'One-pixel footer entry hides bar');
footer.rect.top = 6000;
const form = new Node('form'); form.rect.top = 200; form.rect.bottom = 400; forms = [form];
controller.syncBar(); assert.equal(bar.hidden, true, 'Visible enquiry form suppresses bar'); forms = [];
document.activeElement.editing = true; controller.syncBar(); assert.equal(bar.hidden, true, 'Focused text input suppresses bar');
document.activeElement.editing = false; viewport.height = 600; controller.syncBar(); assert.equal(bar.hidden, true, 'Visual viewport shrink suppresses bar for keyboard');
viewport.height = 844; controller.syncBar(); assert.equal(bar.hidden, false);
for (const set of controller.dotSets) {
  set.dots.children.at(-1).emit('click');
  assert(set.row.scrollLeft > 0);
  assert.equal(set.dots.children.at(-1).getAttribute('aria-current'), 'true', 'Dots track native row scroll position');
}
assert(rows[1].children.every(card => card.tabIndex === 0 && !card.children[0].hasAttribute('aria-hidden')), 'Every native-scroll review is accessible');
phone.matches = false; controller.syncMode();
assert.equal(bar.hidden, true); assert.equal(offer.hidden, true); assert.equal(subjects.hidden, true);
assert(controller.dotSets.every(set => set.dots.hidden), 'Desktop hides every added control');
console.log('PASS: isolated noindex copy, unchanged CSP, phone-only CSS, qualified stats, sticky thresholds/footer/form/keyboard, swipe dots and desktop-hidden additions. Browser capture remains a separate check.');
