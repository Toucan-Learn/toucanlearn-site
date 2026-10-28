// Run with the worktree served on 4206. Uses the existing local Puppeteer; no downloads.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './check-project-cells-static.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.SHOWCASE_URL || 'http://127.0.0.1:4206';
const output = process.env.SHOWCASE_SCREENSHOTS || path.resolve(site, '../outputs/final-pass-20261028/codex-projects');
const baselineRef = 'be60213fb59b7265603a490c74a506b2866afeb2';
const baselineFiles = new Map(['children.html', 'back-page-frame.css'].map(file => [
  `/${file}`, execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: site, encoding: 'utf8' }),
]));
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const views = [
  { width: 1440, height: 750 }, { width: 1280, height: 720 },
  { width: 1440, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true },
];
const projects = ['football', 'darty', 'drinks', 'piano'];
const results = [];
const errors = [];
let browser;
await mkdir(output, { recursive: true });

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('[data-project-slide]:not([hidden]) img')].map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function open(view, theme, baseline = false) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const label = `${view.width}x${view.height}-${theme}${baseline ? '-baseline' : ''}`;
  await page.setViewport({ ...view, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.evaluateOnNewDocument(theme => {
    if (window.top !== window) return;
    localStorage.removeItem('toucan-theme');
    if (theme !== 'system-dark') localStorage.setItem('toucan-theme', theme);
  }, theme);
  if (baseline) {
    // Serve the original HTML/CSS through the same server and assets. No checkout,
    // second server, repository edits or external network access are needed.
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const body = url.origin === new URL(base).origin && baselineFiles.get(url.pathname);
      if (body) void request.respond({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/html', body });
      else void request.continue();
    });
  } else {
    page.on('console', message => { if (message.type() === 'error') errors.push(`${label}: ${message.text()}`); });
    page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => errors.push(`${label}: ${request.failure()?.errorText} ${request.url()}`));
  }
  const response = await page.goto(`${base}/children.html#learner-projects`, { waitUntil: 'networkidle0' });
  assert(response.ok(), `${label}: failed to load children.html`);
  await page.waitForSelector('[data-project-viewer][data-enhanced]');
  await settle(page);
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme === 'system-dark' ? null : theme);
  return { context, page, label };
}

async function metrics(page) {
  return page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const section = document.getElementById('learner-projects');
    const frame = section.closest('.framework-panels');
    const slide = section.querySelector('[data-project-slide]:not([hidden])');
    const copy = slide.querySelector('.framework-project-copy');
    const media = slide.querySelector('.framework-project-media');
    const content = media.querySelector('iframe, video') || media.querySelector('[data-screenshot]:not([hidden])') || media.querySelector(':scope > img');
    const controls = section.querySelector('.framework-project-controls');
    const note = section.querySelector('.project-note');
    return {
      framed: document.body.hasAttribute('data-page-frame'),
      measuring: frame.classList.contains('is-measuring'),
      frame: rect(frame), natural: parseFloat(frame.style.minHeight) || 0,
      section: rect(section), slide: rect(slide), copy: rect(copy), media: rect(media), content: rect(content),
      controls: rect(controls), note: rect(note),
      rows: copy.querySelectorAll('.project-copy-cells > div').length,
      cardBackground: getComputedStyle(copy).backgroundColor,
      cardOverflow: copy.scrollHeight - copy.clientHeight,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      textFits: [...copy.querySelectorAll('h3, h4, p, a')].every(element => {
        const r = element.getBoundingClientRect();
        const c = copy.getBoundingClientRect();
        return r.top >= c.top && r.bottom <= c.bottom + 1 && element.scrollWidth <= element.clientWidth + 1;
      }),
      inactiveInert: [...section.querySelectorAll('[data-project-slide][hidden]')].every(slide => slide.inert),
      index: [...section.querySelectorAll('[data-project-slide]')].indexOf(slide),
    };
  });
}

async function keyboardChecks(page, label) {
  const activeIndex = () => page.$$eval('[data-project-slide]', slides => slides.findIndex(slide => !slide.hidden));
  await page.focus('[data-project-viewer]');
  for (const [key, index] of [['End', 3], ['ArrowLeft', 2], ['Home', 0], ['ArrowRight', 1]]) {
    await page.keyboard.press(key);
    assert.equal(await activeIndex(), index, `${label}: viewer key ${key}`);
  }
  const status = await page.$eval('[data-screenshot-status]', node => node.textContent);
  await page.click('[data-screenshot-next]');
  assert.equal(await activeIndex(), 1, `${label}: gallery click changed project`);
  assert.notEqual(await page.$eval('[data-screenshot-status]', node => node.textContent), status, 'Gallery did not advance');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(), 1, `${label}: gallery button key changed project`);
  await page.focus('[data-project-slide]:not([hidden]) .framework-project-copy > a');
  await page.keyboard.press('ArrowRight');
  assert.equal(await activeIndex(), 1, `${label}: link key changed project`);
  // A scripted slide change must recover focus from the now-inert copy link.
  await page.$eval('[data-project-next]', button => button.click());
  assert(await page.$eval('[data-project-viewer]', viewer => document.activeElement === viewer), 'Focus lost inside hidden project');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(), 3, `${label}: previous did not wrap`);
  await page.keyboard.press('Home');
}

try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (const view of views) {
    for (const theme of ['light', 'dark', 'system-dark']) {
      const original = await open(view, theme, true);
      const baseline = await metrics(original.page);
      await original.context.close();
      const { context, page, label } = await open(view, theme);
      const record = { label, baseline, slides: [] };
      results.push(record);
      // Verify the served worktree before trusting any layout measurements.
      assert.equal(await page.$$eval('.framework-project-copy.subject-card', cards => cards.length), 4, `${label}: server is serving a different checkout`);
      await keyboardChecks(page, label);
      for (let index = 0; index < 4; index++) {
        await settle(page);
        await page.$eval('#learner-projects', section => section.scrollIntoView({ block: 'start' }));
        const m = await metrics(page);
        record.slides.push(m);
        // Capture before assertions so a failed layout still has reviewable evidence.
        await page.screenshot({ path: path.join(output, `layout-${label}-${index + 1}-${projects[index]}.png`) });
        if (view.width < 1000) await page.screenshot({ path: path.join(output, `layout-${label}-${index + 1}-${projects[index]}-full.png`), fullPage: true });
        assert.equal(m.index, index, `${label}: wrong active slide`);
        assert.equal(m.rows, 3, `${label}: expected three copy rows`);
        assert.equal(m.cardBackground, theme === 'light' ? 'rgb(243, 238, 228)' : 'rgb(32, 70, 83)', `${label}: shared light/dark card palette`);
        assert(!m.measuring && m.inactiveInert && m.textFits && m.cardOverflow <= 1, `${label}: copy clipped, measurement stuck or inactive slide focusable`);
        assert(m.horizontalOverflow <= 1, `${label}: page scrolls horizontally`);
        assert(m.note.bottom <= m.section.bottom + 1 && m.controls.bottom <= m.section.bottom + 1, `${label}: footer leaves section`);
        assert(m.content.height >= m.media.height - 1 && Math.abs(m.content.height - m.media.height) <= 1, `${label}: media does not fill its slot`);
        if (view.width >= 1000) {
          const share = m.media.width / (m.media.width + m.copy.width);
          assert(share >= .59 && share <= .61, `${label}: media share ${share}`);
          assert(m.media.width >= baseline.media.width + 20 && m.content.height >= baseline.content.height + 20, `${label}: media did not grow`);
          assert(m.media.y >= m.copy.y - 1 && Math.abs(m.media.y - m.copy.y) <= 1, `${label}: columns misaligned`);
          assert(m.frame.height <= baseline.frame.height + 1, `${label}: panel grew (${m.frame.height} vs ${baseline.frame.height})`);
          assert(m.natural <= baseline.natural + 1, `${label}: is-measuring minimum grew (${m.natural} vs ${baseline.natural})`);
          const footerGap = Math.min(m.controls.y, m.note.y) - m.media.bottom;
          assert(footerGap >= 7, `${label}: media/footer gap is ${footerGap.toFixed(2)}px; expected at least 7px`);
        } else {
          assert(!m.framed && m.media.y >= m.copy.bottom, `${label}: phone must keep normal single-column flow`);
        }
        if (index < 3) {
          await page.click('[data-project-next]');
          assert(await page.$eval('[data-project-next]', button => document.activeElement === button), 'Next button lost focus');
          assert.equal(await page.$eval('[data-project-status]', node => node.textContent), `${index + 2} of 4`);
        }
      }
      assert(Math.max(...record.slides.map(m => m.slide.height)) - Math.min(...record.slides.map(m => m.slide.height)) <= 1, `${label}: slide height jumps`);
      // Re-run equalisation and compare with the first measurement to catch accumulated growth.
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await settle(page);
      assert(Math.abs((await metrics(page)).frame.height - record.slides[0].frame.height) <= 1, `${label}: frame grew after equalise`);
      await context.close();
    }
  }
  assert.deepEqual(errors, [], 'Console, page or request errors');
  console.log(`Project layout checks passed (12 viewport/theme pairs). Screenshots: ${output}`);
} catch (error) {
  errors.push(error.stack);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, 'layout-checks.json'), JSON.stringify({ passed: !errors.length, baselineRef, results, errors }, null, 2));
  await browser?.close();
}

// Keep the original newspaper routes, piano input/audio, media height, qualifications,
// no-JS and print checks. Its static import also uses this checkout via SHOWCASE_SITE.
process.env.SHOWCASE_SITE = site;
process.env.SHOWCASE_URL = base;
process.env.SHOWCASE_SCREENSHOTS = output;
await import('../../website-codex-showcase/scripts/check-project-showcase.mjs');
