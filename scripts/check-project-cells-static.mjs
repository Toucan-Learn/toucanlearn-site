import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(site, 'children.html'), 'utf8');
const section = html.split('<section id="learner-projects"')[1]?.split('</section>')[0];
assert(section, 'Missing Projects & learning section');
assert(!/\b(?:harry|joe|baker|psychologist|joshua)\b/i.test(section), 'Private or disallowed name in project copy');
assert(!/<script\b(?![^>]*\bsrc=)|<style\b|\sstyle\s*=|\son\w+\s*=/i.test(html), 'Inline code violates the CSP');
assert(html.includes("script-src 'self'; style-src 'self'") && !/unsafe-inline|unsafe-eval/.test(html), 'Strict CSP changed');
const slides = [...section.matchAll(/<article\b[^>]*data-project-slide[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
assert.equal(slides.length, 4);
for (const [index, slide] of slides.entries()) {
  assert(slide.includes('class="framework-project-copy subject-card"'), `Slide ${index + 1}: missing shared card palette`);
  const cells = slide.match(/<div class="project-copy-cells">([\s\S]*?)\n\s*<\/div>/)?.[1];
  assert(cells, `Slide ${index + 1}: missing copy rows`);
  assert.equal((cells.match(/<h4>/g) || []).length, 3, `Slide ${index + 1}: expected three labelled rows`);
  assert.equal((cells.match(/<p(?:\s[^>]*)?>/g) || []).length, 3, `Slide ${index + 1}: expected three short paragraphs`);
  assert(slide.includes('href="approach.html#ways-of-working">See how our lessons work →</a>'), 'Lesson link changed');
  for (const [, url] of slide.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert(!/^(?:https?:|\/\/|data:)/i.test(url), `External project asset: ${url}`);
    assert((await stat(path.resolve(site, url.split(/[?#]/)[0]))).isFile(), `Missing project asset: ${url}`);
  }
}
for (const quote of ['light, bright red', 'Fizzy, extreme.', 'designed for everyone', "When you're in a rush, have some Skids."]) {
  assert(section.includes(`“${quote}”`), `Changed learner quote: ${quote}`);
}
assert(slides[0].includes('Leeds: a case for 13th') && slides[0].includes('statistics'), 'Missing journalism examples');
assert(slides[1].includes('written request') && slides[1].includes('video showcase is planned'), 'Missing DARTY process or next step');
assert(slides[2].includes('data-project-media-slot="drink-design"') && slides[2].includes('3D renders'), 'Missing drink media slot or next step');
assert(!/<video\b/.test(slides[2]), 'Do not add a video before the MP4 exists');
assert(slides[3].includes('homepage') && slides[3].includes('next green note') && slides[3].includes('tempo'), 'Missing piano guidance');
assert(section.includes("Shared with each family's permission, with names removed."), 'Permission note removed');
assert(section.includes('data-project-prev') && section.includes('data-project-next') && section.includes('1 of 4'), 'Project navigation removed');
// The existing static suite must inspect this worktree, rather than its own sibling checkout.
process.env.SHOWCASE_SITE = site;
process.env.SHOWCASE_PROJECTS_ONLY = '1';
await import('../../website-codex-showcase/scripts/check-showcase-static.mjs');
console.log('Project copy checks passed (4 cards, 12 rows, exact quotes, local assets and CSP).');
