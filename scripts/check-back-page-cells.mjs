// Claude: serve this worktree, set BASE_URL, then run this script with the existing Chrome.
// --source-only needs no browser, network, GPU or third-party Node modules.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../', import.meta.url));
const before = process.env.CELLS_BASE || '29d9f4b'; // 30 Oct: the owner-approved live site after his panel, copy and layout notes (CELLS_BASE overrides), never a moving HEAD.
const copyBefore = '770f23d'; // Approved merged copy before the owner's 29 Oct Approach notes.
const files = ['approach.html', 'children.html', 'adults.html', 'subjects.html'];
const original = (file, revision = before) => execFileSync('git', ['show', `${revision}:${file}`], { cwd: site, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const words = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const csp = html => html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)?.[0];
// 30 Oct: the owner asked for every subject panel to be reworked (1817511), then Art & DT by level (e6c2404) and panel CTAs (692b636).
const copyBase = { 'subjects.html': 'ecbd384', 'children.html': 'b4876f5' };
function approvedCopy(file) {
  let copy = words(original(file, copyBase[file] || copyBefore));
  // Owner, 30 Oct: no "UK only" wording for online lessons.
  if (file === 'adults.html') return copy.replace('Online across the UK, or in person', 'Online wherever you live, or in person');
  if (file !== 'approach.html') return copy;
  const changes = [
    ['From the first session onwards ', ''],
    ['Inside a lesson ', ''],
    ['Your free first session is a live diagnostic: we get to know you and how best to support you.', 'A free diagnostic session helps us get to know you.'],
    ['We use the diagnostic report to choose the skills to practise and a pace that suits the learner.', 'Choose skills to practise and a pace that suits you.'],
    ['Sessions can combine focused skill-building, exam preparation and meaningful longer-term projects.', 'Combine skill-building, exam preparation and meaningful projects.'],
    ['Your tutor writes a weekly lesson report, and our founder reads it. We review what is working and adjust the learner’s plan.', 'Your tutor reports each week, helping us review and adjust your plan. Book a free first session'],
    ['Talk about the week. Typing the answers can double as writing practice.', 'New ideas explained and modelled step by step, building on what the learner already knows.'],
    ['choose a Functional Skills practice task. Weekly reports', 'choose a Functional Skills practice task. Try a free first lesson Weekly reports'],
    ["we adjust the plan each week. Online and in person", "we adjust the plan each week. Start with a free session Online and in person"],
    // Owner, 29 Oct: the third report heading is the tutor's feedback, in his own report style.
    ["What we're still building", "We'll keep working at"],
    // Owner, 29 Oct: Where we teach drops its blue line; its intro sits in a swash cell.
    ['Online and in person Where we teach', 'Where we teach'],
    // Owner, 30 Oct: the lesson stages describe how lessons really run; no "UK only" wording.
    ['Four simple stages, with activities and pace shaped around the learner. ', ''],
    ['Hello and the plan', 'Settle in and set the aim'],
    ['A friendly start, a short plan and a choice of activities.', 'A warm-up to get thinking, a quick look back at last week, and a clear aim for today’s lesson.'],
    ['Catch-up', 'Learn something new'],
    ['Skills built into their interests', 'Practise it their way'],
    ['Use games, websites or newspapers to practise a skill with guidance.', 'Guided practice through games, projects, websites or real texts they enjoy. Support steps back as their confidence grows.'],
    ['Look back at the work and choose what to practise next.', 'We reflect on the work we’ve done together, assess feedback, and make the changes that really reinforce the purpose of what we’re learning.'],
    ['One-to-one lessons online across the UK', 'One-to-one lessons online wherever you live'],
    ['wherever you live in the UK.', 'wherever you live.'],
  ];
  for (const [from, to] of changes) {
    assert.equal(copy.split(from).length - 1, 1, `Approved Approach copy: ${from}`);
    copy = copy.replace(from, to);
  }
  return copy;
}

for (const file of files) {
  const html = await readFile(path.join(site, file), 'utf8');
  const prior = original(file, copyBefore);
  assert.equal(words(html), approvedCopy(file), `${file}: copy must match the approved wording`);
  assert.equal(csp(html), csp(prior), `${file}: CSP must stay unchanged`);
  assert.match(html, /back-page-cells\.css/);
  assert.doesNotMatch(html, /\sstyle\s*=|<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i, `${file}: no inline styles/scripts`);
  if (file === 'approach.html' || file === 'children.html') {
    const steps = html.match(/<ol class="learning-steps">[\s\S]*?<\/ol>/)?.[0];
    assert.ok(steps, `${file}: missing steps`);
    for (let i = 1; i <= 4; i++) assert.equal(steps.split(`assets/art/step-0${i}.png`).length - 1, 1);
  }
  if (file === 'children.html') {
    const header = html.match(/id="getting-started"[\s\S]*?<div class="section-head">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(header, 'Children: missing Getting started header');
    assert.doesNotMatch(header, /<img\b/);
  }
  if (file === 'approach.html') {
    const where = source => source.match(/<section id="where-we-teach"[\s\S]*?<\/section>/)?.[0];
    // Owner, 29 Oct: only the header changes (no blue line; the intro sits in a swash cell).
    const whereHead = section => section
      .replace('with a tutor matched to you wherever you live.</p>', 'with a tutor matched to you wherever you live in the UK.</p>')
      .replace('<div class="section-head"><h2 id="where-heading">Where we teach</h2><p class="approach-swash">One-to-one lessons online wherever you live, with in-person sessions in selected areas, subject to tutor availability.</p></div>',
        '<div class="section-head"><div class="eyebrow">Online and in person</div><h2 id="where-heading">Where we teach</h2><p>One-to-one lessons online across the UK, with in-person sessions in selected areas, subject to tutor availability.</p></div>');
    assert.equal(whereHead(where(html)), where(original(file, copyBefore)), 'Where we teach: preserve the rest of the section exactly');
    const panels = ['steps-to-success', 'our-lessons', 'weekly-reports'];
    for (const id of panels) {
      const panel = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
      assert.equal((panel?.match(/class="approach-panel-cta"/g) || []).length, 1, `${id}: one shared panel CTA`);
      assert.match(panel, /class="button" href="contact"/, `${id}: existing button style and clean contact URL`);
      assert.match(panel, /class="approach-swash"/, `${id}: sky subheader`);
    }
  }
}
const prompts = JSON.parse(await readFile(path.join(site, 'scripts/step-art-prompts.json'), 'utf8'));
assert.equal(prompts.images.length, 4);
const digest = data => createHash('sha256').update(data).digest('hex');
const priorArt = new Set(await Promise.all((await readdir(path.join(site, 'assets/art'))).filter(name => !/^step-0[1-4]\.png$/.test(name)).map(async name => digest(await readFile(path.join(site, 'assets/art', name))))));
const fresh = new Set();
for (let i = 1; i <= 4; i++) {
  const name = `assets/art/step-0${i}.png`;
  const data = await readFile(path.join(site, name));
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16), 960, `${name}: width`);
  assert.equal(data.readUInt32BE(20), 600, `${name}: height`);
  assert.ok(!priorArt.has(digest(data)), `${name}: must be new art`);
  fresh.add(digest(data));
  assert.equal(prompts.images[i - 1].file, name);
}
assert.equal(fresh.size, 4, 'Four distinct new illustrations');
console.log('Source checks passed: copy, CSP, header removal, references, prompts, four distinct 960×600 PNGs.');

if (!process.argv.includes('--source-only')) await browserChecks();

async function browserChecks() {
  assert.ok(process.env.BASE_URL, 'Claude must serve this worktree and set BASE_URL.');
  const base = process.env.BASE_URL.replace(/\/$/, '');
  const output = path.resolve(site, '../outputs/final-pass-20261028/codex-cells');
  const require = createRequire(import.meta.url);
  const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
  const views = [{ width: 1440, height: 750 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 320, height: 740, isMobile: true, hasTouch: true }];
  const themes = ['light', 'dark', 'system-dark'];
  const report = { baselineCommit: before, pictureArea: 'Visible img element box, intersected with its card; cream picture panel included.', baseline: [], layouts: [], failures: [] };
  const check = (condition, message) => { if (!condition) report.failures.push(message); };
  const snapshot = new Map();
  await mkdir(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  try {
    // Serve original HTML/CSS/JS from the pinned Git object in the same browser, at the
    // same URL. No checkout, reset, extra server, copied worktree or baseline guessing.
    for (const theme of themes) for (const file of files) {
      const { context, page } = await open(views[0], theme, true);
      try {
        await load(page, file);
        const dimensions = await page.$eval('.framework-panels', el => ({ height: el.getBoundingClientRect().height, naturalMinimum: el.style.minHeight }));
        report.baseline.push({ file, theme, ...dimensions });
        await page.screenshot({ path: path.join(output, `before-${file.replace('.html', '')}-1440x750-${theme}.png`), fullPage: false });
      } finally { await context.close(); }
    }

    for (const view of views) for (const theme of themes) for (const file of files) {
      const { context, page } = await open(view, theme, false);
      const label = `${file} ${view.width}x${view.height} ${theme}`;
      try {
        await load(page, file);
        const panelIds = await page.$$eval('[data-content-panel]', panels => panels.map(panel => panel.id));
        const frameHeights = [];
        for (const panelId of panelIds) {
          await page.$eval(`[data-panel-link][href="#${panelId}"]`, el => el.click());
          await settle(page);
          const count = await page.$eval(`#${panelId}`, panel => {
            const root = panel.querySelector(':scope > .approach-report') || panel;
            return root.querySelectorAll(':scope > [data-section-page]').length || 1;
          });
          for (let index = 0; index < count; index++) {
            if (index) {
              await page.$eval(`#${panelId} .framework-page-controls button:last-child`, el => el.click());
              await settle(page);
            }
            await capture(panelId, `page-${index + 1}`);
          }
          // Project viewer pages have independent controls and must also fit.
          const projects = await page.$$eval(`#${panelId} [data-project-slide]`, slides => slides.map(slide => slide.dataset.project));
          for (let index = 1; index < projects.length; index++) {
            await page.$eval(`#${panelId} [data-project-next]`, el => el.click());
            await settle(page);
            await capture(panelId, `project-${projects[index]}`);
          }
        }
        if (view.width >= 1000) check(Math.max(...frameHeights) - Math.min(...frameHeights) <= 1, `${label}: section switching changes the equalised frame height`);

        async function capture(panelId, subpage) {
          await page.evaluate(() => window.scrollTo(0, 0));
          const metrics = await page.evaluate(measure, panelId);
          const state = `${label} #${panelId} ${subpage}`;
          const shot = `${file.replace('.html', '')}-${panelId}-${subpage}-${view.width}x${view.height}-${theme}.png`;
          frameHeights.push(metrics.frame.height);
          report.layouts.push({ file, view, theme, panelId, subpage, screenshot: shot, ...metrics });
          check(metrics.horizontalOverflow <= 1, `${state}: horizontal overflow ${metrics.horizontalOverflow}px`);
          check(metrics.clipped.length === 0, `${state}: clipped content ${metrics.clipped.join(', ')}`);
          check(metrics.outsideFrame.length === 0, `${state}: content outside panel ${metrics.outsideFrame.join(', ')}`);
          check(metrics.brokenImages.length === 0, `${state}: broken images ${metrics.brokenImages.join(', ')}`);
          check(metrics.darkMode === (theme !== 'light'), `${state}: incorrect colour-scheme`);
          if (theme === 'system-dark') check(metrics.themeAttribute === null, `${state}: system-dark must have no manual theme attribute`);
          if (file === 'children.html' && panelId === 'getting-started') check(metrics.headerPictures === 0, `${state}: Getting started header contains a picture`);
          if (metrics.steps.length) check(metrics.steps.length === 4, `${state}: expected all four steps`);
          for (const [index, step] of metrics.steps.entries()) {
            check(step.imageAreaRatio >= .35, `${state} step ${index + 1}: picture ${(step.imageAreaRatio * 100).toFixed(1)}% < 35%`);
            // Owner, 29 Oct: the copy sits centred against its art, not hugging the bottom.
            if (step.sideBySide) check(step.centreOffset <= .08, `${state} step ${index + 1}: copy is ${(step.centreOffset * 100).toFixed(1)}% off centre`);
            check(!step.overlap, `${state} step ${index + 1}: picture overlaps copy`);
          }
          if (view.width >= 1000) check(metrics.frame.bottom <= view.height + 1 && metrics.frame.top >= metrics.headerBottom - 1, `${state}: frame outside ${view.height}px screen (${metrics.frame.top}–${metrics.frame.bottom})`);
          if (view.width === 1440 && view.height === 750) {
            const prior = report.baseline.find(row => row.file === file && row.theme === theme);
            check(metrics.frame.height <= prior.height + 1, `${state}: panel grew from ${prior.height}px to ${metrics.frame.height}px`);
          }
          await page.screenshot({ path: path.join(output, shot), fullPage: view.width < 1000 });
        }
      } catch (error) { report.failures.push(`${label}: ${error.stack}`); }
      finally { await context.close(); }
    }
  } finally {
    await browser.close();
    await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`${report.layouts.length} layout states; ${report.failures.length} failures. Screenshots and measurements: ${output}`);
  if (report.failures.length) {
    console.error(report.failures.join('\n'));
    process.exitCode = 1;
  }

  async function open(view, theme, baseline) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ ...view, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(theme => {
      localStorage.removeItem('toucan-theme');
      if (theme !== 'system-dark') localStorage.setItem('toucan-theme', theme);
      localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now()));
    }, theme);
    page.on('pageerror', error => { if (!baseline) report.failures.push(`${page.url()}: ${error.message}`); });
    page.on('response', response => { if (!baseline && response.status() >= 400) report.failures.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('console', message => { if (!baseline && /Content Security Policy|Refused to (load|execute|apply)/i.test(message.text())) report.failures.push(`CSP: ${message.text()}`); });
    if (baseline) {
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin !== new URL(base).origin || !/\.(html|css|js|mjs)$/.test(url.pathname)) return void request.continue();
        const relative = decodeURIComponent(url.pathname.slice(new URL(base + '/').pathname.length));
        if (!snapshot.has(relative)) {
          try { snapshot.set(relative, original(relative)); }
          catch (error) { report.failures.push(`Could not serve pinned baseline ${relative}: ${error.message}`); snapshot.set(relative, null); }
        }
        const body = snapshot.get(relative);
        if (body === null) return void request.abort();
        const contentType = relative.endsWith('.html') ? 'text/html' : relative.endsWith('.css') ? 'text/css' : 'text/javascript';
        void request.respond({ status: 200, contentType, body });
      });
    }
    return { context, page };
  }
  async function load(page, file) {
    await page.goto(`${base}/${file}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-content-panels][data-enhanced]');
    if (file === 'children.html') await page.waitForSelector('[data-showcase-ready]');
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
      await document.fonts.ready;
    });
    await settle(page);
  }
  async function settle(page) {
    await page.evaluate(async () => {
      await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }
}

function measure(panelId) {
  const rect = el => {
    const b = el.getBoundingClientRect();
    return { top: b.top, right: b.right, bottom: b.bottom, left: b.left, width: b.width, height: b.height };
  };
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const frameElement = document.querySelector('.framework-panels');
  const frame = rect(frameElement);
  const panel = document.getElementById(panelId);
  const clipped = [];
  const outsideFrame = [];
  for (const el of [frameElement, ...panel.querySelectorAll('.picture-cell, .picture-cell-copy, .subject-card, .teaching-format, .report-parts > li')].filter(visible)) {
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) clipped.push(el.className || el.id);
  }
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || !visible(node.parentElement) || node.parentElement.closest('script, style')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const b of range.getClientRects()) if (b.left < frame.left - 1 || b.right > frame.right + 1 || b.top < frame.top - 1 || b.bottom > frame.bottom + 1) outsideFrame.push(node.textContent.trim().slice(0, 60));
  }
  const steps = [...panel.querySelectorAll('.learning-steps > li')].filter(visible).map(card => {
    const box = rect(card);
    const img = card.querySelector('img');
    const image = rect(img);
    const text = rect(card.querySelector('.picture-cell-copy'));
    const paragraph = card.querySelector('p');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const lines = [...range.getClientRects()];
    const textBottom = Math.max(...lines.map(line => line.bottom));
    const heading = card.querySelector('h3, h4');
    const textTop = heading ? rect(heading).top : Math.min(...lines.map(line => line.top));
    const imageWidth = Math.max(0, Math.min(image.right, box.right) - Math.max(image.left, box.left));
    const imageHeight = Math.max(0, Math.min(image.bottom, box.bottom) - Math.max(image.top, box.top));
    const overlap = Math.min(image.right, text.right) - Math.max(image.left, text.left) > 1 && Math.min(image.bottom, text.bottom) - Math.max(image.top, text.top) > 1;
    return { card: box, image, imageAreaRatio: imageWidth * imageHeight / (box.width * box.height), centreOffset: Math.abs((textTop + textBottom) / 2 - (box.top + box.bottom) / 2) / box.height, sideBySide: image.right <= text.left + 1, overlap };
  });
  const themeAttribute = document.documentElement.getAttribute('data-theme');
  return {
    frame, steps, clipped, outsideFrame,
    horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    headerBottom: document.querySelector('body > header').getBoundingClientRect().bottom,
    headerPictures: panel.querySelector('.section-head')?.querySelectorAll('img').length || 0,
    brokenImages: [...panel.querySelectorAll('img')].filter(img => visible(img) && (!img.complete || !img.naturalWidth)).map(img => img.getAttribute('src')),
    themeAttribute,
    darkMode: themeAttribute === 'dark' || (themeAttribute !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches),
  };
}
