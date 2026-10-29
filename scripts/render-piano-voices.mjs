// With this worktree served on 4205: node scripts/render-piano-voices.mjs
// Uses the production synth in OfflineAudioContext, with no recorded audio.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { assertRenderedVoiceLevels } from '../tests/helpers/piano-voice-levels.mjs';
const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(pathToFileURL(require.resolve(process.env.PUPPETEER_MODULE
  || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/website/node_modules/puppeteer-core')));
const base = process.env.BASE_URL || 'http://127.0.0.1:4205';
const output = process.env.PIANO_OUTPUT || '/Users/joshuagordonjones/Documents/ChatGPT/Toucan Learn/outputs/final-pass-20261028/piano-voices';
const pianoSource = await readFile(new URL('../hero-piano.js', import.meta.url), 'utf8');
const moduleURL = new URL(pianoSource.match(/from '(\.\/hero-piano-voices\.js[^']*)'/)[1], `${base}/index.html`).href;
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-sandbox'] });
const report = { status: 'PASS', sampleRate: 44100, seconds: 14,
  listening: 'Opening motif, then a 48-note rapid repetition stress burst at 5s. Synthesised only; no comparison recording used.', voices: [] };
try {
  const page = await browser.newPage();
  await page.goto(`${base}/index.html?project=piano&sky=pixel`, { waitUntil: 'networkidle0' });
  for (const preset of ['classic', 'runaway', 'no-one-noticed']) {
    const result = await page.evaluate(async ({ moduleURL, preset }) => {
      const { createPianoSynth } = await import(moduleURL);
      const rate = 44100;
      const context = new OfflineAudioContext(4, rate * 14, rate);
      // Stereo listening mix on 0/1, simultaneous pre-compressor meter on 2/3.
      const merger = context.createChannelMerger(4);
      const post = context.createChannelSplitter(2);
      const pre = context.createChannelSplitter(2);
      post.connect(merger, 0, 0); post.connect(merger, 1, 1);
      pre.connect(merger, 0, 2); pre.connect(merger, 1, 3);
      merger.connect(context.destination);
      const synth = createPianoSynth(context, post, { preCompressorTap: pre });
      synth.select(preset);
      const motif = preset === 'runaway' ? [88, 88, 88, 76, 87, 87, 87, 75]
        : preset === 'no-one-noticed' ? [67, 66, 60, 67, 66, 59, 60, 62] : [60, 64, 67, 72, 71, 67, 64, 60];
      const notes = motif.map((midi, i) => ({ at: .1 + i * .45, midi }));
      for (let i = 0; i < 48; i++) notes.push({ at: 5 + i * .012, midi: preset === 'runaway' ? 88 : 60 });
      // Suspending the offline clock drives the actual voice pool and stealing,
      // rather than scheduling future voices that are not alive yet.
      const strikes = notes.map(note => context.suspend(note.at).then(async () => {
        synth.play(440 * 2 ** ((note.midi - 69) / 12));
        const state = synth.state();
        if (state.voices > 8 || state.tails > 8) throw new Error('Voice pool overflow');
        await context.resume();
      }));
      const rendered = context.startRendering();
      const [buffer] = await Promise.all([rendered, Promise.all(strikes)]);
      const stereo = [buffer.getChannelData(0), buffer.getChannelData(1)];
      let outputPeak = 0, preCompressorPeak = 0, square = 0, tailSquare = 0;
      for (let channel = 0; channel < 4; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          if (!Number.isFinite(data[i])) throw new Error('Non-finite rendered audio');
          if (channel < 2) {
            outputPeak = Math.max(outputPeak, Math.abs(data[i])); square += data[i] ** 2;
            if (i >= rate * 9) tailSquare += data[i] ** 2;
          } else preCompressorPeak = Math.max(preCompressorPeak, Math.abs(data[i]));
        }
      }
      if (outputPeak >= 1 || preCompressorPeak >= 1) throw new Error(`Clipping: output=${outputPeak}, pre-compressor=${preCompressorPeak}`);
      if (outputPeak < .001) throw new Error('Unexpectedly silent instrument');
      const wav = new ArrayBuffer(44 + buffer.length * 4);
      const view = new DataView(wav);
      const text = (at, value) => [...value].forEach((letter, i) => view.setUint8(at + i, letter.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, wav.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, wav.byteLength - 44, true);
      for (let i = 0; i < buffer.length; i++) for (let channel = 0; channel < 2; channel++) {
        view.setInt16(44 + i * 4 + channel * 2, Math.round(stereo[channel][i] * 32767), true);
      }
      let binary = '';
      const bytes = new Uint8Array(wav);
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      synth.dispose();
      post.disconnect(); pre.disconnect(); merger.disconnect();
      return { pcm: btoa(binary), outputPeak, preCompressorPeak,
        rms: Math.sqrt(square / (buffer.length * 2)), tailRmsAfter9s: Math.sqrt(tailSquare / (rate * 5 * 2)),
        notes: notes.length, voicePeakBound: synth.state().peakBound };
    }, { moduleURL, preset });
    const { pcm, ...levels } = result;
    assert.ok(levels.outputPeak < 1 && levels.preCompressorPeak < 1);
    const file = `${preset}.wav`;
    await writeFile(`${output}/${file}`, Buffer.from(pcm, 'base64'));
    report.voices.push({ preset, file, ...levels });
    console.log(`PASS ${preset}: pre-compressor peak=${levels.preCompressorPeak.toFixed(5)}, output peak=${levels.outputPeak.toFixed(5)}; ${output}/${file}`);
  }
  report.relativeLevels = assertRenderedVoiceLevels(report.voices);
  console.log('PASS rendered loudness: all peaks within 3 dB below classic; Runaway peak and RMS within 2 dB.');
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error.stack || error); throw error;
} finally {
  await writeFile(`${output}/offline-voices-report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
