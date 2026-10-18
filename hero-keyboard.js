import { playNote, peekNextNote, advance, onSongAdvance } from './hero-piano.js?v=20261018-keys-1';

// Chromatic C–E across the classic interleaved white/black computer keys.
const COMPUTER_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';'];
const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = note => (Number(note.at(-1)) + 1) * 12 + PITCHES.indexOf(note.slice(0, -1));
const noteAt = value => PITCHES[value % 12] + (Math.floor(value / 12) - 1);
const clampOctave = octave => Math.max(3, Math.min(5, octave));

export function initHeroKeyboard(ripple) {
  const toggle = document.getElementById('piano-toggle');
  const panel = document.getElementById('hero-keyboard');
  if (!toggle || !panel) return;
  const keys = panel.querySelector('.piano-keys');
  const scroll = panel.querySelector('.piano-scroll');
  const buttons = [...keys.querySelectorAll('[data-note]')];
  const byNote = new Map(buttons.map(button => [button.dataset.note, button]));
  const names = new Map(buttons.map(button => [button, button.getAttribute('aria-label')]));
  const timers = new Map();
  const pointers = new Map();
  const held = new Set();
  let open = false;
  let octaveShift = 0;
  let next = peekNextNote();
  let highlighted;

  function keepInView() {
    if (!open || !highlighted) return;
    const keyRect = highlighted.getBoundingClientRect();
    const view = scroll.getBoundingClientRect();
    // Scroll only the keyboard viewport: scrollIntoView can move the whole page.
    if (keyRect.left < view.left + 12 || keyRect.right > view.right - 12) {
      scroll.scrollTo({ left: scroll.scrollLeft + (keyRect.left + keyRect.right - view.left - view.right) / 2, behavior: 'instant' });
    }
  }

  function revealInViewport() {
    // This untransformed outer panel already has its full height while sliding.
    // Nudge only on opening, and only when the keys extend below the viewport.
    const bottom = panel.getBoundingClientRect().bottom;
    if (bottom > window.innerHeight) {
      window.scrollBy({ top: bottom - window.innerHeight + 12, left: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }

  function highlight(note) {
    next = note;
    if (highlighted) {
      highlighted.classList.remove('is-next');
      highlighted.setAttribute('aria-label', names.get(highlighted));
    }
    highlighted = byNote.get(note);
    if (highlighted) {
      highlighted.classList.add('is-next');
      highlighted.setAttribute('aria-label', `${names.get(highlighted)}, next note`);
    }
    keepInView();
  }

  function press(button) {
    if (!open || !button) return;
    const note = button.dataset.note;
    const followsSong = note === peekNextNote();
    if (playNote(note) && followsSong) advance();
    button.classList.add('is-pressed');
    clearTimeout(timers.get(button));
    timers.set(button, setTimeout(() => {
      button.classList.remove('is-pressed');
      timers.delete(button);
    }, 150));
    ripple((midi(note) - midi('C3')) / (midi('C6') - midi('C3')));
  }

  toggle.addEventListener('click', () => {
    open = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} piano keyboard`);
    if (!open && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    panel.classList.toggle('is-open', open);
    if (!open) { pointers.clear(); held.clear(); }
    keepInView();
    if (open) revealInViewport();
  });

  const keyFrom = element => {
    const key = element?.closest?.('[data-note]');
    return key && keys.contains(key) ? key : null;
  };
  keys.addEventListener('pointerdown', event => {
    if (!open || (event.button !== undefined && event.button !== 0)) return;
    const key = keyFrom(event.target);
    if (!key) return;
    event.preventDefault();
    key.focus({ preventScroll: true });
    keys.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, key);
    press(key);
  });
  keys.addEventListener('pointermove', event => {
    if (!open || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    const key = keyFrom(document.elementFromPoint(event.clientX, event.clientY));
    if (key && key !== pointers.get(event.pointerId)) press(key);
    pointers.set(event.pointerId, key);
  });
  const release = event => { pointers.delete(event.pointerId); };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) keys.addEventListener(type, release);
  // Native Enter/Space and assistive-technology activation produce detail=0.
  // Pointer activation already sounded at pointerdown, so never play it twice.
  keys.addEventListener('click', event => {
    if (event.detail === 0) press(keyFrom(event.target));
  });

  document.addEventListener('keydown', event => {
    if (!open || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
      event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' || key === 'x') {
      event.preventDefault();
      if (!event.repeat && !held.has(key)) {
        const octave = clampOctave(clampOctave(Number(next.at(-1))) + octaveShift);
        octaveShift = clampOctave(octave + (key === 'z' ? -1 : 1)) - clampOctave(Number(next.at(-1)));
        held.add(key);
      }
      return;
    }
    const index = COMPUTER_KEYS.indexOf(key);
    if (index < 0) return;
    const octave = clampOctave(clampOctave(Number(next.at(-1))) + octaveShift);
    const button = byNote.get(noteAt((octave + 1) * 12 + index));
    if (!button) return;
    event.preventDefault();
    if (event.repeat || held.has(key)) return;
    held.add(key);
    press(button);
  });
  document.addEventListener('keyup', event => { held.delete(event.key.toLowerCase()); });
  window.addEventListener('blur', () => { held.clear(); pointers.clear(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { held.clear(); pointers.clear(); }
  });
  new ResizeObserver(keepInView).observe(scroll);
  onSongAdvance(highlight);
  highlight(next);
}
