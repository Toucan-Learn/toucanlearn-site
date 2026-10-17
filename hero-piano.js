import { songs } from './hero-songs.js?v=20261017-songs-1';

// One fresh choice per page load, independent of the sky. The query parameter
// is a listening/test override; unknown ids use the same random selection.
const requestedSong = new URLSearchParams(globalThis.location?.search || '').get('song');
const song = songs.find(candidate => candidate.id === requestedSong)
  || songs[Math.floor(Math.random() * songs.length)];
const MELODY = song.notes;

const MAX_VOICES = 8;
const FLOOR = 0.0001;
const PEAK = 0.24;
const ATTACK = 0.005;
const RELEASE = 0.25;
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
let audio = null;
let master = null;
let nextNote = 0;
const voices = [];
const tails = new Set();

function frequencyFor(note) {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
  const midi = (Number(octave) + 1) * 12 + SEMITONES[letter] + (sharp ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

function soundNote(frequency) {
  const now = audio.currentTime;
  const decay = 1.6 * (440 / frequency) ** 0.15;
  const end = now + ATTACK + decay;
  const carrier = audio.createOscillator();
  const modulator = audio.createOscillator();
  const tine = audio.createOscillator();
  const shimmer = audio.createOscillator();
  const modulation = audio.createGain();
  const bark = audio.createGain();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  const tremolo = audio.createGain();
  const tremoloDepth = audio.createGain();
  const panner = audio.createStereoPanner();
  const panDepth = audio.createGain();
  const oscillators = [carrier, modulator, tine, shimmer];
  const nodes = [...oscillators, modulation, bark, filter, envelope, tremolo, tremoloDepth, panner, panDepth];

  // Sine-on-sine FM: a bell-like attack settles into a mellow fundamental.
  oscillators.forEach(oscillator => { oscillator.type = 'sine'; });
  carrier.frequency.setValueAtTime(frequency, now);
  modulator.frequency.setValueAtTime(frequency, now);
  modulation.gain.setValueAtTime(frequency * 2.5, now);
  modulation.gain.exponentialRampToValueAtTime(frequency * 0.3, now + 0.4);
  modulator.connect(modulation);
  modulation.connect(carrier.frequency);

  // A quiet 14x tine modulator adds a short bark, gone within 60 ms.
  tine.frequency.setValueAtTime(frequency * 14, now);
  bark.gain.setValueAtTime(frequency * 0.18, now);
  bark.gain.exponentialRampToValueAtTime(frequency * 0.0001, now + 0.06);
  tine.connect(bark);
  bark.connect(carrier.frequency);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.Q.setValueAtTime(0.5, now);
  envelope.gain.setValueAtTime(FLOOR, now);
  envelope.gain.linearRampToValueAtTime(PEAK, now + ATTACK);
  envelope.gain.exponentialRampToValueAtTime(FLOOR, end);

  // Shallow tremolo and stereo auto-pan, freed with this note's other nodes.
  shimmer.frequency.setValueAtTime(4.5, now);
  tremolo.gain.setValueAtTime(0.94, now);
  tremoloDepth.gain.setValueAtTime(0.05, now);
  panner.pan.setValueAtTime(0, now);
  panDepth.gain.setValueAtTime(0.12, now);
  shimmer.connect(tremoloDepth);
  tremoloDepth.connect(tremolo.gain);
  shimmer.connect(panDepth);
  panDepth.connect(panner.pan);
  carrier.connect(filter);
  filter.connect(envelope);
  envelope.connect(tremolo);
  tremolo.connect(panner);
  panner.connect(master);

  const voice = {
    finish() {
      const index = voices.indexOf(voice);
      if (index !== -1) voices.splice(index, 1);
      tails.delete(voice);
      carrier.onended = null;
      nodes.forEach(node => node.disconnect());
    },
    release() {
      const at = audio.currentTime;
      // Preserve the scheduled envelope's current level without relying on
      // cancelAndHoldAtTime, which is unavailable in some browsers.
      const elapsed = Math.max(0, at - now);
      const level = elapsed < ATTACK
        ? FLOOR + (PEAK - FLOOR) * elapsed / ATTACK
        : PEAK * (FLOOR / PEAK) ** Math.min(1, (elapsed - ATTACK) / decay);
      envelope.gain.cancelScheduledValues(at);
      envelope.gain.setValueAtTime(Math.max(FLOOR, level), at);
      envelope.gain.exponentialRampToValueAtTime(FLOOR, at + RELEASE);
      oscillators.forEach(oscillator => oscillator.stop(at + RELEASE));
      tails.add(voice);
    },
  };
  // Eight held voices; also bound the short release tails during rapid clicks.
  // Even all sixteen at peak stay below unity before the master compressor.
  if (voices.length === MAX_VOICES) {
    if (tails.size === MAX_VOICES) {
      const oldestTail = tails.values().next().value;
      oldestTail.finish();
      // Disconnect immediately; its already-scheduled stop still frees sources.
    }
    voices.shift().release();
  }
  voices.push(voice);
  carrier.onended = () => voice.finish();
  oscillators.forEach(oscillator => { oscillator.start(now); oscillator.stop(end + 0.02); });
}

// Gesture entry point: called ONLY from the hero button's native click handler
// (mouse, tap, Enter or Space). Importing this module never creates audio.
export function playNextNote() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return;
  try {
    if (!audio) {
      audio = new AudioContext();
      master = audio.createGain();
      const compressor = audio.createDynamicsCompressor();
      master.gain.setValueAtTime(0.24, audio.currentTime);
      compressor.threshold.setValueAtTime(-18, audio.currentTime);
      compressor.knee.setValueAtTime(18, audio.currentTime);
      compressor.ratio.setValueAtTime(6, audio.currentTime);
      compressor.attack.setValueAtTime(0.003, audio.currentTime);
      compressor.release.setValueAtTime(0.2, audio.currentTime);
      master.connect(compressor);
      compressor.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    if (audio.state === 'closed') return;
    soundNote(frequencyFor(MELODY[nextNote]));
    nextNote = (nextNote + 1) % MELODY.length;
  } catch {
    // Audio support/device failures must never interfere with the hero's waves.
  }
}
