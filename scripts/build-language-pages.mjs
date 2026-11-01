// Builds the full-site language copies in /vi/ /es/ /fr/ /it/ from the English pages.
// Owner, 31 Oct: every language is a clone of the whole site (same layout, sections and
// pictures) with only the words translated. Learner projects stay in English,
// except the DARTY mission requested in every language on 1 Nov.
// English HTML is the only layout source; i18n/<lang>.json maps each English unit to its words.
//   node scripts/build-language-pages.mjs            write the clones (fails on any missing words)
//   node scripts/build-language-pages.mjs --lang vi  build one language
//   node scripts/build-language-pages.mjs --extract  refresh i18n/strings.json from the English pages
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pages = ['index', 'children', 'adults', 'subjects', 'approach', 'team', 'contact', 'thank-you'];
export const languages = {
  vi: { name: 'Tiếng Việt', locale: 'vi_VN', flag: 'vn' },
  es: { name: 'Español', locale: 'es_ES', flag: 'es' },
  fr: { name: 'Français', locale: 'fr_FR', flag: 'fr' },
  it: { name: 'Italiano', locale: 'it_IT', flag: 'it' },
};
const origin = 'https://toucanlearn.co.uk';
const switchVersion = '20261101-flags-4';
const textVersion = '20261101-darty-mission-1';
const dartyMission = 'Turning writing from the last thing he wanted to do into how he builds his own game.';

// Lossless tokens: tag spelling, attribute order and whitespace are kept; script/style stay raw.
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', rarr: '→', larr: '←', middot: '·', pound: '£' };
export const decode = value => value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key) => key[0] !== '#' ? entities[key] ?? all
  : String.fromCodePoint(/^#x/i.test(key) ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)));
const escapeAttr = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const normalise = value => value.replace(/\s+/gu, ' ').trim();
function attributes(tag) {
  return [...tag.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].slice(1)
    .map(m => ({ name: m[1].toLowerCase(), value: decode(m[2] ?? m[3] ?? m[4] ?? ''), raw: m[0], index: m.index }));
}
function setAttr(tag, name, value) {
  const attr = attributes(tag).find(a => a.name === name);
  const replacement = `${name}="${escapeAttr(value)}"`;
  return attr ? tag.slice(0, attr.index) + replacement + tag.slice(attr.index + attr.raw.length) : tag.replace(/\s*\/?>$/, end => ` ${replacement}${end}`);
}
// Skipped: learner projects (homepage caption and Children project slides; the intro slide is translated),
// anything marked data-i18n-skip, the language switch, and text already in another language.
const skips = attrs => 'data-i18n-skip' in attrs || 'data-i18n-switch' in attrs || 'data-project-caption' in attrs
  || ('data-project-slide' in attrs && attrs['data-project'] !== 'intro') || (attrs.lang && !attrs.lang.startsWith('en'));
function tokens(html) {
  const result = [], stack = [];
  const pattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+|</g;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = match[0], tag = raw.match(/^<(\/?)([\w:-]+)/);
    const token = { raw, start: match.index, end: match.index + raw.length, kind: tag ? 'tag' : raw.startsWith('<!') ? 'comment' : 'text', skip: !!stack.at(-1)?.skip };
    if (tag) {
      token.name = tag[2].toLowerCase();
      token.close = !!tag[1];
      if (token.close) {
        const at = stack.map(t => t.name).lastIndexOf(token.name);
        if (at !== -1) stack.length = at;
      } else {
        token.attrs = Object.fromEntries(attributes(raw).map(a => [a.name, a.value]));
        token.skip ||= skips(token.attrs);
        if (!voidTags.has(token.name) && !raw.endsWith('/>')) stack.push(token);
        if (['script', 'style'].includes(token.name)) {
          result.push(token);
          const end = html.toLowerCase().indexOf(`</${token.name}`, pattern.lastIndex);
          if (end < 0) throw new Error(`Unclosed ${token.name}`);
          result.push({ raw: html.slice(pattern.lastIndex, end), start: pattern.lastIndex, end, kind: 'raw', skip: true });
          pattern.lastIndex = end;
          continue;
        }
      }
    }
    result.push(token);
  }
  return result;
}
function tree(html) {
  const top = { kind: 'root', children: [] };
  const stack = [top];
  for (const token of tokens(html)) {
    if (token.kind === 'tag' && token.close) {
      const at = stack.map(node => node.name).lastIndexOf(token.name);
      if (at < 1) throw new Error(`Stray </${token.name}> at ${token.start}`);
      for (const node of stack.splice(at)) node.end = token.end;
      continue;
    }
    const node = { ...token, children: [] };
    stack.at(-1).children.push(node);
    if (token.kind === 'tag' && !voidTags.has(token.name) && !token.raw.endsWith('/>')) stack.push(node);
  }
  return top;
}

// A unit is a run of text and inline markup inside one block: a heading, a paragraph, a link.
// Translators keep its tags, so links and emphasis survive in every language.
const inlineTags = new Set('a abbr b br cite code em i mark q s small span strong sub sup time u'.split(' '));
const inline = node => node.kind === 'text' || node.kind === 'comment'
  || (node.kind === 'tag' && inlineTags.has(node.name) && !node.skip && node.children.every(inline));
const hasWords = html => /\p{L}/u.test(decode(html.replace(/<[^>]*>/g, ' ')));
function units(html) {
  const found = [];
  const visit = node => {
    if (node.skip || ['script', 'style', 'svg', 'template', 'head'].includes(node.name)) return;
    let run = [];
    const flush = () => {
      if (run.length) {
        const raw = html.slice(run[0].start, run.at(-1).end);
        const start = run[0].start + raw.length - raw.trimStart().length;
        if (hasWords(raw)) found.push({ start, end: start + raw.trim().length, key: normalise(raw) });
      }
      run = [];
    };
    for (const child of node.children) {
      if (inline(child)) run.push(child);
      else { flush(); visit(child); }
    }
    flush();
  };
  const top = tree(html);
  visit(top);
  // Owner, 1 Nov: translate this mission even inside the otherwise-English project slides.
  for (const token of tokens(html)) {
    if (token.kind === 'text' && token.skip && normalise(token.raw) === dartyMission) {
      found.push({ start: token.start, end: token.end, key: dartyMission });
    }
  }
  // The head's title is the only head text that is read aloud or shown.
  const title = html.match(/<title>([\s\S]*?)<\/title>/);
  if (title) found.push({ start: title.index + 7, end: title.index + 7 + title[1].length, key: normalise(title[1]) });
  return found;
}
const textAttributes = new Set(['alt', 'title', 'aria-label', 'aria-roledescription', 'placeholder', 'data-success-message', 'data-theme-light-label', 'data-theme-dark-label', 'label']);
const translatableAttribute = (token, name) => textAttributes.has(name)
  || (token.name === 'meta' && name === 'content' && /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)$/.test(token.attrs.name || token.attrs.property || ''));
function attributeStrings(html) {
  const found = [];
  for (const token of tokens(html)) {
    if (token.kind !== 'tag' || token.close || token.skip) continue;
    for (const [name, value] of Object.entries(token.attrs)) if (translatableAttribute(token, name) && hasWords(value)) found.push(normalise(value));
  }
  return found;
}

// Same page in each language: /, /children; /vi/, /vi/children.
export const pagePath = (page, lang) => `${lang === 'en' ? '' : `/${lang}`}/${page === 'index' ? '' : page}`;
function localURL(value, page, lang) {
  if (!value || value.startsWith('#') || /^(?:data:|mailto:|tel:|javascript:)/i.test(value)) return value;
  const url = new URL(value, origin + pagePath(page, 'en'));
  if (url.origin !== origin) return value;
  const stem = url.pathname.replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index';
  const local = (pages.includes(stem) ? pagePath(stem, lang) : url.pathname) + url.search + url.hash;
  return /^https?:/i.test(value) ? origin + local : local;
}
const urlAttributes = ['href', 'src', 'poster', 'action'];

// The switch links each page to the same page in every language.
// Owner, 1 Nov: the menu shows the current language's flag; each choice shows its flag and name.
// SVG flags from flag-icons (MIT; assets/flags): emoji flags differ by device and show as letters on Windows.
const flag = code => `<img class="language-flag" src="/assets/flags/${code}.svg?v=20261101-2" alt="" width="21" height="16">`;
function languageSwitch(page, lang, mobile) {
  const all = [['en', 'English', 'en-GB', 'gb'], ...Object.entries(languages).map(([code, { name, flag }]) => [code, name, code, flag])];
  const current = all.find(([code]) => code === lang);
  const links = all.map(([code, name, tag, flagCode]) => `<li><a href="${pagePath(page, code)}" lang="${tag}" hreflang="${tag}"${code === lang ? ' aria-current="true"' : ''}>${flag(flagCode)} ${name}</a></li>`).join('');
  return `<details class="${mobile ? 'mobile-nav-item' : 'nav-item'} language-switch" data-i18n-switch><summary>${flag(current[3])}<span class="visually-hidden">${current[1]}</span> <span class="nav-chevron" aria-hidden="true">▾</span></summary><ul class="${mobile ? 'mobile-sub-links' : 'nav-dropdown'}">${links}</ul></details>`;
}
function alternates(page, lang) {
  const link = (tag, code) => `  <link rel="alternate" hreflang="${tag}" href="${origin}${pagePath(page, code)}" />\n`;
  return link('en-GB', 'en') + Object.keys(languages).map(code => link(code, code)).join('') + link('x-default', 'en')
    // Not deferred: the page's own scripts at the end of the body read it as they run.
    + (lang === 'en' ? '' : `  <script src="/language-text-${lang}.js?v=${textVersion}"></script>\n`);
}
const switchAssets = `  <link rel="stylesheet" href="/language-switch.css?v=${switchVersion}" />\n  <script src="/language-switch.js?v=${switchVersion}" defer></script>\n`;
const switchPattern = /<details class="[^"]*language-switch[^"]*"[^>]*>[\s\S]*?<\/details>/g;
const headPattern = /  <link rel="alternate" hreflang[^>]*>\n|  <link rel="stylesheet" href="\/?language-switch\.css[^>]*>\n|  <script src="\/?language-(?:switch|forms|text(?:-\w+)?)\.js[^>]*><\/script>\n/g;
// Idempotent: the English pages carry the switch and alternates; the build refreshes them.
export function withSwitch(html, page, lang = 'en') {
  let out = html.replace(switchPattern, '').replace(headPattern, '');
  // Straight after the canonical link: language-text.js must run before the deferred page scripts.
  out = out.replace(/(<link rel="canonical"[^>]*>\n)/, line => line + alternates(page, lang));
  // Last in the head, so the switch styles follow the shared navigation styles.
  out = out.replace('</head>', `${switchAssets}</head>`);
  out = out.replace('<button class="theme-toggle"', `${languageSwitch(page, lang, false)}<button class="theme-toggle"`);
  // The mobile menu's label is already translated in the copies.
  out = out.replace(/<nav data-nosnippet aria-label="[^"]*">/, match => match + languageSwitch(page, lang, true));
  if ((out.match(switchPattern) || []).length !== 2) throw new Error(`${page}: expected one desktop and one mobile language switch`);
  return out;
}

function sameTags(source, translated) {
  const tags = html => (html.match(/<[^>]+>/g) || []).map(tag => tag.replace(/\s+/g, ' ')).sort().join('\n');
  return tags(source) === tags(translated);
}
export function clone(english, page, lang, words) {
  const missing = [];
  const word = (key, kind) => {
    const value = words[key];
    if (typeof value !== 'string' || !value.trim()) { missing.push(`${kind}: ${key}`); return null; }
    return value;
  };
  // Pass 1: text units, replaced from the end so earlier offsets stay valid.
  let html = english;
  for (const unit of units(english).sort((a, b) => b.start - a.start)) {
    const value = word(unit.key, 'text');
    if (value === null) continue;
    if (!sameTags(unit.key, value)) { missing.push(`tags changed: ${unit.key} → ${value}`); continue; }
    html = html.slice(0, unit.start) + value + html.slice(unit.end);
  }
  // Pass 2: attributes and URLs, tag by tag.
  let out = '';
  for (const token of tokens(html)) {
    if (token.kind !== 'tag' || token.close) { out += token.raw; continue; }
    let tag = token.raw;
    if (token.name === 'html') tag = setAttr(tag, 'lang', lang);
    if (token.name === 'meta' && token.attrs.property === 'og:locale') tag = setAttr(tag, 'content', languages[lang].locale);
    if (!token.skip) for (const [name, value] of Object.entries(token.attrs)) {
      if (!translatableAttribute(token, name) || !hasWords(value)) continue;
      // "[aria-label] Primary" overrides "Primary" where one English word needs two translations.
      const key = normalise(value);
      const translated = typeof words[`[${name}] ${key}`] === 'string' ? words[`[${name}] ${key}`] : word(key, name);
      if (translated !== null) tag = setAttr(tag, name, translated);
    }
    if (!('hreflang' in token.attrs)) {
      for (const name of urlAttributes) if (name in token.attrs) tag = setAttr(tag, name, localURL(token.attrs[name], page, lang));
      if ('srcset' in token.attrs) tag = setAttr(tag, 'srcset', token.attrs.srcset.split(',').map(item => item.trim().replace(/^\S+/, url => localURL(url, page, lang))).join(', '));
      if (token.name === 'meta' && /^(og:url|og:image|twitter:image)$/.test(token.attrs.property || token.attrs.name || '')) tag = setAttr(tag, 'content', localURL(token.attrs.content, page, lang));
    }
    out += tag;
  }
  if (missing.length) throw new Error(`${lang}/${page}: ${missing.length} missing or broken translations\n  ${[...new Set(missing)].slice(0, 20).join('\n  ')}`);
  return withSwitch(out, page, lang);
}

// Text the site's scripts add: form messages, carousel labels, the launch offer. One small file per language.
export function scriptText(lang) {
  const { forms, ui } = JSON.parse(fs.readFileSync(path.join(root, 'i18n/script-strings.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(root, `i18n/${lang}.json`), 'utf8')).script;
  const missing = [...forms, ...ui].filter(key => typeof words[key] !== 'string' || !words[key].trim());
  if (missing.length) throw new Error(`${lang}: missing script text\n  ${missing.join('\n  ')}`);
  const text = Object.fromEntries([...forms, ...ui].map(key => [key, words[key]]));
  return `// Generated by scripts/build-language-pages.mjs from i18n/${lang}.json: edit that, not this file.
// Words for the text the site's scripts add on the ${languages[lang].name} pages.
window.toucanText = ${JSON.stringify(text, null, 1)};
`;
}

export function extract() {
  const seen = new Map();
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
    for (const key of [...units(html).map(unit => unit.key), ...attributeStrings(html)]) {
      if (!seen.has(key)) seen.set(key, []);
      if (!seen.get(key).includes(page)) seen.get(key).push(page);
    }
  }
  return Object.fromEntries(seen);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const page of pages) {
    const file = path.join(root, `${page}.html`);
    const html = fs.readFileSync(file, 'utf8');
    const updated = withSwitch(html, page);
    if (updated !== html) fs.writeFileSync(file, updated);
  }
  if (process.argv.includes('--extract')) {
    fs.writeFileSync(path.join(root, 'i18n/strings.json'), JSON.stringify(extract(), null, 1) + '\n');
  } else {
    // --lang vi builds one language, so each translation can be checked on its own.
    const only = process.argv[process.argv.indexOf('--lang') + 1];
    for (const lang of Object.keys(languages).filter(code => !process.argv.includes('--lang') || code === only)) {
      const words = JSON.parse(fs.readFileSync(path.join(root, `i18n/${lang}.json`), 'utf8')).page;
      fs.mkdirSync(path.join(root, lang), { recursive: true });
      for (const page of pages) {
        const english = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
        fs.writeFileSync(path.join(root, lang, `${page}.html`), clone(english, page, lang, words));
      }
    }
    if (!process.argv.includes('--lang')) {
      for (const lang of Object.keys(languages)) fs.writeFileSync(path.join(root, `language-text-${lang}.js`), scriptText(lang));
      // Each English page in the sitemap lists its copies straight after it.
      const sitemap = path.join(root, 'sitemap.xml');
      const english = fs.readFileSync(sitemap, 'utf8').replace(/\n  <url><loc>https:\/\/toucanlearn\.co\.uk\/(?:vi|es|fr|it)\/[^<]*<\/loc><\/url>/g, '');
      fs.writeFileSync(sitemap, english.replace(/(  <url><loc>https:\/\/toucanlearn\.co\.uk\/([^<]*)<\/loc><\/url>)/g, (line, all, stem) => {
        const page = stem || 'index';
        return pages.includes(page) ? [line, ...Object.keys(languages).map(lang => `  <url><loc>${origin}${pagePath(page, lang)}</loc></url>`)].join('\n') : line;
      }));
    }
  }
}
