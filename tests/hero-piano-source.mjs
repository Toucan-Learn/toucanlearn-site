// Browser-free checks: node --experimental-vm-modules tests/hero-piano-source.mjs
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createContext, SourceTextModule } from 'node:vm';

const root = new URL('../', import.meta.url);
const sources = Object.fromEntries(await Promise.all(['hero-piano.js', 'hero-songs.js'].map(async name =>
  [name, await readFile(new URL(name, root), 'utf8')])));

async function load(id, portrait = false) {
  const clock = { now: 1000, contexts: 0, attacks: 0 };
  const changeListeners = new Set();
  const media = { matches: portrait, addEventListener: (_, fn) => changeListeners.add(fn) };
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => Object.assign({ connect() {}, disconnect() {}, start() { clock.attacks++; }, stop() {} },
    Object.fromEntries(['frequency', 'gain', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, parameter()])));
  class AudioContext {
    constructor() { clock.contexts++; this.currentTime = 0; this.state = 'running'; this.destination = node(); }
    createGain = node;
    createOscillator = node;
    createBiquadFilter = node;
    createStereoPanner = node;
    createDynamicsCompressor = node;
  }
  const context = createContext({ URLSearchParams, location: { search: `?song=${id}` },
    matchMedia: () => media, performance: { now: () => clock.now }, AudioContext });
  const songModule = new SourceTextModule(sources['hero-songs.js'], { context });
  const piano = new SourceTextModule(sources['hero-piano.js'], { context });
  await piano.link(() => songModule);
  await piano.evaluate();
  return { api: piano.namespace, clock, songs: songModule.namespace.songs,
    resize(value) { media.matches = value; for (const fn of changeListeners) fn(); } };
}

const seed = await load('runaway');
const fixtures = JSON.parse(await readFile(new URL('tests/fixtures/joplin-openings.json', root), 'utf8'));
assert.deepEqual(fixtures.entertainer.bars.map(bar => bar.number), [5, 6, 7, 8], 'Entertainer defaults to exactly the opening four-bar phrase');
assert.equal(seed.songs.find(song => song.id === 'entertainer').notes.length, 18);
for (const [id, reference] of Object.entries(fixtures)) {
  const sourceNotes = [...(reference.pickup || []), ...reference.bars.flatMap(bar => bar.attacks)];
  if (reference.pickup) {
    assert.deepEqual(sourceNotes.slice(-2), reference.pickup, 'The closing pickup belongs at the next loop start');
    sourceNotes.splice(-2);
  }
  const expected = sourceNotes.map(note => note.slice(0, -1) + (Number(note.at(-1)) + reference.transposeSemitones / 12));
  assert.deepEqual(Array.from(seed.songs.find(song => song.id === id).notes), expected, `${id}: matches the bar-by-bar public-domain transcription`);
}
assert.deepEqual(Array.from(seed.api.currentSong().notes), [
  'E6', 'E6', 'E6', 'E5', 'D#6', 'D#6', 'D#6', 'D#5',
  'C#6', 'C#6', 'C#6', 'C#5', 'A5', 'A5', 'G#5', 'E6',
], 'Runaway exactly matches the owner-supplied 16 attacks');
const songResults = [];
const html = await readFile(new URL('index.html', root), 'utf8');
const keyboard = await readFile(new URL('hero-keyboard.js', root), 'utf8');
const css = await readFile(new URL('hero.css', root), 'utf8');
const positions = [...html.matchAll(/data-note="([A-G]#?\d)"/g)].map(match => match[1]);
const mapped = [...keyboard.matchAll(/\['[^']+', '([A-G]#?\d)'\]/g)].map(match => match[1]);
assert.equal(new Set(positions).size, 37);
assert.equal(new Set(mapped).size, 37);
for (const id of ['runaway', 'no-one-noticed']) {
  const song = seed.songs.find(song => song.id === id);
  const selector = `.piano-panel[data-song="${id}"] .piano-key:is(`;
  const visibleRule = css.slice(css.indexOf(selector) + selector.length).split(') {')[0];
  const visiblePitches = [...visibleRule.matchAll(/data-note="([A-G]#?\d)"/g)]
    .map(match => match[1].slice(0, -1) + (Number(match[1].at(-1)) + (song.keyboardOctave || 0)));
  for (const note of song.notes) assert.ok(visiblePitches.includes(note), `${id}: ${note} is in the fitted phone span`);
}
for (const song of seed.songs) {
  const { api, clock } = await load(song.id);
  assert.equal(api.currentSong().id, song.id);
  assert.equal(api.availableSongs().length, 5);
  assert.equal(clock.contexts, 0, 'No autoplay');
  const shift = note => note.slice(0, -1) + (Number(note.at(-1)) + api.songKeyboardOctave());
  for (const note of song.notes) {
    assert.ok(positions.map(shift).includes(note), `${song.id}: piano button for ${note}`);
    assert.ok(mapped.map(shift).includes(note), `${song.id}: computer key for ${note}`);
  }
  const advanced = [];
  const unsubscribe = api.onSongAdvance(note => advanced.push(note));
  for (let loop = 0; loop < 3; loop++) {
    for (const note of song.notes) {
      assert.equal(api.peekNextNote(), note, `${song.id}: every note in order`);
      clock.now += 300;
      const before = clock.attacks;
      api.playNextNote();
      assert.equal(clock.attacks - before, 4, 'Exactly one voice per note');
    }
    assert.equal(api.peekNextNote(), song.notes[0], 'Wrap only after the final note');
  }
  assert.equal(advanced.length, song.notes.length * 3, 'One callback per note, including repetitions');
  unsubscribe();
  api.advance();
  assert.equal(advanced.length, song.notes.length * 3, 'Unsubscribe remains compatible');
  const beforeInvalid = clock.attacks;
  assert.equal(api.playNote('invalid'), false);
  assert.equal(clock.attacks, beforeInvalid);
  songResults.push({ id: song.id, notes: song.notes.length, loops: 3, octave: api.songKeyboardOctave() });
}

for (const song of seed.songs) {
  const { api } = await load(song.id, true);
  assert.deepEqual(Array.from(api.availableSongs(), candidate => candidate.id), ['runaway', 'no-one-noticed']);
  assert.ok(['runaway', 'no-one-noticed'].includes(api.currentSong().id), 'Query cannot bypass phone restriction');
}
const resize = await load('entertainer');
resize.api.advance();
resize.resize(true);
assert.ok(['runaway', 'no-one-noticed'].includes(resize.api.currentSong().id));
assert.equal(resize.api.peekNextNote(), resize.api.currentSong().notes[0]);
resize.resize(false);
assert.equal(resize.api.availableSongs().length, 5);

for (const id of ['runaway', 'no-one-noticed']) {
  const rotation = await load(id, true);
  for (let i = 0; i < 3; i++) rotation.api.playNextNote();
  const api = rotation.api;
  const selected = api.currentSong();
  const next = api.peekNextNote();
  const attacks = rotation.clock.attacks;
  const contexts = rotation.clock.contexts;
  const notifications = [];
  api.onSongAdvance(note => notifications.push(note));
  for (const portrait of [false, true, false, true]) {
    rotation.resize(portrait);
    assert.equal(rotation.api, api);
    assert.equal(api.currentSong(), selected, 'Rotation retains an available song');
    assert.equal(api.peekNextNote(), next, 'Rotation retains its current note');
  }
  assert.deepEqual(notifications, [next, next, next, next], 'The same listeners receive all layout updates');
  assert.equal(rotation.clock.contexts, contexts);
  assert.equal(rotation.clock.attacks, attacks);
}

for (const portrait of [false, true]) {
  const cycle = await load('runaway', portrait);
  const choices = Array.from(cycle.api.availableSongs(), song => song.id);
  const initial = cycle.api.currentSong().id;
  const seen = [];
  let notifications = 0;
  cycle.api.onSongAdvance(() => notifications++);
  for (let i = 0; i < choices.length * 2; i++) {
    cycle.api.advance();
    const before = notifications;
    const expected = choices[(choices.indexOf(cycle.api.currentSong().id) + 1) % choices.length];
    cycle.api.nextSong();
    seen.push(cycle.api.currentSong().id);
    assert.equal(cycle.api.currentSong().id, expected, 'Next song follows the available list');
    assert.equal(cycle.api.peekNextNote(), cycle.api.currentSong().notes[0], 'A new song starts at its first attack');
    assert.equal(notifications, before + 1, 'A selection updates the highlight once');
    assert.equal(cycle.api.noteWavePosition(), .5, 'A new song resets the tempo origin');
  }
  assert.equal(cycle.api.currentSong().id, initial, 'Song cycling wraps');
  assert.deepEqual([...new Set(seen)].sort(), [...choices].sort());
  assert.equal(cycle.clock.contexts, 0, 'Song selection never creates audio');
  assert.equal(cycle.clock.attacks, 0, 'Song selection never starts a note');
}

const tempo = await load('runaway');
const strike = interval => { tempo.clock.now += interval; tempo.api.playNote('E6'); return tempo.api.noteWavePosition(); };
assert.equal(strike(2500), .5);
const fast = [strike(90), strike(90), strike(90), strike(90)];
assert.ok(fast.every((y, i) => y >= .18 && y <= .82 && (i === 0 || y < fast[i - 1])));
assert.ok(fast.at(-1) < .25);
const slow = [strike(1250), strike(1250), strike(1250)];
assert.ok(slow.every((y, i) => y >= .18 && y <= .82 && (i === 0 || y > slow[i - 1])));
assert.ok(slow.at(-1) > .8);
assert.equal(strike(2500), .5);
const sweep = [];
for (const interval of [0, 75, 150, 300, 600, 900, 1200, 1800]) {
  strike(2500);
  sweep.push({ interval, y: strike(interval) });
}
assert.ok(sweep.every((point, i) => i === 0 || point.y >= sweep[i - 1].y), 'Slower always means lower');
assert.equal(sweep[0].y, sweep[2].y, 'Fast end clamps');
assert.equal(sweep.at(-1).y, sweep.at(-2).y, 'Slow end clamps');

const result = { status: 'PASS', songs: songResults, joplinTranscriptions: 'PASS', exactRunaway: 'PASS', mobileAndResize: 'PASS', rotationStateRetention: 'PASS', songCycling: 'PASS', tempo: { fast, slow, sweep },
  scope: 'Source and simulated audio only; browser layout, real audio and GPU unverified' };
const output = globalThis.process?.env?.PIANO_OUTPUT || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/final-pass-20261028/codex-piano';
await mkdir(output, { recursive: true });
await writeFile(`${output}/source-report.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
