// node tests/hero-piano-voices-source.mjs — no browser, audio device or downloads.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createAudioHarness, coherentPeakSampler, lowpassNorm } from './helpers/piano-audio.mjs';
import { assertRenderedVoiceLevels } from './helpers/piano-voice-levels.mjs';
const source = await readFile(new URL('../hero-piano-voices.js', import.meta.url), 'utf8');
const { createPianoSynth, voicePresetFor } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const id of ['entertainer', 'maple-leaf-rag', 'gymnopedie-1']) assert.equal(voicePresetFor(id), 'classic');
assert.equal(voicePresetFor('runaway'), 'classic');
assert.equal(voicePresetFor('no-one-noticed'), 'no-one-noticed');
const results = [];
// Receipts from Claude's first actual OfflineAudioContext renders. The new
// rendered-level gate must reject the original 17dB mismatch and any quiet voice.
const originalLevels = [
  { preset: 'classic', outputPeak: .31173425912857056, rms: .03518626100552823 },
  { preset: 'runaway', outputPeak: .04280500486493111, rms: .004080504921591845 },
  { preset: 'no-one-noticed', outputPeak: .2327990084886551, rms: .032158133757073964 },
];
assert.throws(() => assertRenderedVoiceLevels(originalLevels), /runaway: rendered peak is -17\.25 dB/);
for (const rate of [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000, 192000, 384000]) {
  for (let cutoff = 1100; cutoff <= 2000; cutoff += 25) {
    assert.ok(lowpassNorm(cutoff, .4, rate) < 1.75, 'The preserved classic filter fits its explicit resonance budget');
  }
  for (const cutoff of [800, 1400, 1900, 2600, 11000]) {
    assert.ok(lowpassNorm(Math.min(rate * .24, cutoff), -6.1, rate) < 1.000001, 'New filters have no peak amplification');
  }
}
for (const [preset, sourceCount, peak, dry, wet] of [
  ['classic', 4, .22, 1, 0], ['runaway', 8, .19, .92, .22], ['no-one-noticed', 5, .18, .78, .52],
]) {
  const { AudioContext, metrics } = createAudioHarness();
  const context = new AudioContext();
  const synth = createPianoSynth(context);
  synth.select(preset);
  assert.equal(metrics.nodes.length, 1, 'Importing/selecting creates no live audio graph');
  const sampler = coherentPeakSampler(context, metrics);
  let peakObserved = 0;
  let maxVoices = 0, maxTails = 0;
  // 120 strikes 10ms apart, sampling the scheduled, phase-coherent peak envelope
  // every millisecond. Include both low/high pitches and stolen release tails.
  for (let ms = 0; ms < 1500; ms++) {
    context.advanceTo(ms / 1000);
    if (ms < 1200 && ms % 10 === 0) {
      const before = metrics.starts;
      synth.play(ms % 30 === 0 ? 164.813778 : 1318.510228);
      assert.equal(metrics.starts - before, sourceCount, 'Exactly one complete instrument per strike');
    }
    const state = synth.state();
    assert.ok(state.voices <= 8 && state.tails <= 8, 'Eight voices and at most eight short releases');
    maxVoices = Math.max(maxVoices, state.voices); maxTails = Math.max(maxTails, state.tails);
    peakObserved = Math.max(peakObserved, sampler());
    assert.ok(peakObserved < 1, `${preset}: coherent pre-compressor peak ${peakObserved}`);
  }
  const fullPeakBound = 16 * peak * .24 * (preset === 'classic' ? 2 / 3 : 1)
    * (preset === 'classic' ? 1.75 : 1) * (dry + wet);
  assert.equal(synth.state().peakBound, fullPeakBound);
  assert.ok(fullPeakBound < 1, 'All sixteen sources at full peak, including the complete IR gain, remain under unity');
  assert.ok(peakObserved > .1 && peakObserved <= fullPeakBound, 'The stress simulation measures non-silent graph levels within the analytic bound');
  assert.equal(maxVoices, 8); assert.equal(maxTails, 8);
  const convolver = metrics.nodes.find(node => node.kind === 'convolver');
  if (preset === 'classic') assert.equal(convolver, undefined, 'Other songs retain their dry FM/tine voice');
  else {
    assert.equal(convolver.normalize, false);
    assert.equal(convolver.buffer.numberOfChannels, 2);
    assert.equal(convolver.buffer.duration, preset === 'runaway' ? .34 : 3.6);
    for (let channel = 0; channel < 2; channel++) {
      const norm = convolver.buffer.getChannelData(channel).reduce((sum, value) => sum + Math.abs(value), 0);
      assert.ok(norm > .9 && norm <= 1, 'Generated room impulse has a verified absolute-sum peak bound');
    }
  }
  const oldNodes = metrics.nodes.slice(1);
  const ceiling = metrics.nodes.find(node => node.kind === 'waveshaper');
  if (preset === 'runaway') {
    const compressor = metrics.nodes.find(node => node.kind === 'compressor');
    const makeup = [...compressor.outputs][0];
    const range = [...makeup.outputs][0];
    assert.equal(makeup.gain.at(0), 8, 'Runaway gets post-compressor makeup, preserving its compression/timbre');
    assert.equal(range.gain.at(0), 1 / 16);
    assert.equal([...range.outputs][0], ceiling);
    assert.equal(ceiling.oversample, 'none');
    const curveAt = input => {
      const position = (Math.max(-1, Math.min(1, input)) + 1) * (ceiling.curve.length - 1) / 2;
      const left = Math.floor(position), right = Math.min(left + 1, ceiling.curve.length - 1);
      return ceiling.curve[left] + (ceiling.curve[right] - ceiling.curve[left]) * (position - left);
    };
    const post = sample => curveAt(sample * makeup.gain.at(0) * range.gain.at(0));
    for (let i = -1000; i <= 1000; i++) {
      const sample = i * .75 / (1000 * 8);
      assert.ok(Math.abs(post(sample) - sample * 8) < 1e-7, 'The entire normal level range is exactly a gain change');
      assert.ok(Math.abs(curveAt(i / 1000)) < 1, 'Overload protection never exceeds unity');
    }
    const original = originalLevels.find(voice => voice.preset === preset);
    const predicted = originalLevels.map(voice => voice.preset === preset ? {
      ...voice, outputPeak: post(voice.outputPeak), rms: voice.rms * 8,
    } : voice);
    assertRenderedVoiceLevels(predicted);
    assert.throws(() => assertRenderedVoiceLevels(predicted.map(voice => voice.preset === 'no-one-noticed'
      ? { ...voice, outputPeak: originalLevels[0].outputPeak * 10 ** (-3.01 / 20) } : voice)), /no-one-noticed: rendered peak/,
      'The 3dB rendered gate applies to every voice');
    assert.ok(post(original.outputPeak) < .75, 'The measured preview never engages the safety bend');
  } else assert.equal(ceiling, undefined, 'Other voices have no added output processing');
  synth.select(preset === 'runaway' ? 'no-one-noticed' : 'runaway');
  assert.equal(synth.isPlaying(), false, 'Selection silences all voices/releases');
  assert.equal(synth.state().effects, false, 'Selection does not create sound or a new effects graph');
  assert.ok(oldNodes.every(node => node.disconnected && node.outputs.size === 0), 'Every old note, compressor and reverb connection is released');
  assert.ok(oldNodes.filter(node => node.started !== undefined).every(node => node.stopped <= context.currentTime && node.onended === null), 'Every old source and callback is stopped');
  if (convolver) assert.equal(convolver.buffer, null, 'The generated impulse is released');
  if (ceiling) assert.equal(ceiling.curve, null, 'The output ceiling curve is released');
  const beforeNew = metrics.starts;
  synth.play(440);
  assert.equal(metrics.starts - beforeNew, preset === 'runaway' ? 5 : 8, 'The very next attack uses the selected voice');
  synth.stop();
  synth.stop();
  assert.ok(metrics.nodes.slice(1).every(node => node.disconnected), 'Repeated stop/dispose leaves no connected graph');
  synth.play(440);
  context.advanceTo(context.currentTime + 10);
  assert.equal(synth.isPlaying(), false, 'Natural endings release note graphs without waiting for a song change');
  const noteNodes = metrics.nodes.filter(node => node.started !== undefined);
  assert.ok(noteNodes.every(node => node.disconnected), 'Naturally ended oscillators and noise sources are disconnected');
  synth.dispose();
  assert.ok(metrics.nodes.slice(1).every(node => node.disconnected), 'Full teardown also releases the lingering effects graph');
  results.push({ preset, coherentEnvelopePeak: peakObserved, allVoicesAtPeakBound: fullPeakBound, maxVoices, maxTails, graphTeardown: 'PASS' });
}
const output = process.env.PIANO_OUTPUT || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/final-pass-20261028/piano-voices';
await mkdir(output, { recursive: true });
await writeFile(`${output}/source-voices-report.json`, JSON.stringify({ status: 'PASS', results,
  scope: 'Scheduled graph and conservative peak-envelope simulation. Actual audio/listening requires OfflineAudioContext.' }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
