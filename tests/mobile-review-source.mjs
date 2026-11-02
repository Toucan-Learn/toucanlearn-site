// Execute the phone scroll controllers and their desktop restoration without a browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from './helpers/navigation-dom.mjs';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const css = await read('framework.css');
assert.match(css, /html body #main \.framework-portrait-frame--joshua > \.framework-portrait\s*\{\s*max-width: none; width: 220%; height: auto; left: -42%; top: -82%;/);
const home = await read('index.html');
const reviewCount = (home.match(/class="review-quote"/g) || []).length;
const teamCount = (home.match(/data-profile-slide/g) || []).length;

function scrollingFixture() {
  const page = fixture('https://example.test/');
  page.document.body.setAttribute('class', 'homepage');
  let phone = true;
  const changes = [];
  page.window.matchMedia = query => ({
    get matches() { return query.includes('max-width') ? phone : query.includes('min-width') ? !phone : true; },
    addEventListener(type, callback) { if (query.includes('max-width')) changes.push(callback); },
  });
  page.document.fonts.addEventListener = () => {};
  const row = page.node('div'); row.scrollLeft = 0;
  const scrolls = [];
  row.scrollTo = options => { scrolls.push(options.left); row.scrollLeft = options.left; page.emit(row, 'scroll'); };
  const cards = count => Array.from({ length: count }, (_, index) => {
    const card = page.node('article');
    card.getBoundingClientRect = () => ({ left: 16 + index * 300 - row.scrollLeft, width: 288, height: 300 });
    Object.defineProperty(card, 'offsetHeight', { value: 300 });
    return card;
  });
  row.getBoundingClientRect = () => ({ left: 16, width: 312, height: 300 });
  return { ...page, row, cards, scrolls, setPhone(value) { phone = value; changes.forEach(callback => callback()); } };
}

{
  const page = scrollingFixture();
  const viewer = page.node('div', { 'data-profile-viewer': '' });
  page.row.setAttribute('class', 'framework-profiles');
  const cards = page.cards(teamCount);
  for (const card of cards) { card.setAttribute('data-profile-slide', ''); page.row.append(card); }
  const previous = page.node('button', { 'data-profile-prev': '' });
  const next = page.node('button', { 'data-profile-next': '' });
  const status = page.node('span', { 'data-profile-status': '' });
  viewer.append(page.row, previous, next, status); page.document.body.append(viewer);
  await page.run('team-carousel.js');
  assert(cards.every(card => !card.hidden && !card.inert), 'Every native team card is readable and reachable');
  page.click(next); assert.equal(page.row.scrollLeft, 300); assert.equal(status.textContent, `2 of ${teamCount}`);
  page.row.scrollTo({ left: 600 }); assert.equal(status.textContent, `3 of ${teamCount}`);
  page.click(previous); assert.equal(page.row.scrollLeft, 300);
  page.setPhone(false); assert.equal(cards.filter(card => !card.hidden).length, 1, 'Desktop returns to one selected profile');
  const calls = page.scrolls.length; page.click(next); assert.equal(page.scrolls.length, calls, 'Desktop arrows retain the existing viewer');
  page.setPhone(true); assert(cards.every(card => !card.hidden && !card.inert));
}

{
  const page = scrollingFixture();
  const carousel = page.node('div', { 'data-reviews-carousel': '' });
  page.row.setAttribute('class', 'reviews-grid');
  const cards = page.cards(reviewCount);
  for (const card of cards) { card.setAttribute('class', 'review-quote'); card.append(page.node('blockquote'), page.node('figcaption')); page.row.append(card); }
  const status = page.node('p', { 'data-reviews-status': '' });
  carousel.append(page.row, status); page.document.body.append(carousel);
  await page.run('reviews-carousel.js'); await Promise.resolve();
  assert(cards.every(card => card.tabIndex === 0 && !card.hasAttribute('aria-hidden') && !card.querySelector('blockquote').hasAttribute('aria-hidden')));
  page.row.scrollTo({ left: 600 }); assert.equal(status.textContent, `Review 3 of ${reviewCount}`);
  page.emit(carousel, 'keydown', { key: 'ArrowRight', target: carousel }); assert.equal(page.row.scrollLeft, 900);
  const pointer = page.emit(page.row, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 100 });
  assert(!pointer.defaultPrevented, 'Native swiping keeps browser touch handling');
  page.setPhone(false); assert.equal(cards.filter(card => card.getAttribute('aria-current') === 'true').length, 1);
  assert.match(page.row.style.transform, /rotateY/, 'Desktop restores its existing review ring');
  page.setPhone(true); assert.equal(page.row.style.height, '');
  assert(cards.every(card => card.tabIndex === 0 && !card.hasAttribute('aria-hidden')), 'Resizing back restores every accessible review');
}
console.log('Mobile review regressions: native team/review swipes, controls, accessibility and desktop restoration pass.');
