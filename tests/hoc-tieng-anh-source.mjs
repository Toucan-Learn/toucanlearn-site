// Offline form integration: no browser, fetch network calls or third-party modules.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import { fixture } from './helpers/navigation-dom.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [html, script, contact, sitemap] = await Promise.all([
  read('hoc-tieng-anh.html'), read('hoc-tieng-anh.js'), read('contact.html'), read('sitemap.xml')
]);
const title = 'Học tiếng Anh 1 kèm 1 với giáo viên người Anh và người Việt | Toucan Learn';
const description = 'Học tiếng Anh trực tuyến 1 kèm 1 với thầy Aaron (CELTA), thầy Josh hoặc cô Như (IELTS 7.0). Buổi học đầu tiên miễn phí.';
const markup = html.replace(/<!--[\s\S]*?-->/g, '');
const teacherChoices = ['Chưa chắc, hãy tư vấn giúp tôi', 'Thầy Aaron', 'Thầy Josh', 'Cô Như'];
assert.match(html, /<html lang="vi">/);
assert.ok(html.includes(`<title>${title}</title>`));
assert.ok(html.includes(`content="${description}"`));
assert.ok(html.includes(`<meta property="og:title" content="${title}" />`));
assert.ok(html.includes(`<meta property="og:description" content="${description}" />`));
assert.ok(html.includes('<h1 id="vietnam-heading">Học tiếng Anh 1 kèm 1, chọn giáo viên phù hợp với bạn.</h1>'));
assert.ok(html.includes('<p class="lead">Học trực tuyến với giáo viên người Anh hoặc người Việt. Buổi học đầu tiên miễn phí.</p>'));
for (const text of [
  'Cho học sinh', 'Giao tiếp tự tin, ngữ pháp và từ vựng, bám sát chương trình ở trường.',
  'Luyện thi IELTS', 'Speaking, Writing, Reading và Listening, luyện đề với nhận xét chi tiết.',
  'Cho người đi làm', 'Tiếng Anh giao tiếp và công việc: họp, email, thuyết trình.',
  'Cách học', 'Buổi đầu miễn phí: giáo viên đánh giá trình độ và mục tiêu của học viên.',
  'Học 1 kèm 1 trực tuyến, vào buổi tối và cuối tuần theo giờ Việt Nam.',
  'Báo cáo hằng tuần: đã học được gì và bước tiếp theo là gì.',
  '650.000đ / giờ', 'Buổi học đầu tiên miễn phí.',
  'Phụ huynh có thể trao đổi bằng tiếng Việt với đội ngũ của chúng tôi.',
  'Đăng ký buổi học thử miễn phí', 'Gửi đăng ký'
]) assert.ok(html.includes(`>${text}<`), `Exact copy: ${text}`);
assert.match(sitemap, /<loc>https:\/\/toucanlearn\.co\.uk\/hoc-tieng-anh<\/loc>/);
assert.match(html, /rel="canonical" href="https:\/\/toucanlearn\.co\.uk\/hoc-tieng-anh"/);
assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0], contact.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0]);
assert.doesNotMatch(html, /\s(?:style|on\w+)\s*=/i);
for (const [, attrs, content] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  assert.match(attrs, /\bsrc="[^"]+"/);
  assert.equal(content.trim(), '');
}
for (const [, file] of markup.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"]*)?"/g)) {
  if (/\.(?:css|js|png|jpe?g)$/.test(file)) await access(new URL(file, root));
}
const header = source => source.match(/<header>[\s\S]*?<\/header>/)[0];
assert.equal(header(html).replaceAll('Đăng ký học thử', 'Book a free trial'), header(contact), 'Shared menu, theme toggle and local trial CTA');
const footer = source => source.match(/<footer\b[\s\S]*?<\/footer>/)[0];
assert.equal(footer(html), footer(contact));
const endpoint = source => source.match(/data-form-endpoint="([^"]+)"/)[1];
assert.equal(endpoint(html), endpoint(contact));
const team = await read('team.html');
const portrait = (source, teacher) => source.match(new RegExp(`<span class="framework-portrait-frame framework-portrait-frame--${teacher}">([\\s\\S]*?)<\\/span>`))[1];
assert.equal(portrait(markup, 'aaron').replace('Thầy Aaron Gelsthorpe', 'Aaron Gelsthorpe'), portrait(team, 'aaron').replace(' loading="lazy"', ''));
assert.equal(portrait(markup, 'joshua').replace('Thầy Joshua Gordon Jones', 'Joshua Gordon Jones'), portrait(team, 'joshua').replace(' loading="lazy"', ''));
const teachers = markup.match(/<section class="vietnam-teachers"[\s\S]*?<\/section>/)[0];
assert.match(teachers, /aria-labelledby="teachers-heading"/);
assert.ok(teachers.includes('<h2 id="teachers-heading">Chọn giáo viên</h2>'));
const teacherCards = [...teachers.matchAll(/<article class="vietnam-teacher"[\s\S]*?<\/article>/g)].map(match => match[0]);
assert.equal(teacherCards.length, 3);
const teacherCopy = [
  ['Thầy Aaron', 'Giáo viên bản ngữ đến từ Anh, có chứng chỉ CELTA. Bài bản, chuẩn mực và chất lượng.'],
  ['Thầy Josh', 'Người sáng lập Toucan Learn. Thầy hiểu ngữ âm tiếng Việt, nên giúp bạn sửa phát âm từ gốc.'],
  ['Cô Như', 'Người Việt, IELTS 7.0. Cô giúp bạn “gỡ rối” các lỗi ngữ pháp và phát âm tiếng Việt mà bạn dễ mắc phải.']
];
teacherCards.forEach((card, index) => {
  assert.ok(card.includes(`>${teacherCopy[index][0]}</h3>`), 'Teacher order and name');
  assert.ok(card.includes(`<p>${teacherCopy[index][1]}</p>`), 'Exact teacher copy');
});
assert.match(teacherCards[2], /<span class="framework-portrait-frame framework-portrait-frame--photo"><img class="framework-portrait" src="assets\/team\/nhu-portrait\.jpg\?v=[^"]+" alt="Cô Như" width="405" height="600"/, 'Như has her own photo');
assert.equal((html.match(/class="vietnam-card"/g) || []).length, 3);
assert.equal((html.match(/<li>Buổi đầu|<li>Học 1|<li>Báo cáo/g) || []).length, 3);
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size);
for (const [, target] of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(target), target);
for (const [, targets] of html.matchAll(/\baria-(?:labelledby|describedby)="([^"]+)"/g)) {
  for (const target of targets.split(' ')) assert.ok(ids.includes(target), target);
}

// Exercise campaign capture and the existing clean route for both public URL forms.
for (const route of ['hoc-tieng-anh', 'hoc-tieng-anh.html']) {
  const storage = new Map();
  const page = fixture(`https://example.test/${route}?utm_source=referral&utm_medium=zalo&utm_campaign=autumn` , storage);
  await page.run('campaigns.js');
  await page.run('menu.js');
  for (const id of ['campaign-source', 'traffic-source', 'traffic-medium', 'campaign-name']) {
    const input = page.node('input', { id }); input.value = ''; page.document.body.append(input);
  }
  page.emit(page.document, 'DOMContentLoaded');
  await page.load();
  assert.equal(page.location.pathname, '/hoc-tieng-anh');
  assert.equal(page.location.search, '');
  assert.equal(page.document.getElementById('traffic-medium').value, 'zalo');
  assert.equal(page.document.getElementById('campaign-name').value, 'autumn');
  assert.equal(JSON.parse(storage.get('toucan-attribution')).utm_source, 'referral');
}

const formMarkup = html.match(/<form\b[\s\S]*?<\/form>/)[0];
assert.ok(formMarkup.includes('<label for="teacher">Giáo viên mong muốn</label>'));
const teacherSelect = formMarkup.match(/<select id="teacher"[^>]*>[\s\S]*?<\/select>/)[0];
assert.deepEqual([...teacherSelect.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(([, value, label]) => [value, label]), teacherChoices.map(choice => [choice, choice]));
assert.ok(formMarkup.indexOf('id="teacher"') > formMarkup.indexOf('id="learner"'), 'Teacher choice follows learner');
assert.ok(formMarkup.indexOf('id="teacher"') < formMarkup.indexOf('id="age-year"'), 'Teacher choice precedes age');
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const successText = 'Cảm ơn bạn! Chúng tôi sẽ liên hệ trong vòng 24 giờ.';
const errorText = 'Chưa gửi được. Vui lòng thử lại hoặc email cho chúng tôi.';
function setup({ result = 'success', pending = false, formEndpoint = endpoint(html) } = {}) {
  let now = 1793354400000;
  class Node {
    constructor(attrs = {}, value = '') {
      this.attrs = { ...attrs }; this.value = value; this.id = attrs.id;
      this.textContent = ''; this.children = []; this.disabled = false;
      this.maxLength = Number(attrs.maxlength ?? -1); this.listeners = new Map();
      this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    get validity() {
      const valueMissing = this.required && !this.value;
      const typeMismatch = this.attrs.type === 'email' && this.value && !/^[^@\s]+@[^@\s]+$/.test(this.value);
      return { valueMissing, typeMismatch, valid: !valueMissing && !typeMismatch };
    }
    addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) || []), fn]); }
    async emit(name) { for (const fn of this.listeners.get(name) || []) await fn({ preventDefault() {} }); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    replaceChildren(...nodes) { this.children = []; this.textContent = ''; this.append(...nodes); }
    append(...nodes) { this.children.push(...nodes); this.textContent += nodes.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
    focus() { document.activeElement = this; }
  }
  const inputs = [...formMarkup.matchAll(/<(input|textarea|select)\b([^>]*?)(?:\/>|>)/g)].map(match => {
    const [, tag, attrs] = match;
    const parsed = attributes(attrs);
    const firstOption = tag === 'select' ? formMarkup.slice(match.index + match[0].length).match(/<option\b[^>]*value="([^"]*)"/)[1] : '';
    const control = new Node(parsed, parsed.value ?? firstOption);
    control.required = /\brequired\b/.test(attrs);
    return control;
  });
  const nodes = new Map(inputs.filter(input => input.id).map(input => [input.id, input]));
  for (const id of ['enquiry-form', 'enquiry-fields', 'submit-button', 'form-message']) nodes.set(id, new Node({ id }));
  const visible = inputs.filter(input => input.attrs.type !== 'hidden' && input.attrs.name !== 'website');
  for (const input of visible) nodes.set(input.id + '-error', new Node());
  const form = nodes.get('enquiry-form');
  form.dataset = { formEndpoint };
  form.querySelectorAll = () => visible;
  nodes.get('enquiry-fields').disabled = true;
  const document = new Node();
  document.getElementById = id => nodes.get(id);
  document.createElement = () => new Node();
  const timers = new Map();
  const window = new Node();
  window.setTimeout = (fn, ms) => { assert.equal(ms, 20000); timers.set(1, fn); return 1; };
  window.clearTimeout = id => timers.delete(id);
  const requests = [];
  let resolveFetch;
  const response = { ok: result !== 'http-error', json: async () => {
    if (result === 'invalid-json') throw new SyntaxError('Invalid JSON');
    return { ok: result !== 'rejected' };
  } };
  const context = vm.createContext({
    document, window, URLSearchParams, AbortController, Date: { now: () => now },
    FormData: class {
      constructor() {
        assert.equal(nodes.get('enquiry-fields').disabled, false);
        this.entries = inputs.filter(input => !input.disabled).map(input => [input.attrs.name, input.value]);
      }
      [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (result === 'network-error') throw new Error('Offline');
      if (result === 'timeout') return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted'))));
      if (pending) await new Promise(resolve => { resolveFetch = resolve; });
      return response;
    }
  });
  vm.runInContext(script, context, { filename: 'hoc-tieng-anh.js' });
  const set = (id, value) => { nodes.get(id).value = value; };
  const valid = () => {
    set('contact-name', ' Nguyễn An '); set('email', ' test@example.invalid ');
    set('phone', '+84 912 345 678'); set('age-year', 'Lớp 8'); set('support-needed', 'Giao tiếp tự tin.');
    now += 5000;
  };
  return { nodes, form, window, document, timers, requests, valid, set,
    submit: () => form.emit('submit'), resolve: () => resolveFetch(), advance: ms => { now += ms; } };
}

for (const learner of ['Học sinh', 'Luyện thi IELTS', 'Người đi làm']) for (const teacher of teacherChoices) {
  const page = setup(); page.valid(); page.set('learner', learner);
  page.set('teacher', teacher);
  page.set('traffic-source', 'utm-source-that-must-not-override');
  page.set('traffic-medium', 'zalo'); page.set('campaign-name', 'autumn');
  await page.submit();
  assert.equal(page.requests.length, 1);
  const request = page.requests[0];
  assert.equal(request.url, endpoint(contact));
  assert.equal(request.method, 'POST');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.redirect, 'follow');
  assert.equal(request.cache, 'no-store');
  assert.equal(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.ok(request.signal instanceof AbortSignal);
  const payload = Object.fromEntries(request.body);
  assert.deepEqual(payload, {
    // Only values the UK form already sends: the shared endpoint validates them.
    loaded_at: '1793354400000', 'Preferred format': 'online',
    'Town or postcode area': 'Vietnam', 'Reply method': 'email', 'Campaign source': 'Direct or unknown',
    'Traffic source': 'vietnam-page', 'Traffic medium': 'zalo', 'Campaign name': 'autumn', website: '',
    'Contact name': 'Nguyễn An', email: 'test@example.invalid', Learner: learner === 'Học sinh' ? 'child' : 'adult',
    'Age or school year': 'Lớp 8',
    'Support requested': `Subject: English (Vietnam)\nHọc viên là: ${learner}\nGiáo viên mong muốn: ${teacher}\nSố điện thoại / Zalo: +84 912 345 678\nGiao tiếp tự tin.`
  });
  assert.equal(page.nodes.get('form-message').textContent, successText);
  assert.equal(page.nodes.get('form-message').getAttribute('role'), 'status');
  assert.equal(page.nodes.get('form-message').getAttribute('aria-live'), 'polite');
  assert.ok(page.nodes.get('form-message').classes.has('is-success'));
  assert.equal(page.document.activeElement, page.nodes.get('form-message'));
  assert.equal(page.nodes.get('enquiry-fields').disabled, true);
  assert.equal(page.form.getAttribute('aria-busy'), null);
  assert.equal(page.timers.size, 0);
  await page.submit(); assert.equal(page.requests.length, 1, 'Success prevents repeat submission');
}
for (const result of ['http-error', 'rejected', 'invalid-json', 'network-error']) {
  const page = setup({ result }); page.valid();
  await page.submit();
  assert.equal(page.nodes.get('form-message').textContent, errorText + ' hello@toucanlearn.co.uk');
  assert.equal(page.nodes.get('form-message').children.at(-1).href, 'mailto:hello@toucanlearn.co.uk');
  assert.equal(page.nodes.get('submit-button').disabled, false);
  assert.equal(page.nodes.get('submit-button').textContent, 'Gửi đăng ký');
  assert.equal(page.nodes.get('email').value, 'test@example.invalid', 'Failed submission keeps the enquiry');
  assert.equal(page.form.getAttribute('aria-busy'), null);
  assert.equal(page.timers.size, 0);
  await page.submit(); assert.equal(page.requests.length, 2, 'Failure permits retry');
}
{
  const page = setup({ result: 'timeout' }); page.valid();
  const submission = page.submit();
  page.timers.get(1)();
  await submission;
  assert.equal(page.requests[0].signal.aborted, true);
  assert.equal(page.nodes.get('form-message').textContent, errorText + ' hello@toucanlearn.co.uk');
  assert.equal(page.nodes.get('submit-button').disabled, false);
}
{
  const page = setup({ pending: true }); page.valid();
  const submission = page.submit();
  assert.equal(page.form.getAttribute('aria-busy'), 'true');
  assert.equal(page.nodes.get('submit-button').textContent, 'Đang gửi…');
  await page.submit(); assert.equal(page.requests.length, 1, 'Busy form blocks duplicate requests');
  page.resolve(); await submission;
}
{
  const page = setup();
  await page.submit();
  assert.equal(page.requests.length, 0);
  assert.equal(page.nodes.get('contact-name').getAttribute('aria-invalid'), 'true');
  assert.equal(page.document.activeElement, page.nodes.get('contact-name'));
  page.valid(); page.set('email', 'invalid@address');
  await page.submit(); assert.equal(page.requests.length, 0);
  assert.equal(page.nodes.get('email-error').textContent, 'Vui lòng nhập địa chỉ email hợp lệ.');
  page.set('email', 'test@example.invalid'); page.set('contact-name', 'x'.repeat(121));
  await page.submit(); assert.equal(page.requests.length, 0);
  assert.equal(page.nodes.get('contact-name-error').textContent, 'Vui lòng rút ngắn thông tin này.');
}
for (const protection of ['honeypot', 'too-fast', 'future', 'missing-time']) {
  const page = setup(); page.valid();
  if (protection === 'honeypot') page.set('company-website', 'spam.example');
  if (protection === 'too-fast') page.advance(-4000);
  if (protection === 'future') page.set('loaded-at', '1993354400000');
  if (protection === 'missing-time') page.set('loaded-at', '');
  await page.submit(); assert.equal(page.requests.length, 0, protection);
}
{
  const page = setup({ formEndpoint: 'https://example.invalid/exec' }); page.valid();
  await page.submit(); assert.equal(page.requests.length, 0, 'Reject an invalid endpoint');
  assert.equal(page.nodes.get('form-message').textContent, errorText + ' hello@toucanlearn.co.uk');
}
{
  const page = setup();
  page.set('traffic-source', 'stored-source');
  await page.document.emit('DOMContentLoaded');
  assert.equal(page.nodes.get('traffic-source').value, 'vietnam-page');
  page.set('traffic-source', 'stored-source');
  await page.window.emit('pageshow');
  assert.equal(page.nodes.get('traffic-source').value, 'vietnam-page');
  await page.submit();
  assert.equal(page.nodes.get('contact-name').getAttribute('aria-invalid'), 'true');
  await page.form.emit('input');
  assert.equal(page.nodes.get('contact-name').getAttribute('aria-invalid'), null);
  assert.equal(page.nodes.get('contact-name-error').textContent, '');
}
{
  const page = setup(); page.valid();
  page.set('phone', ''); page.set('age-year', ''); page.set('support-needed', '');
  await page.submit(); assert.equal(page.requests.length, 1, 'Only name and email are required');
  assert.equal(page.requests[0].body.get('Support requested'), `Subject: English (Vietnam)\nHọc viên là: Học sinh\nGiáo viên mong muốn: ${teacherChoices[0]}\n`, 'The default advice choice is included without a phone number');
  assert.equal(page.requests[0].body.has('Preferred teacher'), false, 'Teacher choice is sent only within the message');
}
console.log('PASS: Vietnamese copy, three teacher cards/portraits, teacher choices in message-only payloads, shared assets/CSP/navigation, both clean routes, tracking, validation, spam guards, duplicate protection, timeout, success and retry states. Live Apps Script acceptance and layout remain unverified.');
