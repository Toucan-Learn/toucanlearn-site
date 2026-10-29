// Offline behavioural checks. Browser rendering is covered by clean-navigation.mjs.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fixture } from './helpers/navigation-dom.mjs';
import { homeNavigationMarkup } from './helpers/navigation-markup.mjs';
const root = new URL('../', import.meta.url);
const token = '20261029-clean-url-1';
let checks = 0;
const clean = page => { assert.equal(page.location.hash, ''); assert.equal(page.history.length, 1); assert(!page.calls.some(call => call.kind === 'push')); checks++; };
const hrefBefore = '<a href="index.html">Home</a><a href="index.html#reviews">Reviews</a>';
assert.equal(homeNavigationMarkup(hrefBefore), '<a href="./">Home</a><a href="./#reviews">Reviews</a>');
for (const unrelated of ['<p>index.html#reviews</p>', '<a href="contact.html?service=children">Enquire</a>', '<link href="assets/toucan-favicon.png?v=rounded">', '<link href="framework.css?v=changed">']) assert.equal(homeNavigationMarkup(unrelated), unrelated, 'The homepage link exception must not hide other changes');

for (const file of (await readdir(root)).filter(file => file.endsWith('.html'))) {
  const html = await readFile(new URL(file, root), 'utf8');
  assert.doesNotMatch(html, /href="index\.html(?:#|")/);
  assert.doesNotMatch(html, /href="contact\.html\?/);
  for (const [, script, cache] of html.matchAll(/src="((?:menu|content-panels|team-carousel|team-deck|campaigns|launch-offer|project-showcase|project-viewer)\.js)(?:\?v=([^"]+))?"/g)) assert.equal(cache, script === 'campaigns.js' ? '20261029-attribution-2' : token, `${file}: ${script} cache token`);
  if (file === 'contact.html') {
    assert(html.indexOf('src="campaigns.js') < html.indexOf('src="menu.js'), `${file}: capture campaigns before URL cleanup`);
    assert(html.indexOf('src="campaigns.js') < html.indexOf('</head>'), `${file}: campaign capture runs before the form is parsed`);
  }
}
for (const suffix of ['', '#team', '#%ZZ', '#missing']) {
  const page = fixture('https://example.test/site/index.html?project=darty&sky=night&reviewart=a,b' + suffix);
  const main = page.node('main', { id: 'main' }), team = page.node('section', { id: 'team' });
  const skip = page.node('a', { href: '#main' }); page.document.body.append(main, team, skip);
  await page.run('menu.js');
  assert.equal(page.location.pathname, '/site/');
  await page.load(); clean(page);
  assert.equal(page.location.search, '?project=darty&sky=night&reviewart=a,b');
  assert.equal(page.history.state.retained, true);
  assert(page.click(skip).defaultPrevented); assert.equal(page.document.activeElement, main); clean(page);
  assert(!page.click(skip, { ctrlKey: true }).defaultPrevented);
  assert(!page.click(skip, { button: 1 }).defaultPrevented);
}
{
  const page = fixture('https://example.test/index.html?unused=remove&project=darty&song=runaway');
  await page.run('menu.js'); await page.load();
  assert.equal(page.location.search, '?project=darty&song=runaway'); clean(page);
}

for (const wide of [true, false]) {
  const page = fixture('https://example.test/children.html#project-two', new Map(), wide);
  const shell = page.node('div', { 'data-content-panels': '' }), viewport = page.node('div', { class: 'framework-panels' });
  const first = page.node('section', { id: 'overview', 'data-content-panel': '' }); first.append(page.node('h2'));
  const projects = page.node('section', { id: 'learner-projects', 'data-content-panel': '' }); projects.append(page.node('h2'));
  const links = ['overview', 'learner-projects'].map(id => page.node('a', { href: '#' + id, 'data-panel-link': '' }));
  const viewer = page.node('div', { 'data-project-viewer': '' });
  const slides = ['project-one', 'project-two'].map(id => page.node('article', { id, 'data-project-slide': '' }));
  viewer.append(...slides, page.node('button', { 'data-project-prev': '' }), page.node('button', { 'data-project-next': '' }), page.node('span', { 'data-project-status': '' }));
  projects.append(viewer); viewport.append(first, projects); shell.append(...links, viewport); page.document.body.append(shell);
  await page.run('menu.js'); await page.run('content-panels.js'); await page.run('project-viewer.js'); await page.load();
  assert(!projects.hidden && first.hidden); assert(!slides[1].hidden && slides[0].hidden); clean(page);
  page.emit(page.window, 'pageshow'); assert(!projects.hidden, 'pageshow preserves the selected panel after cleanup');
  page.click(links[0]); assert(!first.hidden && projects.hidden); assert.equal(page.document.activeElement, first.querySelector('h2')); clean(page);
  const nested = page.node('a', { href: '#project-one' }); page.document.body.append(nested);
  page.click(nested); assert(!projects.hidden && !slides[0].hidden && slides[1].hidden, 'A nested deep link reveals both the panel and its project'); clean(page);
  page.incoming('#overview', 'popstate'); assert(!first.hidden); clean(page);
  page.emit(page.window, 'popstate'); assert(!first.hidden);
}

{
  const page = fixture('https://example.test/#profile-two');
  const viewer = page.node('div', { 'data-profile-viewer': '' });
  const slides = ['profile-one', 'profile-two'].map(id => { const slide = page.node('article', { id, 'data-profile-slide': '' }); slide.append(page.node('h2')); return slide; });
  const previous = page.node('button', { 'data-profile-prev': '' }), next = page.node('button', { 'data-profile-next': '' });
  const link = page.node('a', { 'data-profile-link': '', href: '#profile-one' });
  viewer.append(...slides, previous, next, page.node('span', { 'data-profile-status': '' })); page.document.body.append(viewer, link);
  await page.run('menu.js'); await page.run('team-carousel.js'); await page.load(); assert(!slides[1].hidden); clean(page);
  page.click(link); assert(!slides[0].hidden); assert.equal(page.document.activeElement, slides[0].querySelector('h2')); clean(page);
  page.click(next); assert(!slides[1].hidden); clean(page);
  const ordinary = page.node('a', { href: '#profile-one' }); page.document.body.append(ordinary);
  page.click(ordinary); assert(!slides[0].hidden); clean(page);
}

{
  const page = fixture('https://example.test/team.html#aaron');
  const deck = page.node('div', { 'data-team-deck': '' }), stage = page.node('div', { class: 'team-deck-stage' }), ring = page.node('div', { class: 'team-profiles' });
  const cards = ['joshua', 'aaron', 'connor'].map(id => { const card = page.node('article', { id, 'data-team-card': '' }); card.append(page.node('h2', {}, id)); return card; });
  const next = page.node('button', { 'data-team-next': '' });
  ring.append(...cards); stage.append(ring); deck.append(stage, next, page.node('button', { 'data-team-prev': '' }), page.node('span', { 'data-team-status': '' })); page.document.body.append(deck);
  await page.run('menu.js'); await page.run('team-deck.js'); await page.load(); assert(cards[1].hasAttribute('aria-current')); clean(page);
  page.click(next); assert(cards[2].hasAttribute('aria-current')); clean(page);
  page.emit(deck, 'keydown', { key: 'Home' }); assert(cards[0].hasAttribute('aria-current')); clean(page);
  const link = page.node('a', { href: '#aaron' }); page.document.body.append(link); page.click(link); assert(cards[1].hasAttribute('aria-current')); clean(page);
}

{
  const storage = new Map();
  const origin = fixture('https://example.test/children.html?utm_source=test&utm_medium=site&utm_campaign=launch', storage);
  const link = origin.node('a', { href: 'contact.html', 'data-service': 'children' }); origin.document.body.append(link);
  await origin.run('campaigns.js'); await origin.run('menu.js'); await origin.load();
  assert.equal(origin.location.search, ''); origin.click(link); assert.equal(link.getAttribute('href'), 'contact.html'); clean(origin);
  const contact = fixture('https://example.test/contact.html', storage);
  for (const id of ['campaign-source', 'traffic-source', 'traffic-medium', 'campaign-name']) contact.document.body.append(contact.node('input', { id }));
  await contact.run('campaigns.js'); await contact.run('menu.js'); await contact.load();
  assert.equal(contact.document.getElementById('campaign-source').value, 'children');
  assert.equal(contact.document.getElementById('traffic-source').value, 'test');
  assert.equal(contact.document.getElementById('traffic-medium').value, 'site');
  assert.equal(contact.document.getElementById('campaign-name').value, 'launch'); clean(contact);
  const claim = origin.node('a', { href: 'contact.html', 'data-offer': 'launch' }); origin.document.body.append(claim); origin.click(claim);
  await contact.run('campaigns.js'); assert.equal(contact.document.getElementById('campaign-source').value, 'launch-offer');
}
{
  // Campaign capture runs before the form is parsed and before menu cleanup.
  const storage = new Map();
  const origin = fixture('https://example.test/children.html?utm_source=test&utm_medium=site&utm_campaign=launch', storage);
  await origin.run('campaigns.js'); await origin.run('menu.js'); await origin.load();
  const link = origin.node('a', { href: 'contact.html', 'data-service': 'children' }); origin.document.body.append(link); origin.click(link);
  const contact = fixture('https://example.test/contact.html', storage);
  await contact.run('campaigns.js'); await contact.run('menu.js');
  const expected = { 'campaign-source': 'children', 'traffic-source': 'test', 'traffic-medium': 'site', 'campaign-name': 'launch' };
  for (const id of Object.keys(expected)) { const field = contact.node('input', { id }); field.value = id === 'campaign-source' ? 'Direct or unknown' : ''; contact.document.body.append(field); }
  await Promise.resolve();
  for (const [id, value] of Object.entries(expected)) assert.equal(contact.document.getElementById(id).value, value, `Campaign fields populated during parsing: ${id}`);
  contact.emit(contact.document, 'DOMContentLoaded'); await contact.load();
  for (const [id, value] of Object.entries(expected)) assert.equal(contact.document.getElementById(id).value, value, `Parser-time campaign fields: ${id}`);
  contact.document.getElementById('campaign-source').value = 'Direct or unknown';
  contact.emit(contact.window, 'pageshow', { persisted: true });
  assert.equal(contact.document.getElementById('campaign-source').value, 'children', 'Restore retains captured enquiry context'); clean(contact);
}
{
  const html = await readFile(new URL('projects/football-journalism/index.html', root), 'utf8');
  const script = html.match(/src="(\.\/assets\/[^"?]+\.js)/)[1];
  const source = await readFile(new URL('projects/football-journalism/' + script, root), 'utf8');
  const route = source.slice(source.indexOf('/* Clean newspaper navigation. */'), source.indexOf('(0,f.createRoot)'));
  assert(route.startsWith('/* Clean newspaper navigation. */'), 'The active build has the clean route component');
  const page = fixture('https://example.test/projects/football-journalism/index.html#football/first');
  page.runCode(`var selectedRoute, effect; var d = { useState: value => [value, next => { selectedRoute = next; }], useEffect: fn => { effect = fn; } }; var p = { jsx: (_, props) => props }; var C; ${route}; te(); effect();`);
  assert.equal(page.runCode('selectedRoute'), '#football/first');
  assert.equal(page.location.pathname, '/projects/football-journalism/'); clean(page);
  const link = page.node('a', { href: '#football/second' }); page.document.body.append(link);
  assert(page.click(link).defaultPrevented); assert.equal(page.runCode('selectedRoute'), '#football/second'); clean(page);
  page.emit(page.window, 'popstate'); assert.equal(page.runCode('selectedRoute'), '#football/second', 'Restored clean entries preserve the article');
  link.setAttribute('href', '#football'); page.click(link); assert.equal(page.runCode('selectedRoute'), '#football'); clean(page);
}
console.log(`PASS: ${checks} navigation checks plus all home/enquiry links and changed JavaScript cache tokens. Rendering/browser history restoration still requires clean-navigation.mjs.`);
