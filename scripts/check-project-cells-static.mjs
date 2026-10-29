import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(site, 'children.html'), 'utf8');
const section = html.split('<section id="learner-projects"')[1]?.split('</section>')[0];
assert(section, 'Missing Projects & learning section');
assert(!/football phrase/i.test(html), 'Do not attribute Ground Pinch to a football phrase');
assert(!/\b(?:harry|joe|baker|psychologist|joshua)\b/i.test(section), 'Private or disallowed name in project copy');
assert(!/<script\b(?![^>]*\bsrc=)|<style\b|\sstyle\s*=|\son\w+\s*=/i.test(html), 'Inline code violates the CSP');
assert(html.includes("script-src 'self'; style-src 'self'") && !/unsafe-inline|unsafe-eval/.test(html), 'Strict CSP changed');
const slides = [...section.matchAll(/<article\b[^>]*data-project-slide[^>]*data-project="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)].map(([, id, html]) => ({ id, html }));
assert.deepEqual(slides.map(slide => slide.id), ['intro', 'football', 'darty', 'drinks', 'piano']);
const text = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const intro = slides[0].html;
assert(intro.includes('class="framework-project-copy subject-card"'), 'Intro uses the shared card palette');
assert.equal(text(intro), 'Learning is easier when you enjoy it. So we start with what each learner already loves and build the lessons around it. The right environment does the heavy lifting: they grow by doing, with support pitched just beyond what they can do alone. Have a look through all four.', 'Exact intro copy, with no extra words or hints');
assert.equal((intro.match(/<h3>/g) || []).length, 1);
assert.equal((intro.match(/<p>/g) || []).length, 1);
assert(!/<(?:iframe|video|canvas|audio)\b|framework-project-media|project-copy-cells|project-copy-result/.test(intro), 'The intro has only its copy and reserved image slot');
assert.equal((intro.match(/<img\b/g) || []).length, 1, 'Exactly one intro image');
assert(intro.includes('class="project-intro-image"') && intro.includes('src="assets/projects/intro-learning.jpg" alt=""'), 'The image slot accepts the replacement photo without copy changes');
const introJPEG = await readFile(path.join(site, 'assets/projects/intro-learning.jpg'));
assert(introJPEG.length > 0 && introJPEG[0] === 0xff && introJPEG[1] === 0xd8, 'A real local JPEG placeholder prevents a broken image');
const approved = [
  ['Sports journalism', 'English',
    'Confident, persuasive writing: making a clear case, backing it up, and knowing your reader.',
    'Telling fact from opinion, and writing both: objective match reports and previews, then subjective opinion pieces where he argues his corner. Word choice mattered too. Is a fan’s view “disgraceful”, or just “controversial”?',
    'Football. He already had strong opinions about Leeds, tactics and the modern game, so every lesson started with something he wanted to say.',
    'His own newspaper of match previews, a full match report, analysis and opinion pieces, from hydration breaks to how football has changed since 1970. Written by him, with our support on the editing.'],
  ['DARTY', 'English · Game design',
    'Writing clear, precise instructions, and writing because there’s a real reason to.',
    'Writing with purpose, cause and effect, and intrinsic motivation. When he writes “the defenders keep passing back and forth, needs fixing”, he sees exactly what his words change.',
    'He loves football games. When we started, writing was the last thing he wanted to do. Now every change to his game starts with him writing it down.',
    'A playable football game shaped by his written requests, from player movement to goalkeeper reactions. We build the code; he directs it.'],
  ['Drink design', 'English · Design',
    'Writing for an audience: knowing who you’re selling to, and choosing words that land.',
    'Slogans, word choice and persuasive language. “Fizzy, extreme.”, “When you’re in a rush, have some Skids.” and Ground Pinch’s motto, “Designed for everyone.”, are all his.',
    'Designing drinks he’d actually want to buy, so the names, labels and adverts mattered to him. His pitch: “It’s sweet, fast, cheap, and will help you destroy your enemies.”',
    'Three drinks, from his pencil drawings and labels to 3D renders you can spin.'],
  ['Piano', 'Music',
    'A way into music through play, with no pressure to get it right first time.',
    'Listening, spotting patterns and keeping time. Orange shows the note to play now and green the one after, while the tempo bar keeps the beat.',
    'Hear a note, play it back, try again. Short wins build into real songs like The Entertainer.',
    'A piano anyone can play, right here on the site, with songs to learn and sounds to try.'],
];
for (const [index, { html: slide }] of slides.slice(1).entries()) {
  const [heading, label, goal, skills, link, result] = approved[index];
  const copy = slide.match(/<div class="framework-project-copy subject-card">([\s\S]*?)<\/div>\s*<div class="framework-project-media"/)?.[1];
  assert(copy, `${heading}: missing shared copy card`);
  assert.equal(text(copy), `${label} ${heading} The goal ${goal} Developing skills ${skills} Finding the link ${link} The result ${result} See how our lessons work →`, `${heading}: exact approved copy and labels, with no extra words or hints`);
  const cells = copy.match(/<div class="project-copy-cells">([\s\S]*?)\n\s*<\/div>/)?.[1];
  assert(cells, `${heading}: missing copy rows`);
  assert.deepEqual([...cells.matchAll(/<div><h4>([^<]+)<\/h4><p>([^<]+)<\/p><\/div>/g)].map(([, label, body]) => [label, body]), [
    ['The goal', goal], ['Developing skills', skills], ['Finding the link', link],
  ], `${heading}: three labelled rows`);
  assert(!cells.includes('project-copy-result'), `${heading}: result is outside the teaching rows`);
  assert(copy.includes(`</div>\n                  <div class="project-copy-result"><h4>The result</h4><p>${result}</p></div>`), `${heading}: result is its own cell below the rows`);
  assert.equal((copy.match(/class="project-copy-result"/g) || []).length, 1, `${heading}: exactly one result cell`);
  assert(slide.includes('href="approach.html#ways-of-working">See how our lessons work →</a>'), 'Lesson link changed');
  for (const [, url] of slide.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert(!/^(?:https?:|\/\/|data:)/i.test(url), `External project asset: ${url}`);
    assert((await stat(path.resolve(site, url.split(/[?#]/)[0]))).isFile(), `Missing project asset: ${url}`);
  }
}
for (const [index, quotes] of [
  [1, ['disgraceful', 'controversial']],
  [2, ['the defenders keep passing back and forth, needs fixing']],
  [3, ['Fizzy, extreme.', 'When you’re in a rush, have some Skids.', 'Designed for everyone.', 'It’s sweet, fast, cheap, and will help you destroy your enemies.']],
]) {
  for (const quote of quotes) assert(slides[index].html.includes(`“${quote}”`), `Changed learner quote: ${quote}`);
}
assert(slides[3].html.includes('data-project-media-slot="drink-design"'), 'Missing drink media slot');
assert(!/<iframe\b|<video\b/.test(section), 'Live media must be mounted only when selected');
assert(section.includes('Shared with each family’s permission, with names removed.'), 'Permission note removed');
assert(section.includes('data-showcase data-showcase-mode="manual"'), 'Missing shared manual showcase');
const showcase = await readFile(path.join(site, 'project-showcase.js'), 'utf8');
assert(showcase.includes('data-project-prev') && showcase.includes('data-project-next'), 'Missing showcase controls');
for (const drink of ['skids', 'fizzy', 'ground-pinch']) {
  for (const file of ['poster.webp', 'manifest.json']) {
    assert((await stat(path.join(site, 'assets/projects/drinks', drink, file))).size > 0, `Missing drink asset: ${drink}/${file}`);
  }
}
console.log('Project copy checks passed (intro, 4 cards, 12 rows, 4 separate results, exact copy, local assets and CSP).');
