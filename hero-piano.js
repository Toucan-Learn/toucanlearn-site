import { songs } from './hero-songs.js?v=20261028-piano-5';

// One fresh choice per page load, independent of the sky. The query parameter
// is a listening/test override; unknown ids use the same random selection.
const requestedSong = new URLSearchParams(globalThis.location?.search || '').get('song');
const phonePortrait = globalThis.matchMedia?.('(max-width: 600px) and (orientation: portrait)');
const PHONE_SONGS = new Set(['runaway', 'no-one-noticed']);
export function availableSongs() {
  return phonePortrait?.matches ? songs.filter(candidate => PHONE_SONGS.has(candidate.id)) : songs;
}
const chooseSong = () => {
  const choices = availableSongs();
  return choices.find(candidate => candidate.id === requestedSong)
    || choices[Math.floor(Math.random() * choices.length)];
};
let song = chooseSong();
export function currentSong() { return song; }

const MAX_VOICES = 8;
const FLOOR = 0.0001;
const PEAK = 0.22;
const ATTACK = 0.012;
const RELEASE = 0.25;
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
let audio = null;
let master = null;
let nextNote = 0;
const voices = [];
const tails = new Set();
const listeners = new Set();
let lastNoteTime = null;
let wavePosition = .5;
let cueStarted = null;
let cueDuration = 0;
const PRACTICE_TEMPO = 100;
const LANDING_MS = 140;

// The wave and cue share performance.now(), but retain their different jobs:
// waves respond to actual gestures; the cue guides the next song attack.
// Only No One Noticed has a saved rhythm. Other songs use an explicit practice
// pulse, rather than claiming that equal beats reproduce their score.
export function noteTiming() {
  const bpm = song.tempo || PRACTICE_TEMPO;
  const duration = cueDuration || 60000 / bpm;
  const now = performance.now();
  const due = cueStarted === null ? null : cueStarted + duration;
  const phase = due === null ? 'idle' : now < due ? 'filling'
    : now < due + LANDING_MS ? 'landing' : 'waiting';
  return { bpm, practice: !song.noteBeats, duration, started: cueStarted, due, phase,
    progress: due === null ? 0 : now >= due ? 1 : Math.max(0, (now - cueStarted) / duration) };
}

export function pauseNoteTiming() { cueStarted = null; cueDuration = 0; }

// Screen coordinates: small y is high. A long pause starts a fresh phrase.
function recordNoteTiming() {
  const now = performance.now();
  const interval = lastNoteTime === null ? Infinity : now - lastNoteTime;
  lastNoteTime = now;
  if (interval >= 2400) { wavePosition = .5; return; }
  const t = Math.max(0, Math.min(1, (interval - 150) / 1050));
  const target = .18 + .64 * t * t * (3 - 2 * t);
  wavePosition += (target - wavePosition) * .8;
}
export function noteWavePosition() { return wavePosition; }

export function peekNextNote(offset = 0) { return song.notes[(nextNote + offset) % song.notes.length]; }

// Round 87 (Joshua: "just change the keyboard if this song comes up"): a song can move
// the keyboard up an octave so its high notes have keys (Runaway's high E6).
export function songKeyboardOctave() { return Number.isInteger(song.keyboardOctave) ? song.keyboardOctave : 0; }

export function onSongAdvance(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function selectSong(candidate) {
  song = candidate;
  nextNote = 0;
  lastNoteTime = null;
  wavePosition = .5;
  pauseNoteTiming();
  listeners.forEach(listener => listener(peekNextNote()));
}

// Selection is silent, just like opening the piano. Phone choices stay local.
export function nextSong() {
  const choices = availableSongs();
  selectSong(choices[(choices.indexOf(song) + 1) % choices.length]);
  return song;
}

export function advance() {
  // Duration belongs to the attack just played, including any following rest.
  cueDuration = (song.noteBeats?.[nextNote] || 1) * 60000 / (song.tempo || PRACTICE_TEMPO);
  cueStarted = performance.now();
  nextNote = (nextNote + 1) % song.notes.length;
  listeners.forEach(listener => listener(peekNextNote()));
}

// Rotation/resizing also applies the phone restriction to an already open piano.
phonePortrait?.addEventListener('change', () => {
  if (!availableSongs().includes(song)) {
    selectSong(chooseSong());
    return;
  }
  listeners.forEach(listener => listener(peekNextNote()));
});

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

  // Sine-on-sine FM: a soft bell-like attack settles into a warm fundamental.
  // Joshua, 17 Oct 2026 ("too shrill"): gentler modulation, and less of it
  // the higher the note, so upper notes stay round instead of piercing.
  const warmth = Math.min(1, (330 / frequency) ** 0.6);
  oscillators.forEach(oscillator => { oscillator.type = 'sine'; });
  carrier.frequency.setValueAtTime(frequency, now);
  modulator.frequency.setValueAtTime(frequency, now);
  modulation.gain.setValueAtTime(frequency * 1.3 * warmth, now);
  modulation.gain.exponentialRampToValueAtTime(frequency * 0.12 * warmth, now + 0.35);
  modulator.connect(modulation);
  modulation.connect(carrier.frequency);

  // A very quiet 7x tine modulator adds a hint of key strike, gone within 40 ms.
  tine.frequency.setValueAtTime(frequency * 7, now);
  bark.gain.setValueAtTime(frequency * 0.04 * warmth, now);
  bark.gain.exponentialRampToValueAtTime(frequency * 0.0001, now + 0.04);
  tine.connect(bark);
  bark.connect(carrier.frequency);
  filter.type = 'lowpass';
  // A darker low-pass that follows the note, capped well below the shrill range.
  filter.frequency.setValueAtTime(Math.min(2000, Math.max(1100, frequency * 3)), now);
  filter.Q.setValueAtTime(0.4, now);
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
    stop() {
      oscillators.forEach(oscillator => { try { oscillator.stop(); } catch (_) { /* Already ended. */ } });
      voice.finish();
    },
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

// Gesture entry point: called only by sky/keyboard input handlers. Importing,
// peeking, opening the panel and advancing the song never create audio.
export function playNote(noteName) {
  if (!/^[A-G]#?[3-7]$/.test(noteName)) return false;
  recordNoteTiming();
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return false;
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
    if (audio.state === 'closed') return false;
    soundNote(frequencyFor(noteName));
    return true;
  } catch {
    // Audio support/device failures must never interfere with the hero's waves.
    return false;
  }
}

export function playNextNote() {
  if (playNote(peekNextNote())) advance();
}

// Switching away and backgrounding must silence held notes and release tails.
// Retain the context for a later user gesture; mounting never resumes it.
export function stopPiano() {
  pauseNoteTiming();
  for (const voice of new Set([...voices, ...tails])) voice.stop();
  if (audio?.state === 'running') audio.suspend?.().catch(() => {});
}

export function isPianoPlaying() { return voices.length > 0 || tails.size > 0; }
