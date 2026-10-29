// A scheduled Web Audio test double. It records the real graph and automation;
// it does not claim to replace listening or OfflineAudioContext rendering.
export function createAudioHarness({ sampleRate = 8000, onStart = () => {} } = {}) {
  const metrics = { contexts: 0, starts: 0, nodes: [], buffers: [], instances: [] };
  class Parameter {
    constructor(value = 0) { this.value = value; this.events = []; this.inputs = new Set(); }
    setValueAtTime(value, at) { this.events.push({ type: 'set', value, at }); return this; }
    linearRampToValueAtTime(value, at) { this.events.push({ type: 'linear', value, at }); return this; }
    exponentialRampToValueAtTime(value, at) { this.events.push({ type: 'exponential', value, at }); return this; }
    cancelScheduledValues(at) { this.events = this.events.filter(event => event.at < at); return this; }
    at(time) {
      let previous = { value: this.value, at: 0 };
      for (const event of this.events) {
        if (event.at > time) {
          if (event.type === 'set' || event.at === previous.at) return previous.value;
          const t = Math.max(0, (time - previous.at) / (event.at - previous.at));
          return event.type === 'linear' ? previous.value + t * (event.value - previous.value)
            : previous.value * (event.value / previous.value) ** t;
        }
        previous = event;
      }
      return previous.value;
    }
  }
  class Node {
    constructor(context, kind) {
      Object.assign(this, { context, kind, inputs: new Set(), outputs: new Set(), disconnected: false });
      for (const name of ['frequency', 'detune', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Parameter();
      this.gain = new Parameter(1);
      metrics.nodes.push(this);
    }
    connect(node) { this.outputs.add(node); node.inputs.add(this); return node; }
    disconnect() {
      this.disconnected = true;
      for (const node of this.outputs) node.inputs.delete(this);
      this.outputs.clear();
    }
    start(at = 0) { this.started = at; metrics.starts++; onStart(this); }
    stop(at = this.context.currentTime) { this.stopped = at; }
  }
  class AudioContext {
    constructor() {
      metrics.contexts++;
      metrics.instances.push(this);
      this.state = 'running'; this.currentTime = 0; this.sampleRate = sampleRate;
      this.destination = new Node(this, 'destination');
    }
    createGain() { return new Node(this, 'gain'); }
    createOscillator() { return new Node(this, 'oscillator'); }
    createBufferSource() { return new Node(this, 'buffer-source'); }
    createBiquadFilter() { return new Node(this, 'filter'); }
    createStereoPanner() { return new Node(this, 'panner'); }
    createDynamicsCompressor() { return new Node(this, 'compressor'); }
    createConvolver() { return new Node(this, 'convolver'); }
    createWaveShaper() { return new Node(this, 'waveshaper'); }
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: channel => data[channel] };
      metrics.buffers.push(buffer);
      return buffer;
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    advanceTo(at) {
      this.currentTime = at;
      for (const source of metrics.nodes.filter(node => node.context === this && node.started !== undefined && !node.ended)) {
        const end = Math.min(source.stopped ?? Infinity, source.kind === 'buffer-source' ? source.started + source.buffer.duration : Infinity);
        if (end <= at) { source.ended = true; source.onended?.(); }
      }
    }
  }
  return { AudioContext, metrics };
}

// Peak envelopes, with every audible oscillator/noise source phase-aligned.
// The convolution branch uses the full absolute-sum IR norm and the entire
// preceding send peak, which is deliberately stricter than a typical waveform.
// W3C Web Audio biquad coefficients, including lowpass Q in decibels:
// https://www.w3.org/TR/webaudio-1.1/#filters-characteristics
export function lowpassNorm(frequency, qDb, rate) {
  const w = 2 * Math.PI * Math.min(frequency, rate / 2) / rate;
  const alpha = Math.sin(w) / (2 * 10 ** (qDb / 20));
  const a0 = 1 + alpha, a1 = -2 * Math.cos(w) / a0, a2 = (1 - alpha) / a0;
  const b0 = (1 - Math.cos(w)) / (2 * a0), b1 = 2 * b0, b2 = b0;
  let y1 = 0, y2 = 0, total = 0;
  for (let i = 0; i < 20000; i++) {
    const y = (i === 0 ? b0 : i === 1 ? b1 : i === 2 ? b2 : 0) - a1 * y1 - a2 * y2;
    total += Math.abs(y); y2 = y1; y1 = y;
  }
  return total;
}

export function coherentPeakSampler(context, metrics) {
  const wetHistory = new Map();
  const filterHistory = new Map();
  const filterNorms = new Map();
  const impulseNorms = new Map();
  const input = (node, at, seen) => [...node.inputs].reduce((sum, from) => sum + bound(from, at, seen), 0);
  function bound(node, at, seen = new Set()) {
    if (seen.has(node)) throw new Error('Unexpected feedback in piano graph');
    const path = new Set([...seen, node]);
    if (node.kind === 'oscillator' || node.kind === 'buffer-source') {
      if (node.started === undefined || at < node.started || at >= (node.stopped ?? Infinity)) return 0;
      if (node.kind === 'buffer-source' && at >= node.started + node.buffer.duration) return 0;
      return 1;
    }
    if (node.kind === 'gain') {
      const modulation = [...node.gain.inputs].reduce((sum, from) => sum + bound(from, at, path), 0);
      return input(node, at, path) * (Math.abs(node.gain.at(at)) + modulation);
    }
    if (node.kind === 'convolver') {
      if (node.normalize !== false) throw new Error('Unbounded browser impulse normalisation');
      const peak = Math.max(wetHistory.get(node) || 0, input(node, at, path));
      wetHistory.set(node, peak);
      let norm = impulseNorms.get(node.buffer);
      if (norm === undefined) {
        norm = 0;
        for (let channel = 0; channel < node.buffer.numberOfChannels; channel++) {
          norm = Math.max(norm, node.buffer.getChannelData(channel).reduce((sum, value) => sum + Math.abs(value), 0));
        }
        impulseNorms.set(node.buffer, norm);
      }
      return peak * norm;
    }
    if (node.kind === 'filter') {
      if (node.type !== 'lowpass') throw new Error('Filter peak gain needs a new bound');
      const key = `${node.frequency.at(at)},${node.Q.at(at)},${context.sampleRate}`;
      if (!filterNorms.has(key)) filterNorms.set(key, lowpassNorm(node.frequency.at(at), node.Q.at(at), context.sampleRate));
      const peak = Math.max(filterHistory.get(node) || 0, input(node, at, path));
      filterHistory.set(node, peak);
      return peak * filterNorms.get(key);
    }
    return input(node, at, path);
  }
  return () => {
    const compressor = metrics.nodes.findLast(node => node.context === context && node.kind === 'compressor' && !node.disconnected);
    return compressor ? input(compressor, context.currentTime, new Set()) : 0;
  };
}
