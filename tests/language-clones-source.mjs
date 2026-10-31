// Owner, 31 Oct: the language versions are full clones of the site. Every copy keeps the English
// page's layout tag for tag; only words change, and the learner projects stay in English.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pages, languages, pagePath, clone, withSwitch, scriptText } from '../scripts/build-language-pages.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
// Tag names and every non-text attribute, in order: the page's skeleton.
const keep = new Set(['class', 'id', 'type', 'role', 'width', 'height', 'loading', 'decoding', 'data-project', 'aria-hidden']);
const skeleton = html => [...html.replace(/<script src="\/language-text-\w+\.js[^"]*"><\/script>/, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '<script></script>').replace(/<details class="[^"]*language-switch[\s\S]*?<\/details>/g, '').replace(/<link rel="alternate" hreflang[^>]*>/g, '')
  .matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)].map(([, close, name, attrs]) => close + name + [...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].filter(([, key]) => keep.has(key)).map(([, key, value]) => ` ${key}=${value}`).join('')).join('\n');
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const projects = html => [...html.matchAll(/<article class="framework-project" data-project-slide data-project="(?!intro)[\s\S]*?<\/article>/g)].map(match => text(match[0]));
let checks = 0;
for (const page of pages) {
  const english = read(`${page}.html`);
  assert.equal(withSwitch(english, page), english, `${page}: English page carries the current language switch`);
  for (const lang of Object.keys(languages)) {
    const file = `${lang}/${page}.html`;
    const copy = read(file);
    const words = JSON.parse(read(`i18n/${lang}.json`)).page;
    assert.equal(copy, clone(english, page, lang, words), `${file}: rebuilt from the current English page`);
    const [a, b] = [skeleton(copy).split('\n'), skeleton(english).split('\n')];
    const at = a.findIndex((line, i) => line !== b[i]);
    assert.equal(at, -1, `${file}: same layout as English, tag for tag (first difference: ${a.slice(at - 3, at + 3).join(' | ')} vs ${b.slice(at - 3, at + 3).join(' | ')})`);
    assert.match(copy, new RegExp(`<html lang="${lang}"`));
    assert.match(copy, new RegExp(`<link rel="canonical" href="https://toucanlearn\\.co\\.uk${pagePath(page, lang).replaceAll('/', '\\/')}" />`));
    for (const code of ['en-GB', ...Object.keys(languages), 'x-default']) assert.match(copy, new RegExp(`hreflang="${code}" href=`), `${file}: ${code} alternate`);
    assert.deepEqual(projects(copy), projects(english), `${file}: learner projects stay in English`);
    assert.doesNotMatch(text(copy), /psic[oó]log[oa]s?\b|psychologue|nhà tâm lý học|psychologist/i, `${file}: never "psychologist"`);
    assert.doesNotMatch(copy, /Henley/);
    assert.doesNotMatch(copy, /(?:src|href)="(?!https?:|\/|#|mailto:|tel:|data:)/, `${file}: every link and asset resolves from the language folder`);
    checks++;
  }
}
for (const lang of Object.keys(languages)) assert.equal(read(`language-text-${lang}.js`), scriptText(lang), `language-text-${lang}.js is generated from the current translations`);
console.log(`PASS: ${checks} language copies match their English pages.`);
