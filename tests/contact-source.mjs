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
const css = await read('contact.css');
const rules = createRequire(import.meta.url)('../contact.js');

const help = "Please don't include diagnoses or medical records; we'll talk through needs together.";
// 30 Oct: the owner-approved footer (Terms link, sole-trader line) replaces the old one.
const footer = html => html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
const expected = baseline('contact.html').replace(footer(baseline('contact.html')), footer(html))
  .replace('aria-describedby="support-needed-error"', 'aria-describedby="support-needed-privacy support-needed-error"')
  .replace('</textarea>', '</textarea>\n<small id="support-needed-privacy">' + help + '</small>')
  .replace('Use a UK number, starting with 0 or +44.', 'Use 7–15 digits; include + and the country code for international numbers.')
  .replace('>WhatsApp us<', '>WhatsApp 07307 045816<');
const untokened = page => page.replace(/\?v=[^"']+/g, '?v=T'); // stylesheet/script cache tokens change with every release
// Owner, 30 Oct: the age field sits at the top of the details column, so choosing
// "child" pushes Subject down instead of opening a gap beside the name. Compare
// everything else with the age field back in its original place.
const ageBlock = page => page.match(/\n\s*<div class="field conditional-field" id="age-year-field"[\s\S]*?\n\s*<\/div>(?=\n)/)?.[0];
const ageBack = page => {
  const block = ageBlock(page);
  return block ? page.replace(block, '').replace(/(<span class="field-error" id="learner-child-error"><\/span>\s*<\/fieldset>)/, `$1${block}`) : page;
};
assert.ok(html.indexOf('id="age-year-field"') > html.indexOf('id="support-needed"') && html.indexOf('id="age-year-field"') < html.indexOf('subject-choice'), 'Age sits above Subject in the details column');
assert.equal(contactMarkup(untokened(ageBack(html))), contactMarkup(untokened(expected)),
  'Preserve field names, order, hooks, configuration and copy outside the requested help and phone labels');
assert.equal(navigationMarkup(untokened(await read('privacy.html'))), navigationMarkup(untokened(execFileSync('git', ['show', '4409323:privacy.html'], { cwd: root, encoding: 'utf8' }))), 'Privacy matches the owner-approved 30 Oct notice');
assert.doesNotMatch(html, /support-needed-hint|The subject or goal, and what's tricky at the moment/);
assert.match(html, /<textarea id="support-needed"[^>]*aria-describedby="support-needed-privacy support-needed-error"[^>]*required/);
assert.ok(html.includes('<small id="support-needed-privacy">' + help + '</small>'));
assert.match(html, /href="tel:\+447309639095">07309 639095<\/a>/);
assert.match(html, /href="https:\/\/wa.me\/447307045816"[^>]*>WhatsApp 07307 045816</);
assert.match(html, /src="contact.js\?v=20261030-subject-icons-1"/);
assert.match(html, /href="contact.css\?v=20261030-subject-icons-1"/);
assert.match(html, /script-src 'self'; style-src 'self'/);
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

const group = html.match(/<fieldset class="form-choice subject-choice"([^>]*)>([\s\S]*?)<\/fieldset>/);
assert.ok(group, 'Subject fieldset exists');
assert.match(group[1], /aria-describedby="subject-error"/);
assert.match(group[2], /<legend>Subject \(optional\)<\/legend>/);
assert.doesNotMatch(html, /<select\b[^>]*name="Subject"/);
const chips = [...group[2].matchAll(/<label class="subject-chip[^>]*>([\s\S]*?)<\/label>/g)];
assert.equal(chips.length, 9, 'Every subject has a chip');
const subjects = chips.map(([, chip]) => {
  const input = chip.match(/<input\b[^>]*>/)[0];
  const value = input.match(/value="([^"]+)"/)[1].replaceAll('&amp;', '&');
  assert.match(input, /name="Subject" type="radio"/);
  assert.match(input, /aria-describedby="subject-error"/);
  assert.match(chip, /<svg\b[^>]*fill="none"[^>]*stroke="currentColor"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.equal(chip.match(/<span>([^<]+)<\/span>/)[1].replaceAll('&amp;', '&'), value);
  return value;
});
assert.deepEqual(subjects, ['English', 'Maths', 'Science', 'Languages', 'Psychology', 'Art & design', 'Exam preparation', 'SEN support', 'Other']);
assert.equal((group[2].match(/name="Subject"/g) || []).length, 10, 'Nine subjects plus an empty choice');
assert.match(group[2], /<input id="subject-none" name="Subject" type="radio" value=""[^>]*\/> No preference/);
assert.doesNotMatch(group[2], /\b(?:required|disabled|checked|tabindex|role)=?|\bonkeydown\b/, 'Optional, initially unselected native radios retain keyboard behaviour');
assert.match(css, /\.subject-options\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(css, /@media \(max-width: 680px\)\s*\{[\s\S]*?\.subject-options\s*\{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.subject-chip:has\(input:checked\)[^}]*var\(--field-focus\)/);
assert.match(css, /\.subject-chip:has\(input:focus-visible\)[^}]*outline:/);
assert.match(css, /\.subject-chip:has\(input\[aria-invalid="true"\]\)[^}]*var\(--error-ink\)/);
for (const [subject, colour] of Object.entries({ english: '#6b2a5e', maths: '#0b5e5a', science: '#1f5640', languages: '#8a4b0b', psychology: '#3b2f7a', art: '#8a2450', sen: '#1d3a6b' })) {
  assert.ok(css.includes(`.subject-chip--${subject} { --subject-ink: ${colour}; }`), `${subject} uses its CTA colour`);
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
function enquiry(input, outcome = 'ok', { search = '', campaignSource } = {}) {
  const elements = new Map(), listeners = new Map(), documentListeners = new Map(), requests = [], redirects = [], timers = new Map();
  let focused;
  function node(id = '', attrs = {}) {
    return { id, attrs, value: attrs.value || '', textContent: '', parts: [], disabled: false, hidden: false, inert: false,
      get checked() { return this._checked || false; },
      set checked(value) {
        if (value) for (const radio of elements.values()) {
          if (radio.attrs.type === 'radio' && radio.attrs.name === this.attrs.name) radio._checked = false;
        }
        this._checked = value;
      },
      classList: { add() {}, remove() {} },
      getAttribute(key) { return this.attrs[key] ?? null; },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      replaceChildren(...parts) { this.parts = parts; },
      focus() { focused = id; }
    };
  }
  for (const [, tag] of html.matchAll(/(<[\w-]+\b[^>]*\bid="[^"]+"[^>]*>)/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value.replaceAll('&amp;', '&')]));
    elements.set(attrs.id, node(attrs.id, attrs));
  }
  for (const element of elements.values()) {
    if (element.attrs.type === 'radio') element.checked = Object.hasOwn(input, element.attrs.name) && input[element.attrs.name] === element.value;
  }
  if (campaignSource) elements.get('campaign-source').value = campaignSource;
  const form = elements.get('enquiry-form');
  form.dataset = { formEndpoint: form.attrs['data-form-endpoint'] };
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
    FormData: class { constructor() {
      const body = new URLSearchParams(input);
      body.delete('Subject');
      const subject = form.querySelector('input[name="Subject"]:checked');
      if (subject) body.set('Subject', subject.value);
      return body;
    } },
    document: { getElementById: id => elements.get(id), createElement: () => node(),
      addEventListener: (type, fn) => documentListeners.set(type, fn) },
    window: { location: { search, assign: value => redirects.push(value) },
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
      form.querySelector('input[name="Subject"][value="' + value + '"]').checked = true;
      listeners.get('change')();
    },
    submit: () => listeners.get('submit')({ preventDefault() {} }) };
}
{
  const page = enquiry(valid);
  assert.ok([...page.elements.values()].filter(element => element.attrs.name === 'Subject').every(radio => !radio.checked), 'No subject is selected initially');
  page.chooseSubject('Maths');
  assert.equal(page.elements.get('subject-maths').checked, true);
  page.chooseSubject('');
  assert.equal(page.elements.get('subject-maths').checked, false);
  assert.equal(page.elements.get('subject-none').checked, true);
  await page.submit();
  assert.equal(page.requests[0].body.get('Support requested'), valid['Support requested'], 'No preference clears the subject prefix');
}
for (const [service, subject] of Object.entries({ maths: 'Maths', languages: 'Languages', 'english-work': 'English', ielts: 'English', qualifications: 'Exam preparation' })) {
  const direct = enquiry(valid, 'ok', { search: '?service=' + service });
  assert.equal([...direct.elements.values()].find(element => element.attrs.name === 'Subject' && element.checked)?.value, subject);
  await direct.submit();
  assert.equal(direct.requests[0].body.get('Support requested'), 'Subject: ' + subject + '\n' + valid['Support requested']);
  // Exercise the actual data-service handoff with clean URLs, then hydrate the form.
  const storage = new Map(), origin = fixture('https://example.test/subjects', storage);
  const link = origin.node('a', { href: 'contact', 'data-service': service }); origin.document.body.append(link);
  await origin.run('campaigns.js'); origin.click(link);
  assert.equal(link.getAttribute('href'), 'contact');
  const target = fixture('https://example.test/contact', storage);
  for (const id of ['campaign-source', 'traffic-source', 'traffic-medium', 'campaign-name']) target.document.body.append(target.node('input', { id }));
  await target.run('campaigns.js');
  const page = enquiry(valid, 'ok', { campaignSource: target.document.getElementById('campaign-source').value });
  assert.equal([...page.elements.values()].find(element => element.attrs.name === 'Subject' && element.checked)?.value, subject, 'data-service pre-fills a radio after URL cleanup');
  page.chooseSubject(''); page.ready();
  assert.equal(page.elements.get('subject-none').checked, true, 'Hydration preserves an explicitly cleared choice');
}
{
  const page = enquiry(valid);
  page.elements.get('campaign-source').value = 'languages'; page.ready();
  assert.equal(page.elements.get('subject-languages').checked, true, 'Late campaign hydration pre-fills Languages');
}
for (const service of ['children', 'adults', 'in-person', 'not-sure', 'unknown', 'toString', '__proto__']) {
  const page = enquiry(valid, 'ok', { search: '?service=' + service });
  assert.ok([...page.elements.values()].filter(element => element.attrs.name === 'Subject').every(radio => !radio.checked), 'Unmapped services leave the choice optional');
}
{
  const page = enquiry({ ...valid, Subject: 'Science' }, 'ok', { search: '?service=maths' });
  page.ready();
  assert.equal(page.elements.get('subject-science').checked, true, 'Pre-fill preserves a restored selection');
}
for (const subject of [undefined, '', ...subjects]) {
  const data = subject === undefined ? valid : { ...valid, Subject: subject };
  assert.equal(rules.validate(data, now).ok, true, `Optional subject accepted: ${subject}`);
  const page = enquiry(data); await page.submit();
  assert.equal(page.requests.length, 1);
  const sent = page.requests[0];
  assert.equal(sent.body.has('Subject'), false, 'Subject stays inside Support requested for the existing backend');
  assert.equal(sent.body.get('Support requested'), (subject ? 'Subject: ' + subject + '\n' : '') + valid['Support requested']);
  assert.deepEqual([...sent.body.keys()], Object.keys(valid), 'Backend field names stay unchanged');
  assert.equal(sent.method, 'POST'); assert.equal(sent.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(page.redirects, ['thank-you']);
}
for (const Subject of ['Unsupported', 'x'.repeat(41), {}, 42]) {
  assert.equal(rules.validate({ ...valid, Subject }, now).ok, false, 'Reject invalid subject data');
}
{
  const page = enquiry(valid);
  const radio = page.elements.get('subject-maths'); radio.value = 'Unsupported'; radio.checked = true;
  await page.submit();
  assert.equal(page.requests.length, 0);
  assert.equal(page.focused, 'subject', 'Subject errors focus a native radio');
  assert.equal(page.elements.get('subject-error').textContent, 'Choose a subject from the list, or leave it blank.');
  assert.ok([...page.elements.values()].filter(element => element.attrs.name === 'Subject').every(radio => radio.attrs['aria-invalid'] === 'true'));
  page.chooseSubject('');
  assert.equal(page.elements.get('subject-error').textContent, '');
  assert.ok([...page.elements.values()].filter(element => element.attrs.name === 'Subject').every(radio => !radio.attrs['aria-invalid']));
}
for (const Subject of ['', ...subjects]) {
  const allowance = 1000 - (Subject ? ('Subject: ' + Subject + '\n').length : 0);
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
console.log('PASS: Subject radio chips, clearing, URL/data-service pre-fill, error focus, payload compatibility, combined message limits, UK/international phones, uncertain-send alternatives, accessibility and CSP. Browser layout and server deployment unverified.');
