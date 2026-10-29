// Browser-free checks: node --experimental-vm-modules tests/hero-piano-source.mjs
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createContext, SourceTextModule } from 'node:vm';
import { createAudioHarness } from './helpers/piano-audio.mjs';

const root = new URL('../', import.meta.url);
const sources = Object.fromEntries(await Promise.all(['hero-piano.js', 'hero-songs.js', 'hero-piano-voices.js'].map(async name =>
  [name, await readFile(new URL(name, root), 'utf8')])));

async function load(id, portrait = false) {
  const clock = { now: 1000, contexts: 0, attacks: 0 };
  const changeListeners = new Set();
  const media = { matches: portrait, addEventListener: (_, fn) => changeListeners.add(fn) };
  const harness = createAudioHarness({ onStart: () => clock.attacks++ });
  const { AudioContext } = harness;
  const context = createContext({ URLSearchParams, location: { search: `?song=${id}` },
    matchMedia: () => media, performance: { now: () => clock.now }, AudioContext });
  const songModule = new SourceTextModule(sources['hero-songs.js'], { context });
  const piano = new SourceTextModule(sources['hero-piano.js'], { context });
  const voices = new SourceTextModule(sources['hero-piano-voices.js'], { context });
  await piano.link(path => path.includes('hero-songs') ? songModule : voices);
  await piano.evaluate();
  return { api: piano.namespace, clock, songs: songModule.namespace.songs, audio: harness.metrics,
    resize(value) { media.matches = value; for (const fn of changeListeners) fn(); } };
}

const seed = await load('runaway');
const fixtures = JSON.parse(await readFile(new URL('tests/fixtures/joplin-openings.json', root), 'utf8'));
assert.deepEqual(fixtures.entertainer.bars.map(bar => bar.number), Array.from({ length: 16 }, (_, i) => i + 5),
  'Entertainer includes the complete first A strain through the first-ending cadence');
const entertainer = seed.songs.find(song => song.id === 'entertainer');
assert.equal(entertainer.notes.length, 77, 'Full strain plus its boundary pickup, with ties counted once');
const maple = seed.songs.find(song => song.id === 'maple-leaf-rag');
assert.deepEqual(fixtures[maple.id].bars.map(bar => bar.number), Array.from({ length: 8 }, (_, i) => i + 1),
  'Maple includes all eight printed bars through the answering phrase');
assert.equal(maple.notes.length, 36, 'Upper-staff attacks only, with ties counted once and the lower-staff bar 7 silent');
for (const [id, reference] of Object.entries(fixtures)) {
  const sourceNotes = [...(reference.pickup || []), ...reference.bars.flatMap(bar => bar.attacks)];
  if (reference.pickup) {
    assert.deepEqual(sourceNotes.slice(-2), reference.pickup, 'The closing pickup belongs at the next loop start');
    sourceNotes.splice(-2);
  }
  const expected = sourceNotes.map(note => note.slice(0, -1) + (Number(note.at(-1)) + reference.transposeSemitones / 12));
  assert.deepEqual(Array.from(seed.songs.find(song => song.id === id).notes), expected, `${id}: matches the bar-by-bar public-domain transcription`);
  if (reference.pickupBeats) {
    const onsets = [0, reference.pickupBeats[0], ...reference.bars.flatMap((bar, i) => {
      assert.equal(bar.attacks.length, bar.onsets.length, `Bar ${bar.number}: one onset per new attack`);
      assert.ok(bar.onsets.every((beat, j) => beat >= 0 && beat < 2 && (j === 0 || beat > bar.onsets[j - 1])));
      return bar.onsets.map(beat => .5 + i * 2 + beat);
    })];
    onsets.splice(-2); // The boundary pickup already starts this loop.
    const gaps = onsets.map((beat, i) => (onsets[i + 1] ?? reference.totalBeats) - beat);
    assert.deepEqual(Array.from(entertainer.noteBeats), gaps, 'Every duration follows the score onsets, including cross-bar ties');
    assert.equal(entertainer.noteBeats.length, entertainer.notes.length);
    assert.equal(entertainer.noteBeats.reduce((a, b) => a + b), 32, 'The loop is exactly sixteen 2/4 bars');
    assert.equal(entertainer.tempo, reference.tempo);
    assert.equal(entertainer.tempo, 100, 'A moderate practice tempo for the published Not fast indication');
    assert.ok(gaps.every(gap => gap > 0));
  } else if (reference.initialRestBeats !== undefined) {
    const onsets = reference.bars.flatMap((bar, i) => {
      assert.equal(bar.attacks.length, bar.onsets.length, `Bar ${bar.number}: one onset per upper-staff attack`);
      assert.ok(bar.onsets.every((beat, j) => beat >= 0 && beat < 2 && (j === 0 || beat > bar.onsets[j - 1])));
      return bar.onsets.map(beat => i * 2 + beat);
    });
    assert.equal(onsets[0], reference.initialRestBeats);
    const gaps = onsets.map((beat, i) => (onsets[i + 1] ?? reference.totalBeats + onsets[0]) - beat);
    assert.deepEqual(Array.from(maple.noteBeats), gaps, 'Maple preserves score onset gaps, ties, rests and the loop-boundary rest');
    assert.equal(maple.noteBeats.length, maple.notes.length);
    assert.equal(maple.noteBeats.reduce((a, b) => a + b), 16, 'Maple loops in exactly eight 2/4 bars');
    assert.equal(maple.tempo, reference.tempo);
    assert.equal(maple.tempo, 100, 'Retain Maple\'s existing 100 BPM practice pace');
    assert.ok(gaps.every(gap => gap > 0));
  }
}
assert.deepEqual(Array.from(maple.notes.slice(21)), [
  'G#4', 'B4', 'E5', 'D#5', 'D#5', 'G#4', 'B4', 'E5', 'D#5',
  'G#4', 'B4', 'G#5', 'G#5', 'B5', 'G#6',
], 'Maple adds the exact answering phrase: C-flat is B, F-flat is E, and the rising octaves are retained');
assert.equal(fixtures[maple.id].bars[6].staff, 'down');
assert.deepEqual(fixtures[maple.id].bars[6].attacks, [], 'Bar 7 is written on the lower staff, outside this upper-staff melody');
assert.equal(maple.noteBeats[29], 3, 'Hold the last bar-6 attack through the lower-staff bar and the bar-8 opening rest');
assert.equal(maple.noteBeats.at(-1), .5, 'The final sixteenth and the opening sixteenth rest complete the loop');
assert.equal(maple.keyboardOctave, 1, 'Shift the keyboard to C4-C7 for the upper-staff answer');
assert.deepEqual(Array.from(entertainer.notes.slice(0, 18)), [
  'D3', 'D#3', 'E3', 'C4', 'E3', 'C4', 'E3', 'C4', 'C5', 'D5', 'D#5', 'E5', 'C5', 'D5', 'E5', 'B4', 'D5', 'C5',
], 'The previously approved opening remains intact; the C4 to C5 leap is not folded');
assert.equal(entertainer.notes.at(-1), 'C5', 'The full strain finishes on its resolving cadence');
assert.equal(entertainer.noteBeats.at(-1), 1.5, 'The cadence holds until the loop-boundary pickup');
const pickupTimes = [];
let beat = 0;
for (let i = 0; i < entertainer.notes.length; i++) {
  if (entertainer.notes[i] === 'D3') {
    assert.equal(entertainer.notes[i + 1], 'D#3');
    pickupTimes.push(beat);
  }
  beat += entertainer.noteBeats[i];
}
assert.deepEqual(pickupTimes, [0, 8, 16], 'The boundary pickup occurs once at the start; published internal pickups are retained');
const gymnopedie = seed.songs.find(song => song.id === 'gymnopedie-1');
assert.deepEqual(Array.from(gymnopedie.notes), [
  'F#4', 'A4', 'G4', 'F#4', 'C#4', 'B3', 'C#4', 'D4', 'A3', 'F#3', 'F#3', 'F#3', 'F#3', 'F#3',
], 'Gymnopedie stops at the first phrase ending, before the bar-13 melody restart');
assert.equal(gymnopedie.notes.length, 14);
assert.equal(gymnopedie.noteBeats, undefined, 'Retain the existing effective duration map: one practice beat per attack');
assert.equal(gymnopedie.tempo, undefined, 'Retain its existing practice tempo rather than adding an unsupported timing map');
const pitchMidi = note => (Number(note.at(-1)) + 1) * 12
  + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[0]] + Number(note.includes('#'));
assert.deepEqual([Math.min(...entertainer.notes.map(pitchMidi)), Math.max(...entertainer.notes.map(pitchMidi))], [50, 76], 'The complete Entertainer strain fits D3-E5');
assert.deepEqual([Math.min(...maple.notes.map(pitchMidi)), Math.max(...maple.notes.map(pitchMidi))], [67, 92], 'The eight-bar upper-staff Maple melody spans G4-G#6');
assert.deepEqual([Math.min(...gymnopedie.notes.map(pitchMidi)), Math.max(...gymnopedie.notes.map(pitchMidi))], [54, 69], 'The shortened Gymnopedie fits F#3-A4');
assert.deepEqual(Array.from(seed.api.currentSong().notes), [
  'E6', 'E6', 'E6', 'E5', 'D#6', 'D#6', 'D#6', 'D#5',
  'C#6', 'C#6', 'C#6', 'C#5', 'A5', 'A5', 'G#5', 'E6',
], 'Runaway exactly matches the owner-supplied 16 attacks');
assert.equal(seed.api.currentSong().tempo, 85, 'Runaway plays at the owner tempo, slower than the 100 BPM default');
const songResults = [];
const html = await readFile(new URL('project-showcase.js', root), 'utf8');
const keyboard = await readFile(new URL('hero-keyboard.js', root), 'utf8');
const css = await readFile(new URL('hero.css', root), 'utf8');
assert.match(css, /--piano-now-green:\s*#63c47b;/, 'The note to play is green');
assert.match(css, /--piano-next-violet:\s*#7b6fd6;/, 'The note after is blue-violet');
for (const selector of ['.piano-key.is-now', '.piano-key.is-now.is-pressed', '.piano-key.is-now.is-next', '.piano-key.is-now.is-next.is-pressed']) {
  const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  assert.match(rule, /background: var\(--piano-now-green\)/, 'The current note is green, including repeated/pressed pitches');
}
for (const selector of ['.piano-key.is-next', '.piano-key.is-next.is-pressed']) {
  const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  assert.match(rule, /background: var\(--piano-next-tint\)/, 'The following note has a soft violet fill');
  assert.match(rule, /inset 0 0 0 2px var\(--piano-next-violet\)/, 'The following note has a violet edge');
}
for (const selector of ['.piano-key.is-now.is-next', '.piano-key.is-now.is-next.is-pressed']) {
  const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  assert.match(rule, /inset 0 0 0 3px var\(--piano-next-violet\)/, 'A repeated pitch has a clear violet inner ring');
}
assert.match(css, /\.piano-key:is\(\.is-now, \.is-next, \.is-pressed\)\[data-key\]::after \{ color: #0a272c;/,
  'Both black and white highlighted keys retain dark readable computer letters');
assert.match(html, /<progress class="piano-tempo-bar" max="1" value="0" aria-hidden="true">/,
  'A native progress value avoids CSP-blocked inline styles');
const rhythm = JSON.parse(await readFile(new URL('tests/fixtures/no-one-noticed-timing.json', root), 'utf8'));
const noticed = seed.songs.find(song => song.id === 'no-one-noticed');
assert.equal(noticed.tempo, rhythm.tempo);
assert.deepEqual(Array.from(noticed.notes), rhythm.attacks.map(([note]) => note));
assert.deepEqual(Array.from(noticed.noteBeats), rhythm.attacks.map(([, beat], i) =>
  Math.min(2, (rhythm.attacks[i + 1]?.[1] ?? rhythm.totalBeats) - beat)),
  'Score onset gaps, including rests, ties and loop ending, with long holds capped at two beats');
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
  assert.equal(api.currentVoicePreset(), song.id === 'no-one-noticed' ? song.id : 'classic');
  assert.equal(api.availableSongs().length, 5);
  assert.equal(clock.contexts, 0, 'No autoplay');
  assert.equal(api.noteTiming().phase, 'idle', 'No cue starts on load');
  const shift = note => note.slice(0, -1) + (Number(note.at(-1)) + api.songKeyboardOctave());
  for (const note of song.notes) {
    assert.ok(positions.map(shift).includes(note), `${song.id}: piano button for ${note}`);
    assert.ok(mapped.map(shift).includes(note), `${song.id}: computer key for ${note}`);
  }
  const advanced = [];
  const unsubscribe = api.onSongAdvance(note => advanced.push(note));
  for (let loop = 0; loop < 3; loop++) {
    for (const [i, note] of song.notes.entries()) {
      assert.equal(api.peekNextNote(), note, `${song.id}: every note in order`);
      assert.equal(api.peekNextNote(1), song.notes[(i + 1) % song.notes.length], `${song.id}: following note includes repeats and loop boundary`);
      clock.now += 300;
      const before = clock.attacks;
      api.playNextNote();
      assert.equal(clock.attacks - before, song.id === 'no-one-noticed' ? 5 : 4, 'Exactly one complete instrument voice per note');
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
  songResults.push({ id: song.id, notes: song.notes.length, loops: 3, octave: api.songKeyboardOctave(),
    minMidi: Math.min(...song.notes.map(pitchMidi)), maxMidi: Math.max(...song.notes.map(pitchMidi)) });
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
    assert.equal(cycle.api.currentVoicePreset(), expected === 'no-one-noticed' ? expected : 'classic');
    assert.equal(cycle.api.peekNextNote(), cycle.api.currentSong().notes[0], 'A new song starts at its first attack');
    assert.equal(notifications, before + 1, 'A selection updates the highlight once');
    assert.equal(cycle.api.noteWavePosition(), .5, 'A new song resets the tempo origin');
    assert.equal(cycle.api.noteTiming().phase, 'idle', 'Song cycling resets the cue');
    assert.equal(cycle.api.noteTiming().progress, 0);
    assert.equal(cycle.api.noteTiming().bpm, cycle.api.currentSong().tempo || 100);
  }
  assert.equal(cycle.api.currentSong().id, initial, 'Song cycling wraps');
  assert.deepEqual([...new Set(seen)].sort(), [...choices].sort());
  assert.equal(cycle.clock.contexts, 0, 'Song selection never creates audio');
  assert.equal(cycle.clock.attacks, 0, 'Song selection never starts a note');
}

// Exercise real song selection with live simulated graphs, including both
// phone presets and replacement of a now-unavailable desktop selection.
for (const portrait of [false, true]) {
  const live = await load('runaway', portrait);
  const count = live.api.availableSongs().length;
  for (let i = 0; i < count * 2; i++) {
    const id = live.api.currentSong().id;
    live.api.playNextNote();
    assert.equal(live.api.currentVoicePreset(), id === 'no-one-noticed' ? id : 'classic');
    const old = live.audio.nodes.filter(node => node.kind !== 'destination' && !node.disconnected);
    assert.ok(old.length > 0);
    const starts = live.clock.attacks;
    live.api.nextSong();
    assert.equal(live.clock.attacks, starts, 'Changing a voice is silent');
    assert.ok(old.every(node => node.disconnected), 'Next song releases the complete prior graph');
    assert.ok(old.filter(node => node.kind === 'convolver').every(node => node.buffer === null));
  }
}
const voiceResize = await load('entertainer');
voiceResize.api.playNextNote();
const replacedNodes = voiceResize.audio.nodes.filter(node => node.kind !== 'destination');
voiceResize.resize(true);
assert.equal(voiceResize.api.currentVoicePreset(), voiceResize.api.currentSong().id === 'no-one-noticed' ? 'no-one-noticed' : 'classic');
assert.ok(replacedNodes.every(node => node.disconnected), 'Phone restriction also releases the replaced song graph');

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

// Advance the same monotonic clock used by the waves: no wall-clock sleeps.
const cueResults = [];
for (const song of seed.songs) {
  const { api, clock } = await load(song.id);
  const bpm = song.tempo || 100;
  assert.equal(api.noteTiming().practice, !song.noteBeats);
  for (let i = 0; i < song.notes.length; i++) {
    api.playNextNote();
    const cue = api.noteTiming();
    const duration = (song.noteBeats?.[i] || 1) * 60000 / bpm;
    assert.equal(cue.duration, duration, `${song.id} attack ${i}: correct onset gap`);
    assert.equal(cue.progress, 0);
    assert.equal(cue.phase, 'filling');
    const next = api.peekNextNote();
    const attacks = clock.attacks;
    clock.now = cue.started + duration / 2;
    assert.ok(Math.abs(api.noteTiming().progress - .5) < 1e-10, 'Half full at half the duration');
    clock.now = cue.started + duration - .01;
    assert.equal(api.noteTiming().phase, 'filling', 'Never lands before the due time');
    clock.now = cue.started + duration;
    assert.equal(api.noteTiming().phase, 'landing', 'Lands on the due time');
    assert.equal(api.noteTiming().progress, 1);
    clock.now += 140;
    assert.equal(api.noteTiming().phase, 'waiting', 'One brief landing, then holds still');
    clock.now += 10000;
    assert.equal(api.noteTiming().phase, 'waiting', 'No metronome keeps running after the player stops');
    assert.equal(clock.attacks, attacks, 'The cue never generates audio');
    assert.equal(api.peekNextNote(), next, 'The cue never skips a note');
  }
  assert.equal(api.peekNextNote(), song.notes[0], 'Loop retains the first-note highlight');
  api.pauseNoteTiming();
  assert.equal(api.noteTiming().phase, 'idle');
  assert.equal(api.noteTiming().progress, 0);
  api.playNextNote();
  assert.equal(api.noteTiming().progress, 0, 'Resuming starts a fresh cue');
  const start = api.noteTiming().started;
  clock.now += 60;
  const wrong = api.peekNextNote() === 'C3' ? 'D3' : 'C3';
  api.playNote(wrong);
  assert.equal(api.noteTiming().started, start, 'Free/wrong notes do not restart the song cue');
  api.nextSong();
  assert.equal(api.noteTiming().phase, 'idle', 'A new song clears the previous duration');
  cueResults.push({ id: song.id, bpm, attacks: song.notes.length, practice: !song.noteBeats });
}

const result = { status: 'PASS', songs: songResults, joplinTranscriptions: 'PASS', exactRunaway: 'PASS', mobileAndResize: 'PASS', rotationStateRetention: 'PASS', songCycling: 'PASS', twoColourHighlightSource: 'PASS', tempoCue: cueResults, tempo: { fast, slow, sweep },
  scope: 'Source and simulated audio only; browser layout, real audio and GPU unverified' };
const output = globalThis.process?.env?.PIANO_OUTPUT || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/shared-showcase-20261028/piano';
await mkdir(output, { recursive: true });
await writeFile(`${output}/source-report.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
