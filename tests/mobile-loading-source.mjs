// Browser-free scheduling and discovery checks for mobile audit fixes 7-9.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { openingCSS, openingPages } from '../scripts/build-opening-css.mjs';
const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const sheets = html => [...html.matchAll(/<link rel="stylesheet"(?: data-deferred-style media="print")? href="([^"?]+)[^"]*"/g)].map(match => match[1]);
for (const page of openingPages) {
  const html = read(`${page}.html`);
  const original = execFileSync('git', ['show', `a6c095a:${page}.html`], { cwd: root, encoding: 'utf8' });
  const complete = sheets(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '')).filter(file => !file.startsWith('assets/css/opening-') && file !== 'opening-offer.css');
  assert.deepEqual(complete, sheets(original), `${page}: full cascade order is preserved`);
  assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0], original.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0]);
  assert.doesNotMatch(html, /\s(?:style|on\w+)\s*=/i, `${page}: CSP has no inline handlers or styles`);
  const css = openingCSS(html, read);
  assert.equal(read(`assets/css/opening-${page}.css`).split('\n').slice(1).join('\n'), css, `${page}: generated opening CSS is current`);
  const fullSize = [...html.matchAll(/data-deferred-style[^>]*href="([^"?]+)/g)].reduce((size, match) => size + Buffer.byteLength(read(match[1])), 0);
  assert(Buffer.byteLength(css) < fullSize * .5, `${page}: less than half the shared CSS blocks rendering`);
  assert.doesNotMatch(css, /url\(["']?(?!\/|data:|https?:|#)[\w.]/i, `${page}: relocated CSS resolves images from the site root`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${page}: unique IDs`);
  for (const [, targets] of html.matchAll(/\baria-(?:describedby|labelledby)="([^"]+)"/g)) {
    for (const id of targets.split(/\s+/)) assert(ids.includes(id), `${page}: accessible reference ${id}`);
  }
  assert(html.includes('Weekly written reports. Our founder oversees every lesson.'), `${page}: early oversight and reports`);
  assert(html.includes('Google ★★★★★ · Facebook recommendations'), `${page}: Google stars stay distinct from Facebook recommendations`);
  assert.match(html, /<p class="opening-guarantee">If your first paid lesson isn't right, you don't pay, or we switch tutor at no cost\.<\/p>/);
  assert.match(html, /<p class="opening-review"><q>Great tutor experience\.<\/q> <a href="https:\/\/search\.google\.com\/local\/reviews\?placeid=/, `${page}: existing review excerpt with its source`);
  if (!['index', 'contact'].includes(page)) {
    const headingEnd = html.indexOf('</h1>');
    const introEnd = html.indexOf(page === 'team' ? '<div class="team-page-layout">' : '<div class="container framework-shell"');
    const intro = html.slice(headingEnd, introEnd);
    assert(intro.includes('Your first session and diagnostic report are free.'), `${page}: offer precedes tabs and introductions`);
    assert.match(intro, /href="contact#enquiry-form"[^>]*>Book a free session/);
  }
}
const guaranteeClause = /<section><h2>Our first-lesson guarantee<\/h2>.*?<\/section>/;
assert.equal(read('terms.html').match(guaranteeClause)[0], execFileSync('git', ['show', '0f19736:terms.html'], { cwd: root, encoding: 'utf8' }).match(guaranteeClause)[0]);
const vietnam = read('hoc-tieng-anh.html');
assert.match(vietnam, /Buổi học đầu tiên miễn phí\.<\/p>\s*<p><a class="button trial-button trial-button--light-surface" href="#enquiry-form">Đăng ký buổi học thử miễn phí<\/a><\/p>/);
assert(vietnam.indexOf('href="#enquiry-form">Đăng ký buổi học thử miễn phí') < vietnam.indexOf('class="vietnam-teachers"'));
assert.doesNotMatch(read('index.html'), /rel="preload"[^>]*(?:galaxy-noise|toucan-logo-flat)/);
assert.match(read('index.html'), /toucan-piano-home-og[^>]*loading="lazy"[^>]*fetchpriority="low"/);
assert.doesNotMatch(read('project-showcase.css'), /not\(\[data-enhanced\]\)[^{]+\{\s*visibility: hidden/);
assert.match(read('project-showcase-loader.js'), /\(\) => import\('\.\/project-showcase\.js/);
assert.match(read('reviews-enquiry-sky-loader.js'), /\(\) => import\('\.\/reviews-enquiry-sky\.js/);

// A module is discovered only near its art, after two paint opportunities and
// full CSS readiness. Repeated observer callbacks never initialise it twice.
for (const supportsObserver of [true, false]) {
  let callback, margin, disconnected = 0, calls = 0, release;
  const frames = [], targets = [{ id: 'art' }];
  const styles = new Promise(resolve => { release = resolve; });
  class Observer {
    constructor(fn, options) { callback = fn; margin = options.rootMargin; }
    observe(target) { assert.equal(target, targets[0]); }
    disconnect() { disconnected++; }
  }
  const context = vm.createContext({
    document: { querySelectorAll: () => targets }, window: { toucanStylesReady: styles },
    requestAnimationFrame: fn => frames.push(fn), ...(supportsObserver ? { IntersectionObserver: Observer } : {}),
  });
  const module = new vm.SourceTextModule(read('near-visibility.js'), { context });
  await module.link(() => { throw Error('No eager dependencies'); }); await module.evaluate();
  module.namespace.nearVisibility('[data-showcase]', () => { calls++; });
  assert.equal(calls, 0); frames.shift()(); assert.equal(calls, 0); frames.shift()();
  if (supportsObserver) {
    assert.equal(margin, '300px'); callback([{ isIntersecting: false }]); assert.equal(calls, 0);
    callback([{ isIntersecting: true }]); callback([{ isIntersecting: true }]);
    assert.equal(disconnected, 1);
  }
  assert.equal(calls, 0); release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
}
// Full sheets activate together, at their existing positions, after loading.
{
  const frames = [], events = new Map(); let resized = 0;
  const first = { sheet: {}, media: 'print' };
  const second = { media: 'print', addEventListener: (type, fn) => events.set(type, fn) };
  const window = { dispatchEvent: () => resized++ };
  vm.runInNewContext(read('deferred-styles.js'), { document: { querySelectorAll: () => [first, second] }, window, Event, requestAnimationFrame: fn => frames.push(fn) });
  await Promise.resolve(); assert.equal(frames.length, 0);
  events.get('load')(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.media, 'print'); frames.shift()(); assert.equal(first.media, 'print'); frames.shift()();
  await window.toucanStylesReady;
  assert.deepEqual([first.media, second.media, resized], ['all', 'all', 1]);
}
console.log('PASS: opening CSS size, exact full cascade order, generated assets, CSP, accessible references, deferred images, near-visibility imports, paint scheduling and CSS readiness.');
