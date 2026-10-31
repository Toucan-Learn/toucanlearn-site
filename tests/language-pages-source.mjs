// Offline language coverage, content boundaries and nested-route checks.
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homeNavigationMarkup } from './helpers/navigation-markup.mjs';
import { fixture } from './helpers/navigation-dom.mjs';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const names = { 'en-GB': 'English', vi: 'Tiếng Việt', es: 'Español', fr: 'Français', it: 'Italiano' };
const homes = { 'en-GB': '/', vi: '/vi/', es: '/es/', fr: '/fr/', it: '/it/' };
const teams = { 'en-GB': '/team', vi: '/vi/giao-vien', es: '/es/equipo', fr: '/fr/equipe', it: '/it/insegnanti' };
const contacts = { 'en-GB': '/contact', vi: '/hoc-tieng-anh', es: '/es/contact', fr: '/fr/contact', it: '/it/contact' };
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
const text = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const section = (html, tag) => html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`))?.[0];
const forbidden = /psychologist|psicólogo|psychologue|psicologo|nhà tâm lý học/iu;
const prices = /[£€$]\s*\d|\d[\d.,]*\s*(?:[£€$₫đ]|GBP|EUR|VND)\b/iu;
const localeFiles = [];
for (const lang of ['vi', 'es', 'fr', 'it']) {
  const files = (await readdir(new URL(lang + '/', root))).filter(f => f.endsWith('.html'));
  assert.equal(files.length, lang === 'vi' ? 4 : 3);
  localeFiles.push(...files.map(file => [lang, `${lang}/${file}`]));
}
localeFiles.push(['vi', 'hoc-tieng-anh.html']);
const contact = await read('contact.html');
const form = html => section(html, 'form');
const controls = html => [...form(html).matchAll(/<(?:input|textarea|select|option)\b[^>]*>/g)].map(([tag]) => {
  const a = attrs(tag);
  return Object.fromEntries(['id','name','type','value','maxlength','autocomplete','aria-describedby'].filter(k => k in a).map(k => [k, a[k]]));
});
function switches(html, lang) {
  const menus = [...section(html, 'header').matchAll(/<details class="(?:nav-item|mobile-nav-item) language-switch">[\s\S]*?<\/details>/g)].map(m => m[0]);
  assert.equal(menus.length, 2, 'Desktop and mobile switches exist in source without JS');
  for (const menu of menus) {
    assert(menu.includes(`<summary>${names[lang]} <span class="nav-chevron" aria-hidden="true">▾</span></summary>`));
    const links = [...menu.matchAll(/<a\b[^>]*>[^<]*<\/a>/g)].map(m => [attrs(m[0]), text(m[0])]);
    assert.deepEqual(links.map(([a, t]) => [a.href, a.lang, a.hreflang, t]), Object.entries(homes).map(([l,u]) => [u,l,l,names[l]]));
    assert.equal(links.filter(([a]) => a['aria-current']).length, 1);
    assert(links.find(([a]) => a.lang === lang)[0]['aria-current']);
  }
}
for (const [lang, file] of localeFiles) {
  const html = await read(file);
  assert.match(html, new RegExp(`<html lang="${lang}"`), file);
  switches(html, lang);
  assert.doesNotMatch(html, forbidden, file);
  if (lang !== 'vi') assert.doesNotMatch(text(html), prices, file);
  if (lang === 'vi') {
    for (const amount of text(html).match(/\d[\d.]*đ\s*\/\s*giờ/g) || []) assert(['500.000đ / giờ','650.000đ / giờ'].includes(amount), `${file}: only existing Vietnamese prices`);
  }
  const route = file === 'hoc-tieng-anh.html' ? '/hoc-tieng-anh' : '/' + file.replace(/index\.html$/, '').replace(/\.html$/, '');
  const group = file.endsWith('index.html') ? homes : Object.values(teams).includes(route) ? teams : Object.values(contacts).includes(route) ? contacts : file.endsWith('cach-hoc.html') ? { 'en-GB': '/approach', vi: route } : { 'en-GB': '/#reviews', vi: route };
  const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(([tag]) => { const a=attrs(tag); return [a.hreflang,a.href]; }));
  assert.deepEqual(alternates, Object.fromEntries(Object.entries({...group,'x-default':'/'}).map(([l,u])=>[l,'https://toucanlearn.co.uk'+u])), file);
  assert(html.includes(`rel="canonical" href="https://toucanlearn.co.uk${route}"`));
  assert.doesNotMatch(html, /<style\b|\s(?:style|on\w+)\s*=|unsafe-inline|unsafe-eval/i, file);
  for (const [,a,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) { assert.match(a,/\bsrc="/); assert.equal(body.trim(),''); }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,`${file}: unique IDs`);
  for (const [,targets] of html.matchAll(/\b(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)) for (const id of targets.split(' ')) assert(ids.includes(id),`${file}: ${id}`);
  for (const [,url] of html.matchAll(/(?:href|src)="([^"?]+)(?:\?[^"]*)?"/g)) {
    if (/^(?:https?:|mailto:|tel:)/.test(url)) continue;
    if (url.startsWith('#')) { assert(ids.includes(url.slice(1))); continue; }
    const u = new URL(url, 'https://toucanlearn.co.uk'+route);
    let p=u.pathname.slice(1);
    if (p.endsWith('/') || !p) p+='index.html';
    else if (!/\.[a-z\d]+$/i.test(p)) p+='.html';
    await access(new URL(p,root));
  }
  assert.match(section(html,'footer'), /Who can learn\?<br \/>You can learn\.<br \/><a[^>]*>@toucan_learn<\/a>/);
  if (file.endsWith('/contact.html')) {
    assert.equal(attrs(form(html))['data-form-endpoint'],attrs(form(contact))['data-form-endpoint']);
    assert.deepEqual(controls(html),controls(contact),`${file}: all original field names, options, tracking and limits`);
    assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0],contact.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0]);
    assert(html.indexOf('src="/campaigns.js')<html.indexOf('src="/menu.js'));
    assert(html.indexOf('src="/language-forms.js')<html.indexOf('src="/contact.js'));
    assert(html.indexOf('src="/subject-select.js')<html.indexOf('src="/contact.js'));
    assert(!html.includes('class="contact-pricing"'));
  }
}
// Every pre-existing English page keeps its exact body outside the two disclosures.
const originals=execFileSync('git',['ls-files','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const file of originals) {
  const before=execFileSync('git',['show',`HEAD:${file}`],{cwd:root,encoding:'utf8'});
  if (!/<html lang="en-GB"/.test(before)) continue;
  const after=await read(file);
  assert.equal(homeNavigationMarkup(after),homeNavigationMarkup(before),`${file}: only switch and alternate links may change`);
  if(before.includes('<header')) switches(after,'en-GB');
  if(file!=='contact.html') assert.doesNotMatch(text(after),prices,`${file}: no new prices`);
}
const viHome=await read('vi/index.html'), englishHome=await read('index.html');
const world=html=>html.match(/<div class="hero-world"[^>]*>[\s\S]*?<\/section>/)[0].replace(' lang="en-GB"','').replaceAll('src="/assets/','src="assets/');
assert.equal(world(viHome),world(englishHome),'The entire English showcase and its captions are preserved');
assert.match(await read('vi/cach-hoc.html'),/Báo cáo tiến bộ hằng tuần/);
assert.match(await read('vi/danh-gia.html'),/Dịch từ tiếng Anh/);
assert.equal((await read('vi/danh-gia.html')).match(/<blockquote>/g).length,5);
for(const [l,people] of Object.entries({vi:['aaron','joshua','nhu'],es:['joshua','aaron','joan'],fr:['joshua','aaron','owen'],it:['joshua','aaron','sara']})) {
  const html=await read(teams[l].slice(1)+'.html');
  assert.deepEqual([...html.matchAll(/<article[^>]* id="([^"]+)"/g)].map(m=>m[1]),people);
}
// Nested contact routes capture attribution before navigation cleans the address.
for(const lang of ['es','fr','it']) {
  const page=fixture(`https://example.test/${lang}/contact?utm_source=ads&utm_medium=cpc&utm_campaign=english`);
  await page.run('campaigns.js'); await page.run('menu.js');
  for(const id of ['campaign-source','traffic-source','traffic-medium','campaign-name']) page.document.body.append(page.node('input',{id}));
  page.emit(page.document,'DOMContentLoaded'); await page.load();
  assert.equal(page.document.getElementById('traffic-source').value,'ads');
  assert.equal(page.document.getElementById('traffic-medium').value,'cpc');
  assert.equal(page.document.getElementById('campaign-name').value,'english');
  assert.equal(page.location.pathname,`/${lang}/contact`); assert.equal(page.location.search,'');
}
// Root-relative runtime media must resolve identically from /vi/ and /.
for(const file of ['project-showcase.js','drink-spin.js','hero-sky.js','hero-sky-shaders.js']) {
  const source=await read(file);
  assert.doesNotMatch(source,/["'`]assets\//,`${file}: no document-relative media`);
}
for (const l of ['vi','es','fr','it']) {
  const review=await read(`translations-review/${l}.md`);
  for(const [lang,file] of localeFiles.filter(([lang])=>lang===l)) assert(review.includes(file),file+' is in the native-speaker review');
}
console.log(`PASS: ${localeFiles.length} language pages, desktop/mobile switches, equivalents, English/ad-body boundaries, CSP, asset paths, original form fields, nested attribution and review files. Browser layout remains for owner review.`);
