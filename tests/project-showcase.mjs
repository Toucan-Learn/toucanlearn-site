// Serve this checkout, set BASE_URL, then run with the existing Puppeteer.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newspaperMobileBreakpoint } from './project-showcase-source.mjs';
import { assertImmediateProjectSwitch, assertRapidProjectSwitches } from './project-showcase-switch-helpers.mjs';
import { activatePianoToggle } from './piano-toggle-helpers.mjs';
import { checkDrinkSpin, assertDrinkLayout, dragOverDrink, checkDrinkMenuKeys } from './drink-spin-browser.mjs';
import { checkDartyLive } from './darty-live-browser.mjs';
const site = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const base = process.env.BASE_URL || process.env.SHOWCASE_URL || 'http://127.0.0.1:4206';
const output = process.env.SHOWCASE_SCREENSHOTS || path.resolve(site, '../outputs/drink-spin-20261028/showcase');
const originalHome = execFileSync('git', ['show', `${process.env.PROJECT_COPY_BASE || process.env.SHOWCASE_BASE || 'd40ecf2'}:index.html`], { cwd: site, encoding: 'utf8' });
const views = [{ width: 1440, height: 750 }, { width: 1280, height: 720 }, { width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 320, height: 740, isMobile: true, hasTouch: true }];
const ids = ['football', 'darty', 'drinks', 'piano'];
const sectionIds = ['intro', ...ids];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { layouts: [], pianoToggles: [], behaviour: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function open(view, theme, reduced = true, options = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ ...view, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now())); } catch {} }); // offer pop-up already seen
  await page.evaluateOnNewDocument(({ theme, random, fast }) => {
    localStorage.removeItem('toucan-theme');
    if (random !== undefined) Math.random = () => random;
    if (fast) {
      // Test-only acceleration. Production keeps 20,000 ms; source tests check it exactly.
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) => schedule(fn, delay >= 10000 && delay <= 20000 ? delay / 25 : delay, ...args);
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    window.showcaseAudio = [];
    if (Audio) {
      window.AudioContext = class extends Audio {
        constructor(...args) { super(...args); window.showcaseAudio.push(this); }
      };
    }
  }, { theme, ...options });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/WebGL.*CONTEXT_LOST|GPU stall/.test(message.text())) report.errors.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return { context, page };
}
async function load(page, route) {
  await page.goto(`${base}/${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-showcase-ready]');
  await page.evaluate(() => document.fonts.ready);
}
async function selected(page) { return page.$eval('[data-showcase]', root => root.dataset.project); }
async function checkGettingStarted(page, label) {
  await page.click('[data-panel-link][href="#getting-started"]');
  await page.waitForFunction(() => !document.querySelector('#getting-started').hidden);
  const cells = await page.$$eval('#getting-started .picture-cell', cells => cells.map(cell => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, right: r.right, y: r.y, height: r.height, width: r.width };
    };
    const copy = cell.querySelector('.picture-cell-copy');
    const art = cell.querySelector('.picture-cell-media');
    return { cell: rect(cell), copy: rect(copy), art: rect(art), padding: getComputedStyle(copy).padding,
      fits: copy.scrollWidth <= copy.clientWidth + 1 && copy.scrollHeight <= copy.clientHeight + 1 };
  }));
  assert.equal(cells.length, 4);
  const reference = cells[0];
  for (const { cell, copy, art, padding, fits } of cells) {
    assert(fits && art.right <= copy.x + 1, `${label}: each step keeps its art left and unclipped copy right`);
    assert(Math.abs(copy.y + copy.height / 2 - art.y - art.height / 2) <= 1, `${label}: copy is vertically centred against its art`);
    assert(art.width / cell.width >= .37 && art.width / cell.width <= .39, `${label}: balanced art/copy split`);
    assert(Math.abs(cell.height - reference.cell.height) <= 1 && Math.abs(cell.width - reference.cell.width) <= 1 && padding === reference.padding, `${label}: all four cells have consistent framing`);
  }
  const enquiry = await page.$eval('#getting-started > p:last-child > a', link => ({
    label: link.firstChild.textContent.trim(), href: link.getAttribute('href'), service: link.dataset.service, button: link.classList.contains('button'),
    afterSteps: link.parentElement.previousElementSibling.classList.contains('learning-steps'),
    fits: link.scrollWidth <= link.clientWidth + 1 && link.scrollHeight <= link.clientHeight + 1,
  }));
  assert.deepEqual(enquiry, { label: 'Tell us your child’s goal', href: 'contact', service: 'children', button: true, afterSteps: true, fits: true }, `${label}: Getting started enquiry replaces the old link with a fitting button`);
  await page.screenshot({ path: path.join(output, `${label}-getting-started.png`) });
  report.layouts.push({ label, section: 'getting-started', cells });
  await page.click('[data-panel-link][href="#learner-projects"]');
  await page.waitForFunction(() => !document.querySelector('#learner-projects').hidden);
}
async function project(page, id) {
  await page.$eval('[data-showcase]', root => root.focus({ preventScroll: true }));
  const count = await page.$$eval('[data-project-slide]', slides => slides.length) || ids.length;
  for (let i = 0; i < count && await selected(page) !== id; i++) await assertImmediateProjectSwitch(page, 'next');
  assert.equal(await selected(page), id);
  await page.$eval('[data-showcase]', root => (root.dataset.project === 'intro' ? root.querySelector('[data-project-slide]:not([hidden])') : root.querySelector('.showcase-cell')).scrollIntoView({ block: 'center' }));
  if (id === 'intro') await page.$eval('.project-intro-image img', img => img.decode());
  if (id === 'piano') await page.waitForSelector('#hero-keyboard[data-song]');
}
async function metrics(page) {
  return page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    };
    const root = document.querySelector('[data-showcase]');
    const slide = root.querySelector('[data-project-slide]:not([hidden])');
    const copy = slide?.querySelector('.framework-project-copy');
    const column = slide?.querySelector('.project-copy-column');
    const media = slide?.querySelector('.framework-project-media');
    const rows = copy?.querySelector('.project-copy-cells');
    const result = column?.querySelector('.project-copy-result');
    const headingStyle = node => {
      const css = getComputedStyle(node);
      return Object.fromEntries(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'marginTop', 'marginBottom'].map(name => [name, css[name]]));
    };
    const introImage = slide?.querySelector('.project-intro-image img');
    const frame = root.closest('.framework-panels');
    const stage = root.querySelector('.showcase-stage');
    const navigation = root.querySelector('.showcase-navigation');
    const heading = root.querySelector('.section-head h2');
    const enquiry = root.querySelector('[data-project-enquiry]');
    return { id: root.dataset.project, slot: rect(root.querySelector('.showcase-cell')), stage: rect(stage), media: media && rect(media), copy: copy && rect(copy),
      enquiry: enquiry && { ...rect(enquiry), documentY: rect(enquiry).y + scrollY, inHeader: enquiry.parentElement === heading.parentElement,
        label: enquiry.firstChild.textContent.trim(), href: enquiry.getAttribute('href'), button: enquiry.classList.contains('button'),
        count: root.querySelectorAll('[data-project-enquiry]').length, cardLinks: root.querySelectorAll('.framework-project-copy a').length,
        fits: enquiry.scrollWidth <= enquiry.clientWidth + 1 && enquiry.scrollHeight <= enquiry.clientHeight + 1 },
      navigation: navigation && { ...rect(navigation), documentY: rect(navigation).y + scrollY,
        inHeader: navigation.parentElement === heading.parentElement, heading: rect(heading),
        name: navigation.querySelector('[data-project-name]').textContent,
        order: [...navigation.children].map(node => [...node.attributes].find(attr => attr.name.startsWith('data-project-'))?.name),
        bottomBars: root.querySelectorAll('.showcase-caption').length,
        textFits: [...navigation.children].every(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) },
      copyFits: !copy || [...(column || copy).querySelectorAll('h3, h4, p, a')].every(node => {
        const box = node.getBoundingClientRect();
        const card = node.closest('.project-copy-result, .framework-project-copy').getBoundingClientRect();
        return box.top >= card.top - 1 && box.bottom <= card.bottom + 1 && box.left >= card.left - 1 && box.right <= card.right + 1 && node.scrollWidth <= node.clientWidth + 1;
      }),
      rows: copy?.querySelectorAll('.project-copy-cells > div').length,
      rowLabels: [...(rows?.querySelectorAll('h4') || [])].map(node => node.textContent),
      result: result && { ...rect(result), separate: result.parentElement === column && copy.parentElement === column && result.previousElementSibling === copy,
        background: getComputedStyle(result).backgroundColor, color: getComputedStyle(result.querySelector('p')).color, headingColor: getComputedStyle(result.querySelector('h4')).color,
        copyBackground: getComputedStyle(copy).backgroundColor, radius: getComputedStyle(result).borderRadius, copyRadius: getComputedStyle(copy).borderRadius,
        headingStyle: headingStyle(result.querySelector('h4')), headingTransform: getComputedStyle(result.querySelector('h4')).textTransform, labelStyle: headingStyle(copy.querySelector('.project-label')), rowHeadingStyles: [...rows.querySelectorAll('h4')].map(headingStyle),
        columnGap: parseFloat(getComputedStyle(column).rowGap), mediaGap: parseFloat(getComputedStyle(slide).columnGap) },
      introMedia: slide?.dataset.project === 'intro' ? slide.querySelectorAll('iframe, video, audio, canvas, .framework-project-media').length : null,
      introImage: introImage && { ...rect(introImage), count: slide.querySelectorAll('img').length, complete: introImage.complete && introImage.naturalWidth > 0, source: new URL(introImage.currentSrc).pathname },
      frame: frame && rect(frame),
      headerHeight: document.querySelector('header').getBoundingClientRect().height,
      status: root.querySelector('[data-project-status]').textContent,
      slideCount: root.querySelectorAll('[data-project-slide]').length,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      inactiveInert: [...root.querySelectorAll('[data-project-slide][hidden]')].every(slide => slide.inert),
      heavyViews: root.querySelectorAll('.showcase-stage iframe, video, #sky-canvas, .showcase-newspaper-layer[data-showcase-revealed] iframe').length,
    };
  });
}
function contrast(first, second) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(value => {
    const channel = Number(value) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const [a, b] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (a + .05) / (b + .05);
}
async function heroMetrics(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [r.x + scrollX, r.y + scrollY, r.width, r.height];
    };
    return Object.fromEntries(['.living-hero', '.hero-layout', '.hero-copy', '.hero-actions', '.hero-benefits', '.sky-studio'].map(selector => [selector, rect(selector)]));
  });
}
try {
  for (const view of views) for (const theme of ['light', 'dark']) {
    const { context, page } = await open(view, theme);
    const label = `${view.width}x${view.height}-${theme}`;
    await page.setRequestInterception(true);
    const intercept = request => {
      if (new URL(request.url()).pathname === '/index.html') void request.respond({ status: 200, contentType: 'text/html', body: originalHome });
      else void request.continue();
    };
    page.on('request', intercept);
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const before = await heroMetrics(page);
    page.off('request', intercept);
    await page.setRequestInterception(false);
    for (const route of ['index.html?project=football', 'children.html#learner-projects']) {
      await load(page, route);
      const homepage = route.startsWith('index');
      const sequence = homepage ? ids : sectionIds;
      if (!homepage) await checkGettingStarted(page, label);
      assert.equal(await selected(page), sequence[0], `${label}: default/override start`);
      assert.equal(await page.$eval('[data-project-status]', status => status.textContent), `1 of ${sequence.length}`);
      const sizes = [];
      let navigationBox;
      let enquiryBox;
      for (const [position, id] of sequence.entries()) {
        await project(page, id);
        await page.$eval('[data-showcase]', root => (root.dataset.project === 'intro' ? root.querySelector('[data-project-slide]:not([hidden])') : root.querySelector('.showcase-cell')).scrollIntoView({ block: 'center' }));
        await wait(100);
        const m = await metrics(page);
        if (id !== 'intro') sizes.push(m.slot.height);
        report.layouts.push({ label, route, ...m });
        await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-${id}.png`) });
        assert(m.horizontalOverflow <= 1, `${label}/${route}/${id}: horizontal overflow`);
        assert(m.copyFits && m.inactiveInert, `${label}/${id}: copy clipped or hidden copy focusable`);
        if (!homepage && view.width === 1440 && view.height === 750) assert(m.frame.height <= view.height - m.headerHeight, `${label}/${id}: section frame fits the laptop screen`);
        assert.equal(m.status, `${position + 1} of ${sequence.length}`, `${label}/${id}: correct carousel count`);
        assert.equal(m.heavyViews, id === 'piano' || id === 'football' ? 1 : 0, 'Only the selected heavy view is mounted; reduced motion drinks use posters');
        if (!homepage) {
          const nav = m.navigation;
          assert(nav?.inHeader && nav.textFits, `${label}/${id}: slide controls fit the section header`);
          assert.equal(nav.bottomBars, 0, 'Projects has no bottom navigation bar');
          assert.deepEqual(nav.order, ['data-project-prev', 'data-project-name', 'data-project-status', 'data-project-next']);
          assert.equal(nav.name, { intro: 'Intro', football: 'Sports journalism', darty: 'DARTY', drinks: 'Drink design', piano: 'Piano' }[id]);
          const box = [nav.x, nav.documentY, nav.width, nav.height];
          if (navigationBox) box.forEach((value, i) => assert(Math.abs(value - navigationBox[i]) <= 1, `${label}/${id}: header controls moved or resized between slides`));
          else navigationBox = box;
          if (view.width >= 1000) assert(Math.abs(nav.y + nav.height / 2 - nav.heading.y - nav.heading.height / 2) <= 1 && nav.x >= nav.heading.right, 'Desktop navigation sits at the top right, level with the heading');
          else assert(nav.y >= nav.heading.bottom, 'Phone navigation sits below the heading');
          const enquiry = m.enquiry;
          assert(enquiry?.inHeader && enquiry.button && enquiry.fits, `${label}/${id}: the shared enquiry is a fitting header button`);
          assert.equal(enquiry.label, 'Tell us what they love');
          assert.equal(enquiry.href, 'contact');
          assert.equal(enquiry.count, 1, 'Exactly one Projects enquiry CTA, including Intro');
          assert.equal(enquiry.cardLinks, 0, 'No per-card lesson links remain');
          const ctaBox = [enquiry.x, enquiry.documentY, enquiry.width, enquiry.height];
          if (enquiryBox) ctaBox.forEach((value, i) => assert(Math.abs(value - enquiryBox[i]) <= 1, `${label}/${id}: enquiry moved or resized between slides`));
          else enquiryBox = ctaBox;
          if (view.width >= 1200) assert(enquiry.right <= nav.x && Math.abs(enquiry.y + enquiry.height / 2 - nav.y - nav.height / 2) <= 1, 'Desktop enquiry sits beside the slide controls');
          else assert(enquiry.y >= nav.bottom, 'Narrow layouts stack the enquiry below the slide controls');
        }
        if (homepage) {
          assert.equal(m.slideCount, 0, 'Homepage retains its four media projects and has no copy slides');
          const after = await heroMetrics(page);
          for (const selector of Object.keys(before)) after[selector].forEach((value, i) => assert(Math.abs(value - before[selector][i]) <= 1, `${label}/${id}: ${selector} geometry changed`));
        } else if (id === 'intro') {
          assert.equal(m.slideCount, 5);
          assert.equal(m.rows, 0);
          assert.equal(m.result ?? null, null, 'The intro has no result card'); // no column on the intro, so the probe returns undefined
          assert.equal(m.introMedia, 0, 'Intro has no live showcase media');
          assert.equal(m.introImage.count, 1, 'Intro reserves exactly one image');
          assert(m.introImage.complete && m.introImage.width > 100 && m.introImage.height > 100, 'The placeholder/replacement image loads without a broken image');
          assert(m.introImage.source.endsWith('/assets/projects/intro-learning.jpg'), 'Dropping in the approved JPEG updates the reserved image slot');
          if (view.width >= 1000) assert(m.copy.right <= m.introImage.x + 1, 'Intro copy sits left of its photo on desktop');
          else assert(m.copy.bottom <= m.introImage.y + 1, 'Intro copy sits before its photo on phones');
          assert.equal(m.stage.height, 0, 'Intro mounts no media stage');
        } else {
          assert.equal(m.rows, 3);
          assert.deepEqual(m.rowLabels, ['The goal', 'Developing skills', 'Finding the link']);
          assert(m.result?.separate, 'Result and copy are sibling cards in the copy column');
          assert(m.result.columnGap >= 12 && Math.abs(m.result.y - m.copy.bottom - m.result.columnGap) <= 1, 'Result has a clear card gap below the cream copy card');
          assert(Math.abs(m.result.x - m.copy.x) <= 1 && Math.abs(m.result.width - m.copy.width) <= 1, 'Result and copy cards have the same width and alignment');
          assert.equal(m.result.radius, m.result.copyRadius, 'Result and copy cards share their corner radius');
          // Owner (29 Oct): the result heading is a capitalised label, the same size as the subject label.
          assert.deepEqual([m.result.headingStyle.fontSize, m.result.headingStyle.fontWeight, m.result.headingStyle.letterSpacing], [m.result.labelStyle.fontSize, m.result.labelStyle.fontWeight, m.result.labelStyle.letterSpacing], 'Result heading matches the subject label (e.g. ENGLISH) in size, weight and spacing');
          assert.equal(m.result.headingTransform, 'uppercase', 'Result heading is in capitals');
          assert.notEqual(m.result.background, m.result.copyBackground, 'Result has a distinct accent background');
          for (const color of [m.result.color, m.result.headingColor]) assert(contrast(color, m.result.background) >= 4.5, `${label}/${id}: result text contrast`);
          assert(Math.abs(m.slot.height - m.media.height) <= 1, 'Shared cell fills the media slot');
          if (view.width >= 1000) {
            assert(Math.abs(m.copy.y - m.media.y) <= 1 && Math.abs(m.result.bottom - m.media.bottom) <= 1, 'Copy and result together align with the media top and bottom');
            assert.equal(m.result.columnGap, m.result.mediaGap, 'Vertical card gap matches the gap beside the media');
            const share = m.media.width / (m.media.width + m.copy.width);
            assert(share >= .64 && share <= .66, `${label}: media gets 64–66% of the slide; media share ${share}`);
          } else assert(m.media.y >= m.result.bottom - 1, 'Phone keeps copy, result and media in ordinary single-column flow');
        }
        if (id === 'football' && view.width === 1440 && view.height === 750) {
          const frameElement = await page.$('iframe');
          const frame = await frameElement.contentFrame();
          await frame.waitForSelector('.news-story-link');
          if (!homepage) {
            const newspaperLayout = await frame.evaluate(breakpoint => {
              const rect = node => {
                const box = node.getBoundingClientRect();
                return { x: box.x, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
              };
              const lead = document.querySelector('.news-front > .news-lead');
              const side = document.querySelector('.news-front > .news-side-stories');
              const sideStories = [...side.querySelectorAll('.news-story')];
              return {
                viewportWidth: innerWidth, breakpoint,
                phoneLayout: matchMedia(`(width <= ${breakpoint}px)`).matches,
                mastheadDirection: getComputedStyle(document.querySelector('.news-masthead')).flexDirection,
                lead: rect(lead), side: rect(side),
                sideStories: sideStories.length,
                visibleSideStories: sideStories.filter(story => rect(story).top < innerHeight && rect(story).bottom > 0).length,
              };
            }, newspaperMobileBreakpoint);
            const iframeWidth = await frameElement.evaluate(iframe => iframe.getBoundingClientRect().width);
            report.layouts.push({ label, route, iframeWidth, newspaperLayout });
            assert(newspaperLayout.viewportWidth > newspaperMobileBreakpoint && !newspaperLayout.phoneLayout, `${label}: iframe must be wider than ${newspaperMobileBreakpoint}px`);
            assert.equal(newspaperLayout.mastheadDirection, 'row', 'Desktop masthead keeps its horizontal layout');
            assert(newspaperLayout.side.x >= newspaperLayout.lead.right - 1, 'Small side stories sit beside the lead story');
            assert(newspaperLayout.sideStories >= 2 && newspaperLayout.visibleSideStories >= 1, 'The front page shows its lead and small side stories');
          }
          assert(await page.evaluate(() => document.activeElement !== document.querySelector('iframe')), 'Opening the newspaper must not take focus');
          await frame.click('.news-story-link');
          await frame.waitForSelector('.news-reader');
          await frame.waitForFunction(() => document.activeElement?.tagName === 'H1');
          assert.equal(await selected(page), 'football', 'Reading an article keeps the newspaper selected');
          await frame.click('.news-back');
          await frame.waitForSelector('.news-front');
        }
        if (id === 'darty') {
          if (view.width <= 767 || view.hasTouch) {
            const beforeImage = await page.$eval('[data-screenshot]', img => img.src);
            await page.click('[data-screenshot-next]');
            assert.notEqual(await page.$eval('[data-screenshot]', img => img.src), beforeImage);
          } else {
            assert.equal(await page.$$eval('[data-darty-play]', buttons => buttons.length), 1);
            assert.equal(await page.$('.showcase-match'), null, 'Desktop match waits for Play');
          }
          assert.equal(await selected(page), 'darty', 'DARTY controls leave the project selected');
        }
        if (id === 'drinks') for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
          await page.click(`[data-drink="${drink}"]`);
          assert.equal(await page.$eval(`[data-drink="${drink}"]`, button => button.getAttribute('aria-pressed')), 'true');
          assert.equal(await page.$('video'), null);
          await page.waitForFunction(drink => document.querySelector('.drink-spin img')?.src.includes(`${drink}/poster.webp`), {}, drink);
          assert((await page.$eval('.showcase-drink-screen img', img => img.src)).includes(`${drink}/poster.webp`));
          assert.equal(await page.$eval('.drink-spin', button => button.dataset.frame), '0');
          const drinkLayout = await assertDrinkLayout(page, drink);
          report.layouts.push({ label, route, drink, ...drinkLayout });
          await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-${drink}-card.png`) });
          if (drink === 'skids') {
            await dragOverDrink(page, view);
            if (view.width === 1440 && theme === 'light') await checkDrinkMenuKeys(page);
          }
        }
        if (id === 'piano') {
          report.pianoToggles.push(await activatePianoToggle(page, `${label}/${route}`));
          await page.screenshot({ path: path.join(output, `${label}-${route.startsWith('index') ? 'home' : 'projects'}-piano-open.png`) });
          assert.equal(await page.$eval('#piano-toggle', button => button.getAttribute('aria-expanded')), 'true', `${label}/${route}: screenshot must leave the keyboard open`);
          assert.equal(await page.$$eval('.piano-key.is-now', keys => keys.length), 1);
          assert.equal(await page.$$eval('.piano-key.is-next', keys => keys.length), 1);
          if (view.width === 390) assert(['runaway', 'no-one-noticed'].includes(await page.$eval('#hero-keyboard', panel => panel.dataset.song)));
        }
      }
      assert(Math.max(...sizes) - Math.min(...sizes) <= 1, `${label}: project switch changes cell height`);
      await assertImmediateProjectSwitch(page, 'next');
      assert.equal(await selected(page), sequence[0], `${label}: wrap returns to the first slide`);
      assert.equal(await page.$eval('[data-project-status]', status => status.textContent), `1 of ${sequence.length}`);
      await assertImmediateProjectSwitch(page, 'prev');
      assert.equal(await selected(page), sequence.at(-1), `${label}: previous wraps to the final project`);
      report.behaviour.push({ label, route, rapidSwitches: await assertRapidProjectSwitches(page) });
    }
    await context.close();
  }
  await checkDrinkSpin({ open, views, base, output, report });
  await checkDartyLive({ open, load, project, selected, views, wait, base, output, report });
  // Homepage opens on the piano for now (owner, 28 Oct), whatever the RNG says.
  for (let i = 0; i < ids.length; i++) {
    const { context, page } = await open(views[0], 'system-dark', true, { random: (i + .5) / ids.length });
    await load(page, 'index.html');
    assert.equal(await selected(page), 'piano', 'Homepage starts on the piano');
    assert.equal(await page.$eval('[data-project-status]', status => status.textContent), '1 of 4', 'Homepage retains its four-project count');
    await context.close();
  }
  // Review links still select the matching project after the intro was inserted.
  const review = await open(views[0], 'light');
  for (const [position, id] of sectionIds.entries()) {
    await load(review.page, `children.html?project=${id}#learner-projects`);
    assert.equal(await selected(review.page), id);
    assert.equal(await review.page.$eval('[data-project-status]', status => status.textContent), `${position + 1} of 5`);
  }
  await load(review.page, 'children.html?project=unknown#learner-projects');
  assert.equal(await selected(review.page), 'intro', 'An invalid review override opens the introduction');
  await review.context.close();
  const { context, page } = await open(views[0], 'system-dark', false, { fast: true });
  // Prevent networkidle0 consuming an accelerated idle period before assertions.
  await page.goto(`${base}/index.html?project=darty`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-showcase-ready]');
  await page.$eval('[data-showcase]', root => root.dispatchEvent(new Event('pointermove')));
  await wait(450);
  assert.equal(await selected(page), 'darty');
  await page.$eval('[data-showcase]', root => root.dispatchEvent(new Event('pointermove')));
  await wait(450);
  assert.equal(await selected(page), 'darty', 'Interaction postpones the deadline');
  await page.waitForFunction(() => document.querySelector('[data-showcase]').dataset.project === 'drinks');
  await page.$eval('[data-showcase]', root => root.focus());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Focused cell cannot advance');
  await page.waitForSelector('.drink-spin');
  for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
    await page.click(`[data-drink="${drink}"]`);
    await page.waitForFunction(() => document.querySelector('.drink-spin')?.dataset.frameCount);
    assert.equal(await page.$eval('.drink-spin', button => button.getAttribute('aria-label')), `Rotate ${drink === 'ground-pinch' ? 'Ground Pinch' : drink === 'skids' ? 'Skids' : 'Fizzy'}, 360° view`);
  }
  await page.evaluate(() => { window.oldSpin = document.querySelector('.drink-spin'); });
  await project(page, 'piano');
  assert(await page.evaluate(() => !window.oldSpin.isConnected), 'Switched frame viewer is disposed');
  report.pianoToggles.push(await activatePianoToggle(page, 'Idle/held-key check'));
  await page.keyboard.down('z');
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'piano', 'A held playing key blocks advance even after focus leaves');
  await page.keyboard.up('z');
  await page.$eval('[data-showcase]', root => root.focus());
  await page.evaluate(() => { window.oldSky = document.querySelector('#sky-canvas'); });
  await project(page, 'football');
  await page.waitForSelector('iframe');
  await page.waitForFunction(() => window.showcaseAudio.every(audio => audio.state !== 'running'));
  assert(await page.evaluate(() => !window.oldSky.isConnected && window.showcaseAudio.every(audio => audio.state !== 'running')), 'Piano sky detached and audio suspended');
  await page.evaluate(() => { window.oldFrame = document.querySelector('iframe'); });
  await project(page, 'darty');
  assert(await page.evaluate(() => { const layer = window.oldFrame.closest('.showcase-newspaper-layer'); return window.oldFrame.isConnected && layer.inert && !layer.hasAttribute('data-showcase-revealed'); }), 'The loaded newspaper stays parked, hidden and inert');
  await project(page, 'drinks');
  await page.evaluate(() => {
    window.backgroundSpin = document.querySelector('.drink-spin');
    window.backgroundFrame = window.backgroundSpin.dataset.frame;
    window.showcaseHidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.showcaseHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Hidden document does not advance');
  assert(await page.evaluate(() => window.backgroundSpin.dataset.active === 'false' && window.backgroundSpin.dataset.frame === window.backgroundFrame), 'Background frame viewer is paused');
  await page.evaluate(() => { window.showcaseHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.$eval('[data-showcase]', root => root.focus());
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Reduced motion prevents automatic advance');
  assert(new URL(await page.$eval('.drink-spin img', img => img.src)).pathname.endsWith('/poster.webp'), 'Changing to reduced motion restores the poster before manual input');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await load(page, 'children.html?project=drinks#learner-projects');
  await page.evaluate(() => document.activeElement.blur());
  await wait(1700);
  assert.equal(await selected(page), 'drinks', 'Projects remain manual');
  await page.focus('[data-showcase]');
  for (const [key, id] of [['End', 'piano'], ['ArrowLeft', 'drinks'], ['Home', 'intro'], ['ArrowLeft', 'piano'], ['ArrowRight', 'intro'], ['ArrowRight', 'football'], ['ArrowRight', 'darty']]) {
    await page.keyboard.press(key);
    assert.equal(await selected(page), id, `Manual keyboard navigation: ${key}`);
  }
  await page.focus('[data-darty-play]');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await selected(page), 'darty', 'Play button keyboard input does not change projects');
  await project(page, 'drinks');
  await page.focus('[data-project-enquiry]');
  assert.deepEqual(await page.$eval('[data-project-enquiry]', link => ({ label: link.firstChild.textContent.trim(), href: link.getAttribute('href'), service: link.dataset.service })),
    { label: 'Tell us what they love', href: 'contact', service: 'children' });
  await page.keyboard.press('ArrowRight');
  assert.equal(await selected(page), 'drinks', 'The Projects enquiry button retains keyboard input');
  await assertImmediateProjectSwitch(page, 'next');
  assert(await page.$eval('[data-project-enquiry]', link => document.activeElement === link), 'The shared Projects enquiry keeps focus when the slide changes');
  await project(page, 'drinks');
  await page.evaluate(() => { window.sectionSpin = document.querySelector('.drink-spin'); });
  await page.$eval('[data-panel-link][href="#getting-started"]', link => link.click());
  await page.waitForFunction(() => document.querySelector('#learner-projects').hidden);
  assert.equal(new URL(page.url()).hash, '', 'Panel switches leave the address clean');
  assert(await page.evaluate(() => window.sectionSpin.dataset.active === 'false'), 'Hidden Projects section pauses its frame viewer');
  await page.focus('#getting-started a.button');
  assert.deepEqual(await page.$eval('#getting-started a.button', link => ({ label: link.firstChild.textContent.trim(), href: link.getAttribute('href'), service: link.dataset.service })),
    { label: 'Tell us your child’s goal', href: 'contact', service: 'children' });
  report.behaviour.push('homepage unchanged, five-slide section, intro, separate result cells, review overrides, wrap, interaction reset, idle advance, focus, held playing key, all drink sequences, piano/audio/iframe teardown, tab visibility, reduced motion, manual mode, hidden section');
  await context.close();
  // Keep the intro, all four projects and separate result cells for no-JS and print.
  const staticView = await open(views[0], 'light');
  await staticView.page.setJavaScriptEnabled(false);
  await staticView.page.goto(`${base}/children.html#learner-projects`, { waitUntil: 'networkidle0' });
  assert.equal(await staticView.page.$$eval('[data-project-slide]', slides => slides.filter(slide => getComputedStyle(slide).display !== 'none').length), 5);
  assert.equal(await staticView.page.$$eval('.project-copy-result', cells => cells.filter(cell => getComputedStyle(cell).display !== 'none').length), 4);
  await staticView.context.close();
  const printView = await open(views[0], 'light');
  await load(printView.page, 'children.html#learner-projects');
  await printView.page.emulateMediaType('print');
  await printView.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await printView.page.$$eval('[data-project-slide]', slides => slides.filter(slide => getComputedStyle(slide).display !== 'none' && getComputedStyle(slide).visibility !== 'hidden').length), 5);
  assert.equal(await printView.page.$$eval('.project-copy-result', cells => cells.filter(cell => getComputedStyle(cell).display !== 'none' && getComputedStyle(cell).visibility !== 'hidden').length), 4);
  assert.equal(await printView.page.$$eval('.showcase-fallback', images => images.filter(img => getComputedStyle(img).display !== 'none').length), 4);
  await printView.page.screenshot({ path: path.join(output, 'projects-print.png'), fullPage: true });
  await printView.context.close();
  assert.deepEqual(report.errors, [], 'No browser, asset or CSP errors');
  report.status = 'PASS';
  console.log(`Shared showcase browser checks passed. Screenshots: ${output}`);
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
