import { songs } from './hero-songs.js?v=20261029-maple-16-bars-1';
import { createPianoSynth, voicePresetFor } from './hero-piano-voices.js?v=20261029-voices-3';

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
export function currentVoicePreset() { return voicePresetFor(song.id); }

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
let audio = null;
let synth = null;
let nextNote = 0;
const listeners = new Set();
let lastNoteTime = null;
let wavePosition = .5;
let cueStarted = null;
let cueDuration = 0;
const PRACTICE_TEMPO = 100;
const LANDING_MS = 140;

// The wave and cue share performance.now(), but retain their different jobs:
// waves respond to actual gestures; the cue guides the next song attack.
// Songs with noteBeats use their verified rhythm. Others use an explicit
// practice pulse, rather than claiming that equal beats reproduce their score.
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

// A song can move the keyboard up an octave so its high notes have keys.
// Runaway uses this for its high E6 riff.
export function songKeyboardOctave() { return Number.isInteger(song.keyboardOctave) ? song.keyboardOctave : 0; }

export function onSongAdvance(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function selectSong(candidate) {
  song = candidate;
  synth?.select(currentVoicePreset());
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
      synth = createPianoSynth(audio);
      synth.select(currentVoicePreset());
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    if (audio.state === 'closed') return false;
    synth.play(frequencyFor(noteName));
    return true;
  } catch {
    // Audio support/device failures must never interfere with the hero's waves.
    synth?.stop();
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
  synth?.stop();
  if (audio?.state === 'running') audio.suspend?.().catch(() => {});
}

export function isPianoPlaying() { return synth?.isPlaying() || false; }
