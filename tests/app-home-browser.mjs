// Phone app homepage in Chrome. Run from this worktree, with python3 -m http.server 4205 in another terminal:
// node tests/app-home-browser.mjs
// The booking submission is answered locally: nothing reaches the real enquiry endpoint.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(pathToFileURL(require.resolve(
  process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core',
)));
const base = process.env.BASE_URL || 'http://127.0.0.1:4205';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-sandbox'],
});
// Exact phone-block URLs (the desktop showcase requests its own, versioned drink frames).
const phoneOnly = /\/assets\/(?:app-home\/[\w-]+\.webp|projects\/drinks\/skids\/(?:\d{3}|poster)\.webp|teal-pixel-sky\.webp)$/;

async function open(viewport, { stub } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const requests = [], posts = [];
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      posts.push({ url, body: request.postData() || '' });
      return stub ? request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }) : request.abort();
    }
    if (/clarity\.ms|bing\.com/.test(url)) return request.abort();
    requests.push(url);
    request.continue();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  return { page, requests, posts, errors };
}
const barOn = page => page.$eval('[data-ah-bar]', bar => bar.classList.contains('is-on'));
const scrollToSel = (page, selector) => page.evaluate(s => {
  const el = document.querySelector(s); scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'instant' });
}, selector);

// Desktop: the phone block is hidden and none of its assets are fetched.
{
  const { page, requests, errors } = await open({ width: 1440, height: 750, deviceScaleFactor: 1 });
  assert.equal(await page.$eval('[data-app-home]', el => getComputedStyle(el).display), 'none');
  for (let y = 0; y < 9000; y += 600) { await page.evaluate(y => scrollTo(0, y), y); await wait(120); }
  await wait(800);
  const fetched = requests.filter(url => phoneOnly.test(url) && !url.endsWith('.css'));
  assert.deepEqual(fetched, [], 'Desktop never downloads phone-only art or drink frames');
  assert.deepEqual(errors, []);
  await page.close();
}

// Phone: sticky bar, story cards, drink frames, report deck, team sheet, menu/sheet cover, booking.
{
  const { page, requests, posts, errors } = await open({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, { stub: true });
  assert.equal(await page.$eval('#main > .living-hero', el => getComputedStyle(el).display), 'none');
  const cta = await page.$eval('[data-ah-hero-cta]', el => el.getBoundingClientRect().bottom);
  assert(cta < 844, `Hero button is above the fold (${cta}px)`);
  assert.equal(await barOn(page), false, 'No sticky bar while the hero button is visible');
  assert.equal(requests.filter(url => url.includes('drinks/skids/') && !url.endsWith('poster.webp')).length, 0, 'No drink frames before the projects card');

  await scrollToSel(page, '#ah-projects'); await wait(600);
  assert.equal(await barOn(page), true, 'Sticky bar once the hero button has left view');
  assert.equal(requests.filter(url => /drinks\/skids\/\d{3}\.webp/.test(url)).length, 0, 'No frames until the drink is in front');
  await page.$eval('[data-ah-track]', track => { track.scrollLeft = track.querySelector('[data-ah-slide]').getBoundingClientRect().width + 12; });
  await wait(1200);
  assert.equal(await page.$$eval('[data-ah-dots] i', dots => dots.findIndex(d => d.classList.contains('on'))), 1);
  assert(requests.filter(url => /drinks\/skids\/\d{3}\.webp/.test(url)).length > 0, 'Drink turn starts when its card is in front');

  await scrollToSel(page, '#ah-report'); await wait(400);
  const first = await page.$eval('[data-ah-card][data-pos="0"] h3', h => h.textContent);
  await page.click('[data-ah-deck-next]'); await wait(700);
  assert.notEqual(await page.$eval('[data-ah-card][data-pos="0"] h3', h => h.textContent), first);

  await page.click('.mobile-menu summary'); await wait(300);
  assert.equal(await barOn(page), false, 'Bar hides while the menu is open');
  await page.click('.mobile-menu summary'); await wait(300);
  assert.equal(await barOn(page), true);

  await scrollToSel(page, '#ah-team'); await wait(400);
  await page.click('.ah-av--connor button'); await wait(600);
  assert.equal(await page.$eval('[data-ah-ts-name]', el => el.textContent), 'Connor Wright');
  assert.equal(await barOn(page), false, 'Bar hides under a sheet');
  await page.keyboard.press('Escape'); await wait(600);
  assert.equal(await page.$eval('[data-ah-team-sheet]', el => el.hidden), true);

  // Booking: empty submit shows errors and sends nothing; a valid one goes through contact.js to the (stubbed) endpoint.
  await scrollToSel(page, '.ah-final'); await wait(300);
  await page.click('[data-ah-final-cta]'); await wait(600);
  assert.equal(await page.$eval('[data-ah-book-sheet]', el => el.hidden), false);
  await page.click('#submit-button'); await wait(300);
  assert.equal(posts.length, 0);
  assert.notEqual(await page.$eval('#contact-name-error', el => el.textContent), '');
  await page.type('#contact-name', 'Test Parent');
  await page.type('#reply-contact', 'test@example.com');
  await page.type('#support-needed', 'GCSE maths');
  await wait(3200); // contact.js rejects forms sent within three seconds of loading.
  await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('#submit-button')]);
  assert.equal(posts.length, 1);
  const sent = Object.fromEntries(new URLSearchParams(posts[0].body));
  assert.equal(sent['Contact name'], 'Test Parent');
  assert.equal(sent.email, 'test@example.com');
  assert.equal(sent['Reply method'], 'email');
  assert.equal(sent['Support requested'], 'GCSE maths');
  assert.match(sent.loaded_at, /^\d{13}$/);
  assert.equal(sent['Campaign source'], 'Direct or unknown');
  assert.match(page.url(), /\/thank-you$/);
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
console.log('PASS: desktop fetches no phone assets; phone bar, cards, drink frames, report deck, team sheet, menu cover and stubbed booking via contact.js.');
