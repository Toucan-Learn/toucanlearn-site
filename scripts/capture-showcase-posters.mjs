// Recapture the football and piano stand-in posters from the live views.
// The poster shows while the live view loads, then cross-fades into it, so it
// must match what is underneath or the switch flickers. Rerun after any change
// to the newspaper front page or the piano: BASE_URL=<local server> node scripts/capture-showcase-posters.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKY_PRESETS } from '../hero-sky-shaders.js';

const site = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:4206';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// The owner's laptop: 1440 x 750 at 2x. Home is the automatic carousel; section is the children page.
const pages = [['home', 'index.html'], ['section', 'children.html']];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const scratch = await mkdtemp(path.join(tmpdir(), 'showcase-posters-'));
try {
  // The piano sky is random per page load; each sky gets its own poster.
  const views = [['football', ''], ...SKY_PRESETS.map(sky => ['piano', sky.id])];
  // Phones get their own captures: the cell there is near-square, so a laptop
  // poster would show the toucan larger than the live view (owner, 30 Oct).
  const sizes = [['', { width: 1440, height: 750, deviceScaleFactor: 2 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]];
  for (const [size, viewport] of sizes) for (const [mode, route] of pages) for (const [id, sky] of views) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('toucan-launch-offer-last-shown', String(Date.now())); } catch {} });
    await page.goto(`${base}/${route}?project=${id}${sky ? `&sky=${sky}` : ''}`, { waitUntil: 'networkidle0' });
    if (mode === 'section') await page.$eval('[data-panel-link][href="#learner-projects"]', link => link.click());
    await page.$eval('[data-showcase]', root => root.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForSelector('.showcase-stage > .showcase-live[data-showcase-revealed], .showcase-newspaper-layer[data-showcase-revealed]', { timeout: 30000 });
    if (id === 'football') {
      await page.$eval('.showcase-newspaper', async iframe => {
        const doc = iframe.contentDocument;
        await doc.fonts.ready;
        // Lazy images below the fold never load; give the visible ones a few seconds.
        const loaded = Promise.all([...doc.images].map(img => img.complete ? null : new Promise(done => { img.onload = img.onerror = done; })));
        await Promise.race([loaded, new Promise(done => setTimeout(done, 5000))]);
      });
    }
    await wait(1500);
    // The toucan's float restarts on every mount and is near its start pose at the reveal.
    await page.$$eval('.showcase-stage .hero-mascot', nodes => nodes.forEach(node => node.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 0; })));
    await wait(100);
    // Only the stage is captured; the piano toggle sits over it on its own.
    await page.$$eval('.showcase-piano-control', nodes => nodes.forEach(node => { node.style.visibility = 'hidden'; }));
    await page.$$eval('.site-header, header', nodes => nodes.forEach(node => { node.style.visibility = 'hidden'; }));
    const stage = await page.$('.showcase-stage');
    const clip = await stage.boundingBox();
    const name = [id === 'piano' ? 'toucan-piano' : id, mode, size, sky].filter(Boolean).join('-');
    const png = path.join(scratch, `${name}.png`);
    await stage.screenshot({ path: png });
    const out = path.join(site, 'assets/projects', `${name}.webp`);
    execFileSync('cwebp', ['-quiet', '-q', '86', '-m', '6', png, '-o', out]);
    console.log(`${path.relative(site, out)} ${Math.round(clip.width)}x${Math.round(clip.height)}`);
    await page.close();
  }
} finally {
  await browser.close();
  await rm(scratch, { recursive: true, force: true });
}
