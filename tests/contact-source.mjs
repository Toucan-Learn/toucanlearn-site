// Browser-free contact regression check: node tests/contact-source.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { contactMarkup } from './helpers/contact-markup.mjs';
import { navigationMarkup } from './helpers/navigation-markup.mjs';
import { fixture } from './helpers/navigation-dom.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
// Compare with the site just before the 30 Oct ad-landing form changes (HEAD would already contain them).
const baseline = file => execFileSync('git', ['show', `b698613:${file}`], { cwd: root, encoding: 'utf8' });
const html = await read('contact.html');
const script = await read('contact.js');
const dropdownScript = await read('subject-select.js');
const css = await read('contact.css');
const rules = createRequire(import.meta.url)('../contact.js');

const help = "Please don't include diagnoses or medical records; we'll talk through needs together.";
// 30 Oct: the owner-approved footer (Terms link, sole-trader line) replaces the old one.
const footer = html => html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
const expected = baseline('contact.html').replace(footer(baseline('contact.html')), footer(html))
  .replace('aria-describedby="support-needed-error"', 'aria-describedby="support-needed-privacy support-needed-error"')
  .replace('</textarea>', '</textarea>\n<small id="support-needed-privacy">' + help + '</small>')
  .replace('Use a UK number, starting with 0 or +44.', 'Use 7–15 digits; include + and the country code for international numbers.')
  .replace('>WhatsApp us<', '>WhatsApp 07307 045816<')
  // Owner, 30 Oct: the in-person area is Oxfordshire, not Henley.
  .replace(/Henley-on-Thames|Henley/g, 'Oxfordshire');
// Owner, 31 Oct: Microsoft Clarity (after cookie consent) adds its sources to the CSP and two consent tags; compare without them.
const withoutClarity = page => page.replace(" https://www.clarity.ms https://scripts.clarity.ms", "").replace(" https://*.clarity.ms https://c.bing.com", "").replace(" https://*.clarity.ms", "")
  .replace(/\n\s*<script src="consent\.js[^"]*"><\/script>/, "").replace(/\n\s*<link rel="stylesheet" href="consent\.css[^"]*" \/>/, "");
const untokened = page => page.replace(/\?v=[^"']+/g, '?v=T'); // stylesheet/script cache tokens change with every release
// Owner, 31 Oct: menus carry data-nosnippet so Google stops quoting them as the site description.
const withoutNosnippet = page => page.replace(/<nav data-nosnippet/g, '<nav');
// Owner, 30 Oct: the age field sits at the top of the details column, so choosing
// "child" pushes Subject down instead of opening a gap beside the name. Compare
// everything else with the age field back in its original place.
const ageBlock = page => page.match(/\n\s*<div class="field conditional-field" id="age-year-field"[\s\S]*?\n\s*<\/div>(?=\n)/)?.[0];
const ageBack = page => {
  const block = ageBlock(page);
  return block ? page.replace(block, '').replace(/(<span class="field-error" id="learner-child-error"><\/span>\s*<\/fieldset>)/, `$1${block}`) : page;
};
assert.ok(html.indexOf('id="age-year-field"') > html.indexOf('id="support-needed"') && html.indexOf('id="age-year-field"') < html.indexOf('id="subject"'), 'Age sits above Subject in the details column');
assert.equal(contactMarkup(untokened(ageBack(withoutClarity(withoutNosnippet(html))))), contactMarkup(untokened(withoutNosnippet(expected))),
  'Preserve field names, order, hooks, configuration and copy outside the requested help and phone labels');
// Owner, 31 Oct: the "Website visits" section now describes Microsoft Clarity; everything else stays as approved.
const visits = page => page.replace(/<section(?: id="website-visits")?>\s*<h2>Website visits and changes<\/h2>[\s\S]*?<\/section>/, '<!-- website visits: owner-managed -->');
const privacy = await read('privacy.html');
assert.match(privacy, /Microsoft Clarity[\s\S]*data-clarity-toggle/, 'Privacy explains Clarity and offers the switch');
assert.equal(navigationMarkup(untokened(visits(withoutClarity(withoutNosnippet(privacy))))), navigationMarkup(untokened(visits(execFileSync('git', ['show', '4409323:privacy.html'], { cwd: root, encoding: 'utf8' })))), 'Privacy matches the owner-approved 30 Oct notice');
assert.doesNotMatch(html, /support-needed-hint|The subject or goal, and what's tricky at the moment/);
assert.match(html, /<textarea id="support-needed"[^>]*aria-describedby="support-needed-privacy support-needed-error"[^>]*required/);
assert.ok(html.includes('<small id="support-needed-privacy">' + help + '</small>'));
assert.match(html, /href="tel:\+447309639095">07309 639095<\/a>/);
assert.match(html, /href="https:\/\/wa.me\/447307045816"[^>]*>WhatsApp 07307 045816</);
assert.match(html, /src="contact.js\?v=20261030-subject-sep-1"/);
assert.match(html, /href="contact.css\?v=20261030-subject-dropdown-3"/);
// Owner, 31 Oct: Microsoft Clarity is the only outside script.
assert.match(html, /script-src 'self' https:\/\/www\.clarity\.ms https:\/\/scripts\.clarity\.ms; style-src 'self'/);
assert.doesNotMatch(html, /\s(?:style|on\w+)\s*=/i);
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  assert.match(attrs, /\bsrc="[^"]+"/);
  assert.equal(body.trim(), '', 'Scripts remain external for the CSP');
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs remain unique');
for (const [, target] of html.matchAll(/\bfor="([^"]+)"/g)) {
  assert.ok(ids.includes(target), `Label target exists: ${target}`);
}
for (const [, targets] of html.matchAll(/\baria-(?:describedby|labelledby)="([^"]+)"/g)) {
  for (const target of targets.split(/\s+/)) assert.ok(ids.includes(target), `Accessible reference exists: ${target}`);
}

const originalSelect = page => page.match(/<select id="subject"[^>]*>[\s\S]*?<\/select>/)?.[0];
const previous = execFileSync('git', ['show', 'd87c6cc:contact.html'], { cwd: root, encoding: 'utf8' }); // Before the rejected chips.
assert.equal(originalSelect(html), originalSelect(previous), 'Restore exactly the previous native select markup');
const options = [...originalSelect(html).matchAll(/<option value="([^"]*)">([^<]+)<\/option>/g)]
  .map(([, value, label]) => [value.replaceAll('&amp;', '&'), label.replaceAll('&amp;', '&')]);
assert.deepEqual(options[0], ['', 'Choose a subject']);
const subjects = options.slice(1).map(([value, label]) => { assert.equal(value, label); return value; });
assert.deepEqual(subjects, ['English', 'Maths', 'Science', 'Languages', 'Psychology', 'Art & design', 'Exam preparation', 'SEN support', 'Other']);
assert.doesNotMatch(html + css, /subject-chip|subject-choice|subject-options|subject-reset|No preference/);
assert.match(html, /<label id="subject-label" for="subject">Subject \(optional\)<\/label>/);
assert.match(html, /<div class="subject-dropdown" data-subject-dropdown>/);
assert.match(html, /<div data-subject-control hidden>/, 'Only JS activates the custom control');
assert.match(html, /<button[^>]*id="subject-button"[^>]*type="button"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"[^>]*aria-controls="subject-listbox"[^>]*aria-labelledby="subject-label subject-value"[^>]*aria-describedby="subject-error"/);
assert.match(html, /<ul[^>]*id="subject-listbox"[^>]*role="listbox"[^>]*aria-labelledby="subject-label"[^>]*tabindex="-1" hidden/);
assert.match(html, /src="subject-select.js\?v=20261030-subject-dropdown-3"/);
assert.ok(html.indexOf('src="subject-select.js') < html.indexOf('src="contact.js'));
assert.match(dropdownScript, /Array.from\(select.options\)/, 'The native options drive the custom list');
assert.match(dropdownScript, /new Event\("change", \{ bubbles: true \}\)/);
assert.match(dropdownScript, /@license lucide-static v0.469.0 - ISC/);
assert.match(dropdownScript, /stroke="currentColor"/);
const iconData = JSON.parse(dropdownScript.match(/const icons = ([\s\S]*?);/)[1]);
assert.deepEqual(Object.keys(iconData), subjects, 'Only subject rows have icons');
// Owner, 30 Oct: a globe for Languages; SEN and Other swapped (SEN sparkles, Other plus).
const iconFiles = ['book-open', 'calculator', 'flask-conical', 'globe', 'brain', 'palette', 'clipboard-check', 'sparkles', 'plus'];
// Pin the supplied Lucide geometry, including line/rect/circle elements.
const expectedIcons = [
  '<path d="M12 7v14" />', '<rect width="16" height="20" x="4" y="2" rx="2" />',
  '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />',
  '<circle cx="12" cy="12" r="10" />', '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />',
  '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />', '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />',
  '<path d="M20 3v4" />', '<path d="M5 12h14" />'
];
subjects.forEach((subject, index) => assert.ok(iconData[subject][1].includes(expectedIcons[index]), `${subject}: ${iconFiles[index]}`));
assert.match(css, /\.subject-listbox \{[^}]*position: absolute;[^}]*inset-inline: 0;/);
assert.match(css, /\.subject-listbox \[role="option"\] \{[^}]*align-items: center;[^}]*justify-content: space-between;/);
assert.match(css, /\.subject-listbox svg \{[^}]*width: 18px;[^}]*height: 18px;/);
assert.match(css, /\.subject-button\):focus/);
assert.match(css, /\.subject-button\)\[aria-invalid="true"\]/);
for (const [subject, colour] of Object.entries({ english: '#6b2a5e', maths: '#0b5e5a', science: '#1f5640', languages: '#8a4b0b', psychology: '#3b2f7a', art: '#8a2450', sen: '#1d3a6b' })) {
  assert.ok(css.includes(`.subject-option--${subject} { --subject-ink: var(--subject-${subject}, ${colour}); }`), `${subject} uses its CTA colour`);
  assert.equal((css.match(new RegExp(`--subject-${subject}:`, 'g')) || []).length, 2, 'Both dark-mode paths provide a lighter tint');
}
// Exercise the actual dropdown script with keyboard/focus events. This fixture
// does not simulate rendering, browser Tab traversal or touch hit testing.
{
  const page = fixture('https://example.test/contact');
  page.runCode('globalThis.Event = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };');
  const form = page.node('form');
  const dropdown = page.node('div', { 'data-subject-dropdown': '' });
  dropdown.classList.remove = name => dropdown.classList.toggle(name, false);
  const select = page.node('select', { id: 'subject', name: 'Subject' });
  select.options = options.map(([value, textContent]) => ({ value, textContent }));
  let selectedIndex = 0;
  Object.defineProperties(select, {
    selectedIndex: { get: () => selectedIndex },
    value: { get: () => select.options[selectedIndex]?.value || '', set: value => { selectedIndex = select.options.findIndex(option => option.value === value); } }
  });
  select.form = form;
  const control = page.node('div', { 'data-subject-control': '' }); control.hidden = true;
  const button = page.node('button', { id: 'subject-button', 'aria-expanded': 'false' });
  const list = page.node('ul', { id: 'subject-listbox' }); list.hidden = true;
  const value = page.node('span', { id: 'subject-value' });
  const label = page.node('label', { id: 'subject-label', for: 'subject' });
  button.append(value); control.append(button, list); dropdown.append(select, control); form.append(label, dropdown); page.document.body.append(form);
  const create = page.document.createElement;
  page.document.createElement = tag => {
    const node = create(tag);
    Object.defineProperty(node, 'id', { get: () => node.attrs.id || '', set: value => { node.attrs.id = value; } });
    node.insertAdjacentHTML = (_, svg) => { node.icon = svg; };
    return node;
  };
  page.window.setTimeout = fn => fn();
  let changes = 0;
  form.addEventListener('change', event => { assert.equal(event.target, select); changes++; });
  await page.run('subject-select.js');
  assert.equal(select.hidden, true); assert.equal(control.hidden, false);
  assert.equal(label.getAttribute('for'), button.id);
  assert.equal(list.children.length, options.length);
  assert.equal(list.children[0].icon, undefined, 'The placeholder has no icon');
  assert.ok(list.children.slice(1).every(row => row.icon.includes('<svg')));
  const press = key => page.emit(page.document.activeElement, 'keydown', { key });
  const active = () => list.getAttribute('aria-activedescendant');
  page.click(button);
  assert.equal(button.getAttribute('aria-expanded'), 'true'); assert.equal(page.document.activeElement, list);
  assert.equal(active(), 'subject-option-0');
  press('ArrowDown'); press('ArrowDown'); assert.equal(active(), 'subject-option-2');
  assert.equal(select.value, '', 'Navigation does not commit an option');
  press('ArrowUp'); assert.equal(active(), 'subject-option-1');
  press('Enter'); assert.equal(select.value, 'English'); assert.equal(changes, 1);
  assert.equal(list.children[1].getAttribute('aria-selected'), 'true');
  assert.equal(list.hidden, true); assert.equal(page.document.activeElement, button);
  press('End'); assert.equal(active(), 'subject-option-9');
  press(' '); assert.equal(select.value, 'Other');
  press('Home'); press(' '); assert.equal(select.value, '');
  press('ArrowDown'); press('End'); press('Escape');
  assert.equal(select.value, ''); assert.equal(list.hidden, true); assert.equal(page.document.activeElement, button);
  press('ArrowUp'); assert.equal(list.hidden, false);
  assert.equal(press('Tab').defaultPrevented, undefined, 'Tab closes without preventing normal traversal');
  assert.equal(list.hidden, true);
  page.click(button); page.click(page.document.body);
  assert.equal(list.hidden, true); assert.equal(page.document.activeElement, button, 'Outside clicks restore button focus');
  page.click(button); page.click(list.children[3]);
  assert.equal(select.value, 'Science'); assert.equal(value.textContent, 'Science');
  select.value = 'Languages'; select.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(value.textContent, 'Languages', 'Native change events update the display');
  select.value = 'Maths'; page.emit(page.window, 'pageshow');
  assert.equal(value.textContent, 'Maths', 'Restored native state refreshes on pageshow');
  page.click(button); select.value = ''; page.emit(form, 'reset');
  assert.equal(list.hidden, true); assert.equal(value.textContent, 'Choose a subject');
}
const advertised = [...(await read('subjects.html')).matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)]
  .map(([, label]) => label.replaceAll('&amp;', '&').replace('SEND support', 'SEN support').replace('Art & DT', 'Art & design'));
assert.deepEqual(subjects, [...advertised.slice(0, -1), 'Exam preparation', advertised.at(-1), 'Other']);
assert.match(script, /new URLSearchParams\(new FormData\(form\)\)/, 'All named fields, including Subject, reach the POST payload');

// This checkout has no Apps Script source. Exercise the actual client submission
// with a local DOM/fetch stub; no request, email or other message leaves the test.
const now = 1793275200000;
const valid = { 'Contact name': 'Synthetic Test', Learner: 'adult', 'Support requested': 'Help with a course.',
  'Reply method': 'email', email: 'test@example.invalid', loaded_at: String(now - 5000) };
function enquiry(input, outcome = 'ok', { search = '', campaignSource, enhanced = true, markup = html, languageMessages } = {}) {
  const elements = new Map(), listeners = new Map(), documentListeners = new Map(), requests = [], redirects = [], timers = new Map();
  let focused;
  function node(id = '', attrs = {}) {
    const events = new Map();
    return { id, attrs, value: attrs.value || '', textContent: '', parts: [], disabled: false, hidden: false, inert: false,
      get checked() { return this._checked || false; },
      set checked(value) {
        if (value) for (const radio of elements.values()) {
          if (radio.attrs.type === 'radio' && radio.attrs.name === this.attrs.name) radio._checked = false;
        }
        this._checked = value;
      },
      addEventListener(type, fn) { const list = events.get(type) || []; list.push(fn); events.set(type, list); },
      dispatchEvent(event) { (events.get(event.type) || []).forEach(fn => fn(event)); if (event.bubbles) listeners.get(event.type)?.(event); },
      classList: { add() {}, remove() {} },
      getAttribute(key) { return this.attrs[key] ?? null; },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      replaceChildren(...parts) { this.parts = parts; },
      focus() { focused = id; }
    };
  }
  for (const [, tag] of markup.matchAll(/(<[\w-]+\b[^>]*\bid="[^"]+"[^>]*>)/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value.replaceAll('&amp;', '&')]));
    elements.set(attrs.id, node(attrs.id, attrs));
  }
  for (const element of elements.values()) {
    if (element.attrs.type === 'radio') element.checked = Object.hasOwn(input, element.attrs.name) && input[element.attrs.name] === element.value;
  }
  elements.get('subject').value = input.Subject || '';
  elements.get('subject').hidden = enhanced;
  if (campaignSource) elements.get('campaign-source').value = campaignSource;
  const form = elements.get('enquiry-form');
  form.dataset = { formEndpoint: form.attrs['data-form-endpoint'], successMessage: form.attrs['data-success-message'] };
  form.addEventListener = (type, fn) => listeners.set(type, fn);
  form.querySelector = selector => {
    const name = selector.match(/name="([^"]+)"/)[1];
    const value = selector.match(/\[value="([^"]*)"\]/)?.[1];
    return [...elements.values()].find(element => element.attrs.type === 'radio' && element.attrs.name === name
      && (selector.includes(':checked') ? element.checked : element.value === value)) || null;
  };
  form.querySelectorAll = selector => {
    const [, key, value] = selector.match(/^\[([\w-]+)="([^"]+)"\]$/);
    return [...elements.values()].filter(element => element.attrs[key] === value);
  };
  const context = vm.createContext({
    Date: { now: () => now }, URLSearchParams, AbortController,
    Event: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    FormData: class { constructor() {
      const body = new URLSearchParams(input);
      body.delete('Subject');
      body.set('Subject', elements.get('subject').value);
      return body;
    } },
    document: { getElementById: id => elements.get(id), createElement: () => node(),
      addEventListener: (type, fn) => documentListeners.set(type, fn) },
    window: { toucanFormMessages: languageMessages, location: { search, assign: value => redirects.push(value) },
      setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (outcome === 'network') throw new TypeError('Synthetic network error');
      if (outcome === 'timeout') {
        const aborted = new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Synthetic timeout'))));
        timers.get(1)(); return aborted;
      }
      return { ok: outcome !== 'http-error', json: async () => ({ ok: outcome !== 'rejected' }) };
    }
  });
  vm.runInContext(script, context);
  return { elements, requests, redirects, timers, get focused() { return focused; },
    ready: () => documentListeners.get('DOMContentLoaded')(),
    chooseSubject: value => {
      const select = elements.get('subject'); select.value = value;
      select.dispatchEvent({ type: 'change', bubbles: true });
    },
    submit: () => listeners.get('submit')({ preventDefault() {} }) };
}
{
  const page = enquiry(valid);
  assert.equal(page.elements.get('subject').value, '', 'The placeholder is selected initially');
  page.chooseSubject('Maths');
  assert.equal(page.elements.get('subject').value, 'Maths');
  page.chooseSubject('');
  assert.equal(page.elements.get('subject').value, '');
  await page.submit();
  assert.equal(page.requests[0].body.get('Support requested'), valid['Support requested'], 'The placeholder clears the subject prefix');
}
for (const [service, subject] of Object.entries({ maths: 'Maths', languages: 'Languages', 'english-work': 'English', ielts: 'English', qualifications: 'Exam preparation' })) {
  const direct = enquiry(valid, 'ok', { search: '?service=' + service });
  assert.equal(direct.elements.get('subject').value, subject);
  await direct.submit();
  assert.equal(direct.requests[0].body.get('Support requested'), 'Subject: ' + subject + ' | ' + valid['Support requested']);
  // Exercise the actual data-service handoff with clean URLs, then hydrate the form.
  const storage = new Map(), origin = fixture('https://example.test/subjects', storage);
  const link = origin.node('a', { href: 'contact', 'data-service': service }); origin.document.body.append(link);
  await origin.run('campaigns.js'); origin.click(link);
  assert.equal(link.getAttribute('href'), 'contact');
  const target = fixture('https://example.test/contact', storage);
  for (const id of ['campaign-source', 'traffic-source', 'traffic-medium', 'campaign-name']) target.document.body.append(target.node('input', { id }));
  await target.run('campaigns.js');
  const page = enquiry(valid, 'ok', { campaignSource: target.document.getElementById('campaign-source').value });
  assert.equal(page.elements.get('subject').value, subject, 'data-service pre-fills the native select after URL cleanup');
  page.chooseSubject(''); page.ready();
  assert.equal(page.elements.get('subject').value, '', 'Hydration preserves an explicitly cleared choice');
}
{
  const page = enquiry(valid);
  page.elements.get('campaign-source').value = 'languages'; page.ready();
  assert.equal(page.elements.get('subject').value, 'Languages', 'Late campaign hydration pre-fills Languages');
}
for (const service of ['children', 'adults', 'in-person', 'not-sure', 'unknown', 'toString', '__proto__']) {
  const page = enquiry(valid, 'ok', { search: '?service=' + service });
  assert.equal(page.elements.get('subject').value, '', 'Unmapped services leave the choice optional');
}
{
  const page = enquiry({ ...valid, Subject: 'Science' }, 'ok', { search: '?service=maths' });
  page.ready();
  assert.equal(page.elements.get('subject').value, 'Science', 'Pre-fill preserves a restored selection');
}
for (const subject of [undefined, '', ...subjects]) {
  const data = subject === undefined ? valid : { ...valid, Subject: subject };
  assert.equal(rules.validate(data, now).ok, true, `Optional subject accepted: ${subject}`);
  const page = enquiry(data); await page.submit();
  assert.equal(page.requests.length, 1);
  const sent = page.requests[0];
  assert.equal(sent.body.has('Subject'), false, 'Subject stays inside Support requested for the existing backend');
  assert.equal(sent.body.get('Support requested'), (subject ? 'Subject: ' + subject + ' | ' : '') + valid['Support requested']);
  assert.deepEqual([...sent.body.keys()], Object.keys(valid), 'Backend field names stay unchanged');
  assert.equal(sent.method, 'POST'); assert.equal(sent.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(page.redirects, ['thank-you']);
}
for (const Subject of ['Unsupported', 'x'.repeat(41), {}, 42]) {
  assert.equal(rules.validate({ ...valid, Subject }, now).ok, false, 'Reject invalid subject data');
}
for (const enhanced of [true, false]) {
  const page = enquiry(valid, 'ok', { enhanced });
  page.elements.get('subject').value = 'Unsupported';
  await page.submit();
  assert.equal(page.requests.length, 0);
  assert.equal(page.focused, enhanced ? 'subject-button' : 'subject', 'Subject errors focus the active control');
  assert.equal(page.elements.get('subject-error').textContent, 'Choose a subject from the list, or leave it blank.');
  assert.equal(page.elements.get('subject').attrs['aria-invalid'], 'true');
  if (enhanced) assert.equal(page.elements.get('subject-button').attrs['aria-invalid'], 'true');
  page.chooseSubject('');
  assert.equal(page.elements.get('subject-error').textContent, '');
  assert.equal(page.elements.get('subject').attrs['aria-invalid'], undefined);
  assert.equal(page.elements.get('subject-button').attrs['aria-invalid'], undefined);
}
for (const Subject of ['', ...subjects]) {
  const allowance = 1000 - (Subject ? ('Subject: ' + Subject + ' | ').length : 0);
  const page = enquiry({ ...valid, Subject, 'Support requested': 'x'.repeat(allowance) }); await page.submit();
  assert.equal(page.requests.length, 1); assert.equal(page.requests[0].body.get('Support requested').length, 1000);
  for (const length of new Set([allowance + 1, 1000])) {
    if (length === allowance) continue;
    const tooLong = enquiry({ ...valid, Subject, 'Support requested': 'x'.repeat(length) }); await tooLong.submit();
    assert.equal(tooLong.requests.length, 0, 'Over-limit combined messages never send');
    assert.equal(tooLong.focused, 'support-needed');
    assert.match(tooLong.elements.get('support-needed-error').textContent, new RegExp(String(allowance)));
    assert.equal(tooLong.elements.get('support-needed').getAttribute('aria-invalid'), 'true');
  }
}
for (const phone of ['07309 639095', '+44 (7309) 639095', '020 7946 0958', '+1 (202) 555-0123', '+84 901 234 567', '+33 6 12 34 56 78', '1234567', '+123456789012345']) {
  for (const reply of ['call', 'text', 'whatsapp']) {
    const data = { ...valid, 'Reply method': reply, phone };
    assert.equal(rules.validate(data, now).ok, true, `Accept ${phone} for ${reply}`);
    const page = enquiry(data); await page.submit();
    assert.equal(page.requests.length, 1); assert.equal(page.requests[0].body.get('phone'), phone);
  }
}
for (const phone of ['', '123456', '+1234567890123456', '++447309639095', '44+7309639095', 'call-me', '+44.7309639095']) {
  const data = { ...valid, 'Reply method': 'call', phone };
  assert.equal(rules.validate(data, now).ok, false, `Reject ${phone}`);
  const page = enquiry(data); await page.submit(); assert.equal(page.requests.length, 0);
}
for (const outcome of ['network', 'timeout', 'http-error', 'rejected']) {
  const page = enquiry(valid, outcome); await page.submit();
  const message = page.elements.get('form-message');
  assert.match(message.parts[0], /may not have sent/);
  const links = message.parts.filter(part => typeof part !== 'string');
  assert.deepEqual(links.map(link => link.href), ['mailto:hello@toucanlearn.co.uk', 'tel:+447309639095', 'https://wa.me/447307045816']);
  assert.equal(page.redirects.length, 0); assert.equal(page.timers.size, 0);
  assert.equal(page.elements.get('submit-button').disabled, false);
  assert.equal(page.elements.get('enquiry-form').getAttribute('aria-busy'), null);
  assert.equal(page.focused, 'form-message');
  if (outcome === 'timeout') assert.equal(page.requests[0].signal.aborted, true);
}
assert.equal(await read('hoc-tieng-anh.js'), execFileSync('git', ['show', '330fef9:hoc-tieng-anh.js'], { cwd: root, encoding: 'utf8' }), 'Vietnamese form stays separate (owner-approved 30 Oct version with the SEN option)');
console.log('PASS: Original Subject select, progressive enhancement, keyboard/focus events, Lucide icons, clearing, URL/data-service pre-fill, native/custom error focus, payload compatibility, combined message limits, UK/international phones, uncertain-send alternatives, accessibility and CSP. Browser layout and server deployment unverified.');

// The same production form handler with each translated form: no live requests.
const languageScript = await read('language-forms.js');
for (const lang of ['es', 'fr', 'it']) {
  const markup = await read(`${lang}/contact.html`);
  const dictionary = { window: {}, document: { documentElement: { lang } } };
  vm.runInNewContext(languageScript, dictionary);
  const languageMessages = dictionary.window.toucanFormMessages;
  const options = { markup, languageMessages };
  const success = enquiry({ ...valid, Subject: 'English' }, 'ok', options);
  await success.submit();
  assert.equal(success.requests.length, 1);
  assert.equal(success.requests[0].body.get('Support requested'), 'Subject: English | Help with a course.');
  assert.equal(success.requests[0].url, enquiry(valid).elements.get('enquiry-form').dataset.formEndpoint);
  assert.equal(success.redirects.length, 0, 'Translated success stays in the selected language');
  assert.equal(success.elements.get('form-message').textContent, success.elements.get('enquiry-form').dataset.successMessage);
  assert.equal(success.elements.get('form-message').attrs.role, 'status');
  assert.equal(success.elements.get('enquiry-fields').disabled, true);
  await success.submit(); assert.equal(success.requests.length, 1, 'Success prevents duplicate requests');
  for (const outcome of ['network','http-error','rejected','timeout']) {
    const failed = enquiry(valid, outcome, options);
    await failed.submit();
    assert.equal(failed.redirects.length, 0);
    assert(failed.elements.get('form-message').parts[0].startsWith(languageMessages['Your enquiry may not have sent. Please contact us using one of these options.']));
    assert.equal(failed.elements.get('submit-button').textContent, languageMessages['Send my enquiry']);
    assert.equal(failed.elements.get('submit-button').disabled, false);
    assert.equal(failed.timers.size, 0);
    await failed.submit(); assert.equal(failed.requests.length, 2, 'Translated errors allow retry');
  }
  for (const [bad,key,message] of [
    [{...valid,'Contact name':''},'contact-name','Enter your name.'],
    [{...valid,email:'invalid'},'email','Enter a valid email address.'],
    [{...valid,'Desired lesson rate':'x'.repeat(61)},'desired-lesson-rate','Please keep this field within {limit} characters.']
  ]) {
    const page = enquiry(bad,'ok',options); await page.submit();
    assert.equal(page.requests.length,0);
    assert.equal(page.elements.get(key+'-error').textContent,languageMessages[message].replace('{limit}','60'));
    assert.equal(page.focused,key);
  }
  const long = enquiry({...valid,Subject:'English','Support requested':'x'.repeat(1000)},'ok',options);
  await long.submit(); assert.equal(long.requests.length,0);
  assert.equal(long.elements.get('support-needed-error').textContent,languageMessages['Please keep your message within {limit} characters (1000 including the selected subject).'].replace('{limit}','981'));
}
console.log('PASS: Spanish, French and Italian form validation, payloads, translated success/errors, timeout, retry and duplicate protection.');
