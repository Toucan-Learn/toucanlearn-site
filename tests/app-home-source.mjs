// Browser-free checks for the phone app homepage (owner-approved mock v2, 4 Nov).
// Browser behaviour, the stubbed booking submission and the desktop pixel diff: tests/app-home-browser.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { withoutAppHome } from './helpers/app-home-markup.mjs';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [home, contact, css, script] = await Promise.all(['index.html', 'contact.html', 'app-home.css', 'app-home.js'].map(read));
const block = home.match(/<!-- app-home:start -->([\s\S]*?)<!-- app-home:end -->/)[1];

// Isolation: removing the block, its sheet/scripts and the shared form hosts gives back the previous homepage exactly.
const previous = execFileSync('git', ['show', 'a1c5c6d:index.html'], { cwd: root, encoding: 'utf8' });
assert.equal(withoutAppHome(home), previous, 'Only the isolated phone additions changed in index.html');
assert.match(block, /^\s*<!--[^\n]*-->\s*<div class="app-home home-phone-only" data-app-home>/, 'Desktop hides the whole block (opening-offer.css: .home-phone-only)');
assert.match(home, /<link rel="stylesheet" media="\(max-width: 767px\)" href="app-home\.css\?v=20261104-app-1" \/>/);
assert.match(script, /if \(!root \|\| !phone\.matches\) return;/, 'Script does nothing above phone width');
assert.match(css, /^\.homepage \{/m);
assert.doesNotMatch(css, /@import/);

// Nothing in the block downloads on desktop: lazy images, or the hero toucan blanked by a min-width source.
for (const [img] of block.matchAll(/<img\b[^>]*>/g)) {
  const before = block.slice(Math.max(0, block.indexOf(img) - 200), block.indexOf(img));
  const blanked = /<source media="\(min-width: 768px\)" srcset="data:image\/gif;base64,[^"]+" \/>$/.test(before);
  assert(/loading="lazy"/.test(img) || blanked || /src="data:/.test(img), `Desktop never fetches ${img.slice(0, 80)}`);
}
// Drink frames are only requested after the projects card is on screen with the drink in front.
assert.match(script, /if \(reduced \|\| slide\.spinTimer \|\| !projectsInView\) return;/);

// The booking sheet is the contact page's short enquiry form: same endpoint, mode, names and handler.
const formOf = html => html.match(/<form\b[^>]*id="enquiry-form"[\s\S]*?<\/form>/)[0];
const attr = (html, name) => html.match(new RegExp(`${name}="([^"]+)"`))[1];
const names = html => [...formOf(html).matchAll(/\bname="([^"]+)"/g)].map(m => m[1]).sort();
assert.deepEqual(names(home), names(contact), 'Same field names as the contact form');
assert.deepEqual(names(home), ['Campaign name', 'Campaign source', 'Contact name', 'Email or phone', 'Support requested', 'Traffic medium', 'Traffic source', 'loaded_at', 'website']);
assert.equal(attr(formOf(home), 'data-form-endpoint'), attr(formOf(contact), 'data-form-endpoint'));
assert.equal(attr(formOf(home), 'data-enquiry-mode'), 'short');
assert.doesNotMatch(formOf(home), /data-success-message/, 'Success goes to the thank-you page, as on the contact page');
for (const id of ['enquiry-fields', 'submit-button', 'form-message', 'loaded-at', 'campaign-source', 'contact-name-error', 'reply-contact-error', 'support-needed-error'])
  assert(formOf(home).includes(`id="${id}"`), `contact.js finds #${id}`);
assert.equal(home.match(/src="contact\.js\?v=([^"]+)"/)[1], contact.match(/src="contact\.js\?v=([^"]+)"/)[1]);
assert(home.indexOf('src="contact.js') > home.indexOf('id="enquiry-form"'), 'contact.js runs after the form is parsed');
const connect = html => html.match(/connect-src ([^;]+);/)[1].split(' ');
for (const host of ['https://script.google.com', 'https://script.googleusercontent.com']) {
  assert(connect(contact).includes(host)); assert(connect(home).includes(host), `CSP lets the sheet reach ${host}`);
}

// Copy rules.
const text = block.replace(/<[^>]+>/g, ' ');
assert.doesNotMatch(text, /psychologist/i);
assert.doesNotMatch(text, /Henley/);
assert.match(text, /Bristol, London and Oxfordshire/);
assert.doesNotMatch(text, /reply within|within (?:a|an|\d)[^.]*hours?|\d+\s*%/i, 'No reply times or invented stats');
assert.match(block, /<p class="ah-slogan" data-i18n-skip>Who can learn\?<br \/>You can learn\.<br \/>@toucan_learn<\/p>/, 'Slogan in three lines');
const cards = [...block.matchAll(/<article class="ah-rcard[\s\S]*?<\/article>/g)].map(m => m[0]);
assert.equal(cards.length, 3);
for (const card of cards) assert.match(card, /<span class="ah-badge">EXAMPLE<\/span> <span class="ah-rmeta">Example learner · Week 3<\/span>/, 'Every report card is labelled EXAMPLE');
assert.match(block, /Founder-led<\/li>/);
assert.equal((block.match(/data-ah-slide/g) || []).length, 4);
assert.deepEqual([...block.matchAll(/<article class="ah-story"[\s\S]*?<h3>([^<]+)<\/h3>/g)].map(m => m[1]), ['DARTY', 'Drink design', 'Football newspaper', 'Toucan piano']);
assert.equal((block.match(/<li class="ah-av ah-av--/g) || []).length, 8);
assert.match(css, /--ah-story-edge: rgba\(236, 230, 219, \.22\)/, 'Dark project cards get a lighter edge');
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.ah-hero-toucan \{ animation: none; \}/, 'Toucan bob stops under reduced motion');
assert.match(css, /@keyframes ah-bob \{ 50% \{ transform: translateY\(-6px\) rotate\(-1deg\); \} \}/, 'Toucan bob stays subtle');

// Language copies carry the block with translated words and English learner projects.
for (const lang of ['es', 'fr', 'it', 'vi']) {
  const copy = await read(`${lang}/index.html`);
  assert.match(copy, /data-app-home/);
  assert.match(copy, /href="\/app-home\.css\?v=20261104-app-1"/);
  assert.match(copy, /<h3>Drink design<\/h3>/);
  assert.doesNotMatch(copy.match(/<!-- app-home:start -->[\s\S]*?<!-- app-home:end -->/)[0], /<h2 id="ah-report-title">See a weekly report\.<\/h2>/);
}

// Above phone width the script returns before touching anything else.
{
  let queries = 0, images = 0;
  const context = vm.createContext({
    document: { querySelector: () => { queries++; return {}; } },
    window: { matchMedia: () => ({ matches: false }) },
    Image: class { constructor() { images++; } },
  });
  vm.runInContext(script, context);
  assert.equal(queries, 1); assert.equal(images, 0);
}
console.log('PASS: isolated phone block, desktop-hidden and lazy, same enquiry form/endpoint/handler, CSP hosts, copy rules, EXAMPLE labels, language copies.');
