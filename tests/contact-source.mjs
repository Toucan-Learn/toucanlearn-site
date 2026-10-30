// Browser-free contact regression check: node tests/contact-source.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { contactMarkup } from './helpers/contact-markup.mjs';
import { navigationMarkup } from './helpers/navigation-markup.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
// Compare with the site just before the 30 Oct ad-landing form changes (HEAD would already contain them).
const baseline = file => execFileSync('git', ['show', `b698613:${file}`], { cwd: root, encoding: 'utf8' });
const html = await read('contact.html');
const script = await read('contact.js');
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
assert.equal(contactMarkup(untokened(html)), contactMarkup(untokened(expected)),
  'Preserve field names, order, hooks, configuration and copy outside the requested help and phone labels');
assert.equal(navigationMarkup(untokened(await read('privacy.html'))), navigationMarkup(untokened(execFileSync('git', ['show', '4409323:privacy.html'], { cwd: root, encoding: 'utf8' }))), 'Privacy matches the owner-approved 30 Oct notice');
assert.doesNotMatch(html, /support-needed-hint|The subject or goal, and what's tricky at the moment/);
assert.match(html, /<textarea id="support-needed"[^>]*aria-describedby="support-needed-privacy support-needed-error"[^>]*required/);
assert.ok(html.includes('<small id="support-needed-privacy">' + help + '</small>'));
assert.match(html, /href="tel:\+447309639095">07309 639095<\/a>/);
assert.match(html, /href="https:\/\/wa.me\/447307045816"[^>]*>WhatsApp 07307 045816</);
assert.match(html, /src="contact.js\?v=20261030-ad-landing-1"/);
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

const select = html.match(/<select id="subject"([^>]*)>([\s\S]*?)<\/select>/);
assert.ok(select, 'Subject select exists');
assert.match(select[1], /name="Subject"/);
assert.doesNotMatch(select[1], /\b(?:required|disabled)\b/, 'Subject is optional and enabled with the form');
const options = [...select[2].matchAll(/<option value="([^"]*)">([^<]+)<\/option>/g)]
  .map(([, value, label]) => ({ value: value.replaceAll('&amp;', '&'), label: label.replaceAll('&amp;', '&') }));
assert.deepEqual(options[0], { value: '', label: 'Choose a subject' });
const subjects = options.slice(1).map(option => option.value);
const advertised = [...(await read('subjects.html')).matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)]
  .map(([, label]) => label.replaceAll('&amp;', '&').replace('SEND support', 'SEN support').replace('Art & DT', 'Art & design'));
assert.deepEqual(subjects, [...advertised.slice(0, -1), 'Exam preparation', advertised.at(-1), 'Other']);
assert.match(script, /new URLSearchParams\(new FormData\(form\)\)/, 'All named fields, including Subject, reach the POST payload');

// This checkout has no Apps Script source. Exercise the actual client submission
// with a local DOM/fetch stub; no request, email or other message leaves the test.
const now = 1793275200000;
const valid = { 'Contact name': 'Synthetic Test', Learner: 'adult', 'Support requested': 'Help with a course.',
  'Reply method': 'email', email: 'test@example.invalid', loaded_at: String(now - 5000) };
function enquiry(input, outcome = 'ok') {
  const elements = new Map(), listeners = new Map(), requests = [], redirects = [], timers = new Map();
  let focused;
  function node(id = '', attrs = {}) {
    return { id, attrs, value: '', textContent: '', parts: [], disabled: false, hidden: false, inert: false,
      classList: { add() {}, remove() {} },
      getAttribute(key) { return this.attrs[key] ?? null; },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      replaceChildren(...parts) { this.parts = parts; },
      focus() { focused = id; }
    };
  }
  for (const [, tag] of html.matchAll(/(<[\w-]+\b[^>]*\bid="[^"]+"[^>]*>)/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    elements.set(attrs.id, node(attrs.id, attrs));
  }
  const form = elements.get('enquiry-form');
  form.dataset = { formEndpoint: form.attrs['data-form-endpoint'] };
  form.addEventListener = (type, fn) => listeners.set(type, fn);
  form.querySelector = selector => ({ value: input[selector.match(/name="([^"]+)"/)[1]] || '' });
  form.querySelectorAll = selector => {
    const [, key, value] = selector.match(/^\[([\w-]+)="([^"]+)"\]$/);
    return [...elements.values()].filter(element => element.attrs[key] === value);
  };
  const context = vm.createContext({
    Date: { now: () => now }, URLSearchParams, AbortController,
    FormData: class { constructor() { return new URLSearchParams(input); } },
    document: { getElementById: id => elements.get(id), createElement: () => node() },
    window: { location: { search: '', assign: value => redirects.push(value) },
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
    submit: () => listeners.get('submit')({ preventDefault() {} }) };
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
assert.equal(await read('hoc-tieng-anh.js'), baseline('hoc-tieng-anh.js'), 'Vietnamese form stays separate and unchanged');
console.log('PASS: Contact payload compatibility, combined message limits, UK/international phones, uncertain-send alternatives, accessibility, CSP and requested copy. Browser layout and server deployment unverified.');
