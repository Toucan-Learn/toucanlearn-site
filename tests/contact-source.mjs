// Browser-free contact regression check: node tests/contact-source.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { contactMarkup, contactScript } from './helpers/contact-markup.mjs';
import { navigationMarkup } from './helpers/navigation-markup.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const baseline = file => execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
const html = await read('contact.html');
const script = await read('contact.js');
const rules = createRequire(import.meta.url)('../contact.js');

assert.equal(contactMarkup(html), contactMarkup(baseline('contact.html')),
  'Preserve copy, field order, labels, validation attributes, conditional hooks, links and submission configuration');
assert.equal(contactScript(script), contactScript(baseline('contact.js')), 'Keep existing enquiry behaviour unchanged');
assert.equal(navigationMarkup(await read('privacy.html')), navigationMarkup(baseline('privacy.html')), 'Keep privacy content unchanged through the URL migration');
assert.doesNotMatch(html, /support-needed-hint|The subject or goal, and what's tricky at the moment/);
assert.match(html, /<textarea id="support-needed"[^>]*aria-describedby="support-needed-error"[^>]*required/);
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
  .map(([, label]) => label.replaceAll('&amp;', '&').replace('SEND support', 'SEN support'));
assert.deepEqual(subjects, [...advertised.slice(0, -1), 'Exam preparation', advertised.at(-1), 'Other']);
assert.match(script, /new URLSearchParams\(new FormData\(form\)\)/, 'All named fields, including Subject, reach the POST payload');

// Exercise the matching Apps Script locally; MailApp is a stub and sends nothing.
const server = await read('ops/enquiry-form/Code.gs');
const block = text => text.match(/\/\/ BEGIN ENQUIRY RULES[\s\S]*?\/\/ END ENQUIRY RULES/)[0];
assert.equal(block(server), block(script), 'Client and server validators remain identical');
const now = 1793275200000;
const valid = { 'Contact name': 'Synthetic Test', Learner: 'adult', 'Support requested': 'Help with a course.',
  'Reply method': 'email', email: 'test@example.invalid', loaded_at: String(now - 5000) };
const messages = [];
const context = vm.createContext({
  Date: { now: () => now },
  ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(value) { return { value, setMimeType() { return this; } }; } },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  MailApp: { getRemainingDailyQuota: () => 100, sendEmail: message => messages.push(message) }
});
vm.runInContext(server, context);
for (const subject of [undefined, '', ...subjects]) {
  const data = subject === undefined ? valid : { ...valid, Subject: subject };
  assert.equal(rules.validate(data, now).ok, true, `Optional subject accepted: ${subject}`);
  const result = context.doPost({ parameter: data, postData: { type: 'application/x-www-form-urlencoded' } });
  assert.deepEqual(JSON.parse(result.value), { ok: true });
  assert.ok(messages.at(-1).body.includes(`Subject: ${subject || 'Not provided'}\n`), 'Subject reaches the enquiry notification');
}
for (const Subject of ['Unsupported', 'x'.repeat(41), {}, 42]) {
  assert.equal(rules.validate({ ...valid, Subject }, now).ok, false, 'Reject invalid subject data');
  const before = messages.length;
  assert.deepEqual(JSON.parse(context.doPost({ parameter: { ...valid, Subject } }).value), { ok: false });
  assert.equal(messages.length, before);
}
console.log('PASS: Contact copy, existing behaviour, optional subjects, client/server payloads, accessibility, CSP and privacy. Browser layout unverified.');
