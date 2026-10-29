// Synthesised instruments only: every oscillator, hammer transient and room
// impulse is generated locally. This module is also used by the listening tool.
const FLOOR = 0.0001;
const MAX_VOICES = 8;
const RELEASE = .25;
const MASTER_GAIN = .24;
// Chosen from the production OfflineAudioContext baseline: +18.06dB
// matches the normalised grand's peak/RMS to classic without driving its
// compressor harder or changing partials, envelopes, filtering or room balance.
const RUNAWAY_MAKEUP = 8;
const CEILING_RANGE = 16;
function runawayCeilingCurve() {
  const curve = new Float32Array(8193);
  for (let i = 0; i < curve.length; i++) {
    const level = (2 * i / (curve.length - 1) - 1) * CEILING_RANGE;
    const magnitude = Math.abs(level);
    // Exactly linear below .75; smooth and bounded below .98 above it.
    // The existing render x makeup predicts .342 peak, inside the linear part.
    curve[i] = Math.sign(level) * (magnitude <= .75 ? magnitude
      : .75 + .23 * (1 - Math.exp(-(magnitude - .75) / .23)));
  }
  return curve;
}
const PRESETS = {
  // Keep the classic FM/tine/filter tone; trim its bus for the legacy filter's
  // resonance. Its absolute-sum filter bound is <1.75 at 1100-2000 Hz, >=8kHz.
  classic: { peak: .22, attack: .012, dry: 1, wet: 0, room: 0, ratio: 6, trim: 2 / 3, filterBound: 1.75 },
  runaway: { peak: .19, attack: .0025, dry: .92, wet: .22, room: .34, ratio: 2, trim: 1, filterBound: 1 },
  'no-one-noticed': { peak: .18, attack: .035, dry: .78, wet: .52, room: 3.6, ratio: 2, trim: 1, filterBound: 1 },
};
export function voicePresetFor(songId) {
  return songId === 'no-one-noticed' ? songId : 'classic'; // Runaway uses the classic piano (owner).
}

function random(seed) {
  return () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function roomImpulse(context, seconds) {
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const noise = random(seconds < 1 ? 1831 : 7263);
  // Scattered, dark reflection clusters. Unlike browser RMS normalisation,
  // an absolute-sum bound gives a known peak gain, including long release tails.
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const reflections = seconds < 1 ? 64 : 240;
    for (let i = 0; i < reflections; i++) {
      const time = .012 + (seconds - .015) * ((i + noise()) / reflections) ** 1.35;
      const index = Math.min(data.length - 3, Math.floor(time * context.sampleRate));
      const level = (noise() < .5 ? -1 : 1) * Math.exp(-time / seconds * (seconds < 1 ? 6 : 3.7));
      data[index] += level * .25;
      data[index + 1] += level * .5;
      data[index + 2] += level * .25;
    }
    const total = data.reduce((sum, value) => sum + Math.abs(value), 0);
    for (let i = 0; i < data.length; i++) data[i] *= .999 / Math.max(1, total);
  }
  return buffer;
}

function hammerNoise(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .025), context.sampleRate);
  const noise = random(4051);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = noise() * 2 - 1;
  return buffer;
}

export function createPianoSynth(context, destination = context.destination, { preCompressorTap = null } = {}) {
  let preset = 'classic';
  let graph = null;
  let noiseBuffer = null;
  const voices = [];
  const tails = new Set();
  let notesStarted = 0;

  function effects() {
    if (graph) return graph;
    const settings = PRESETS[preset];
    const input = context.createGain();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const nodes = [input, master, compressor];
    master.gain.setValueAtTime(MASTER_GAIN * settings.trim, context.currentTime);
    compressor.threshold.setValueAtTime(-18, context.currentTime);
    compressor.knee.setValueAtTime(18, context.currentTime);
    compressor.ratio.setValueAtTime(settings.ratio, context.currentTime);
    compressor.attack.setValueAtTime(.003, context.currentTime);
    compressor.release.setValueAtTime(.2, context.currentTime);
    master.connect(compressor);
    if (preCompressorTap) master.connect(preCompressorTap);
    let ceiling = null;
    if (preset === 'runaway') {
      const makeup = context.createGain();
      const range = context.createGain();
      ceiling = context.createWaveShaper();
      makeup.gain.setValueAtTime(RUNAWAY_MAKEUP, context.currentTime);
      // Expand the shaper's [-1,1] input domain to +/-16 so overload protection
      // bends smoothly rather than hard-clipping at the shaper input boundary.
      range.gain.setValueAtTime(1 / CEILING_RANGE, context.currentTime);
      ceiling.curve = runawayCeilingCurve();
      ceiling.oversample = 'none'; // No resampling overshoot or extra latency.
      compressor.connect(makeup); makeup.connect(range); range.connect(ceiling); ceiling.connect(destination);
      nodes.push(makeup, range, ceiling);
    } else compressor.connect(destination);
    let convolver = null;
    if (!settings.room) input.connect(master);
    else {
      const dry = context.createGain();
      const send = context.createGain();
      const dark = context.createBiquadFilter();
      const wet = context.createGain();
      convolver = context.createConvolver();
      convolver.normalize = false;
      convolver.buffer = roomImpulse(context, settings.room);
      // A mono send prevents stereo cross-feed from doubling the IR peak bound.
      send.channelCount = 1;
      send.channelCountMode = 'explicit';
      dry.gain.setValueAtTime(settings.dry, context.currentTime);
      wet.gain.setValueAtTime(settings.wet, context.currentTime);
      dark.type = 'lowpass';
      dark.frequency.setValueAtTime(Math.min(context.sampleRate * .24, preset === 'runaway' ? 2600 : 1400), context.currentTime);
      dark.Q.setValueAtTime(-6.1, context.currentTime);
      input.connect(dry); dry.connect(master);
      input.connect(send); send.connect(convolver); convolver.connect(dark); dark.connect(wet); wet.connect(master);
      nodes.push(dry, send, convolver, dark, wet);
    }
    graph = { input, master, compressor, convolver, ceiling, nodes };
    return graph;
  }

  function stop() {
    for (const voice of new Set([...voices, ...tails])) voice.stop();
    if (graph) {
      for (const node of graph.nodes) node.disconnect();
      if (graph.convolver) graph.convolver.buffer = null;
      if (graph.ceiling) graph.ceiling.curve = null;
      graph = null;
    }
    noiseBuffer = null;
  }

  function select(id) {
    stop();
    preset = PRESETS[id] ? id : 'classic';
  }

  function play(frequency) {
    const bus = effects();
    const settings = PRESETS[preset];
    const now = context.currentTime;
    const nodes = [];
    const sources = [];
    const own = node => { nodes.push(node); return node; };
    const oscillator = () => { const node = own(context.createOscillator()); node.type = 'sine'; sources.push(node); return node; };
    const gain = () => own(context.createGain());
    const filter = own(context.createBiquadFilter());
    const envelope = gain();
    const panner = own(context.createStereoPanner());
    filter.type = 'lowpass';
    // Web Audio lowpass Q is in dB: -6.1 is below critical damping. Keep the
    // classic .4dB setting unchanged and account for its resonance separately.
    filter.Q.setValueAtTime(preset === 'classic' ? .4 : -6.1, now);
    filter.connect(envelope);
    let decay;
    let end;
    let sentinel;
    if (preset === 'runaway') {
      decay = 2.8 * (440 / frequency) ** .15;
      end = now + settings.attack + decay;
      filter.frequency.setValueAtTime(Math.min(context.sampleRate * .24, 11000, Math.max(2800, frequency * 6)), now);
      // Absolute partial weights total .98; the bounded hammer noise adds .02.
      const weights = [.49, .22, .12, .07, .04, .025, .015];
      const decays = [decay, .65, .35, .2, .14, .11, .085];
      weights.forEach((weight, i) => {
        const partial = oscillator();
        const level = gain();
        const harmonic = i + 1;
        const stretch = harmonic * Math.sqrt((1 + .00035 * harmonic * harmonic) / 1.00035);
        partial.frequency.setValueAtTime(Math.min(context.sampleRate * .45, frequency * stretch), now);
        level.gain.setValueAtTime(FLOOR, now);
        level.gain.linearRampToValueAtTime(weight, now + settings.attack);
        if (i === 0) level.gain.exponentialRampToValueAtTime(weight * .28, now + .17);
        level.gain.exponentialRampToValueAtTime(FLOOR, now + settings.attack + decays[i]);
        partial.connect(level); level.connect(filter);
        if (i === 0) sentinel = partial;
      });
      const hammer = own(context.createBufferSource());
      sources.push(hammer);
      hammer.buffer = noiseBuffer ||= hammerNoise(context);
      const click = gain();
      click.gain.setValueAtTime(.02, now);
      click.gain.exponentialRampToValueAtTime(FLOOR, now + .012);
      hammer.connect(click); click.connect(filter);
      envelope.gain.setValueAtTime(settings.peak, now);
      panner.pan.setValueAtTime(0, now); // Close, centred grand; no electric-piano modulation.
      envelope.connect(panner);
    } else {
      const dreamy = preset === 'no-one-noticed';
      decay = (dreamy ? 3.4 : 1.6) * (440 / frequency) ** .15;
      end = now + settings.attack + decay;
      const carrier = oscillator();
      const modulator = oscillator();
      const tine = oscillator();
      const shimmer = oscillator();
      sentinel = carrier;
      const modulation = gain();
      const bark = gain();
      const tremolo = gain();
      const tremoloDepth = gain();
      const panDepth = gain();
      const warmth = Math.min(1, (330 / frequency) ** .6);
      carrier.frequency.setValueAtTime(frequency, now);
      modulator.frequency.setValueAtTime(frequency, now);
      modulation.gain.setValueAtTime(frequency * (dreamy ? .55 : 1.3) * warmth, now);
      modulation.gain.exponentialRampToValueAtTime(frequency * (dreamy ? .04 : .12) * warmth, now + (dreamy ? .7 : .35));
      modulator.connect(modulation); modulation.connect(carrier.frequency);
      tine.frequency.setValueAtTime(frequency * 7, now);
      bark.gain.setValueAtTime(frequency * (dreamy ? .015 : .04) * warmth, now);
      bark.gain.exponentialRampToValueAtTime(frequency * .0001, now + (dreamy ? .07 : .04));
      tine.connect(bark); bark.connect(carrier.frequency);
      filter.frequency.setValueAtTime(dreamy ? Math.min(context.sampleRate * .24, 1900, Math.max(800, frequency * 2.3))
        : Math.min(2000, Math.max(1100, frequency * 3)), now);
      envelope.gain.setValueAtTime(FLOOR, now);
      envelope.gain.linearRampToValueAtTime(settings.peak, now + settings.attack);
      envelope.gain.exponentialRampToValueAtTime(FLOOR, end);
      shimmer.frequency.setValueAtTime(dreamy ? 4.2 : 4.5, now);
      tremolo.gain.setValueAtTime(dreamy ? .92 : .94, now);
      tremoloDepth.gain.setValueAtTime(dreamy ? .045 : .05, now);
      panner.pan.setValueAtTime(0, now);
      panDepth.gain.setValueAtTime(dreamy ? .14 : .12, now);
      shimmer.connect(tremoloDepth); tremoloDepth.connect(tremolo.gain);
      shimmer.connect(panDepth); panDepth.connect(panner.pan);
      if (dreamy) {
        const wow = oscillator();
        const wowDepth = gain();
        wow.frequency.setValueAtTime(.17, now);
        wowDepth.gain.setValueAtTime(2.8, now); // Cents, not a second audible pitch.
        wow.connect(wowDepth);
        wowDepth.connect(carrier.detune); wowDepth.connect(modulator.detune);
      }
      carrier.connect(filter); envelope.connect(tremolo); tremolo.connect(panner);
    }
    panner.connect(bus.input);
    let finished = false;
    const voice = {
      end,
      finish() {
        if (finished) return;
        finished = true;
        const index = voices.indexOf(voice);
        if (index !== -1) voices.splice(index, 1);
        tails.delete(voice);
        for (const source of sources) {
          source.onended = null;
          try { source.stop(); } catch (_) { /* Already ended. */ }
        }
        for (const node of nodes) node.disconnect();
      },
      stop() { voice.finish(); },
      release() {
        const at = context.currentTime;
        const elapsed = Math.max(0, at - now);
        const level = preset === 'runaway' ? settings.peak : elapsed < settings.attack
          ? FLOOR + (settings.peak - FLOOR) * elapsed / settings.attack
          : settings.peak * (FLOOR / settings.peak) ** Math.min(1, (elapsed - settings.attack) / decay);
        envelope.gain.cancelScheduledValues(at);
        envelope.gain.setValueAtTime(Math.max(FLOOR, level), at);
        envelope.gain.exponentialRampToValueAtTime(FLOOR, at + RELEASE);
        for (const source of sources) source.stop(at + RELEASE);
        tails.add(voice);
      },
    };
    if (voices.length === MAX_VOICES) {
      if (tails.size === MAX_VOICES) tails.values().next().value.stop();
      voices.shift().release();
    }
    voices.push(voice);
    sentinel.onended = () => voice.finish();
    try {
      for (const source of sources) { source.start(now); source.stop(end + .02); }
      notesStarted++;
    } catch (error) {
      voice.finish();
      throw error;
    }
  }

  return { play, select, stop, dispose: stop,
    isPlaying: () => voices.length > 0 || tails.size > 0,
    state: () => ({ preset, voices: voices.length, tails: tails.size, notesStarted,
      effects: Boolean(graph),
      // Includes eight releases at their full peak, the complete wet IR bound,
      // and phase-coherent partials/noise. The compressor is AFTER this point.
      peakBound: MAX_VOICES * 2 * PRESETS[preset].peak * MASTER_GAIN * PRESETS[preset].trim
        * PRESETS[preset].filterBound * (PRESETS[preset].dry + PRESETS[preset].wet) }),
  };
}
