import { playNote, peekNextNote, advance, onSongAdvance, songKeyboardOctave, currentSong, nextSong, noteWavePosition, noteTiming, pauseNoteTiming } from './hero-piano.js?v=20261029-maple-16-bars-1';

// Round 76 (Joshua, 19 Oct 2026: "is it possible for us to be able to play the
// whole piano with keyboard?"): two manuals, so every key from C3 to C6 has its
// own computer key and nothing needs an octave shift. The bottom rows play
// C3–E4 (Z X C V B N M , . / with S D G H J L ; as black keys); the top rows
// play F4–C6 (Q to ] with 2 3 4 6 7 9 0 - as black keys).
const KEY_NOTES = new Map([
  ['z', 'C3'], ['s', 'C#3'], ['x', 'D3'], ['d', 'D#3'], ['c', 'E3'], ['v', 'F3'], ['g', 'F#3'], ['b', 'G3'],
  ['h', 'G#3'], ['n', 'A3'], ['j', 'A#3'], ['m', 'B3'], [',', 'C4'], ['l', 'C#4'], ['.', 'D4'], [';', 'D#4'], ['/', 'E4'],
  ['q', 'F4'], ['2', 'F#4'], ['w', 'G4'], ['3', 'G#4'], ['e', 'A4'], ['4', 'A#4'], ['r', 'B4'], ['t', 'C5'],
  ['6', 'C#5'], ['y', 'D5'], ['7', 'D#5'], ['u', 'E5'], ['i', 'F5'], ['9', 'F#5'], ['o', 'G5'], ['0', 'G#5'],
  ['p', 'A5'], ['-', 'A#5'], ['[', 'B5'], [']', 'C6'],
]);
const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = note => (Number(note.at(-1)) + 1) * 12 + PITCHES.indexOf(note.slice(0, -1));
// A song may move the whole keyboard up an octave (round 87); notes, labels and the
// computer keys all follow.
const shifted = note => note.slice(0, -1) + (Number(note.at(-1)) + songKeyboardOctave());

export function initHeroKeyboard(ripple, root = document) {
  const controller = new AbortController();
  const listen = (target, type, callback, options = {}) => target?.addEventListener(type, callback, { ...options, signal: controller.signal });
  const toggle = root.querySelector('#piano-toggle');
  const panel = root.querySelector('#hero-keyboard');
  if (!toggle || !panel) return;
  const keys = panel.querySelector('.piano-keys');
  const scroll = panel.querySelector('.piano-scroll');
  const buttons = [...keys.querySelectorAll('[data-note]')];
  const byNote = new Map();
  const names = new Map();
  const credit = panel.querySelector('.piano-credit');
  const timers = new Map();
  const pointers = new Map();
  const held = new Set();
  const tempo = panel.querySelector('.piano-tempo');
  const tempoBar = panel.querySelector('.piano-tempo-bar');
  const tempoLabel = panel.querySelector('.piano-tempo-label');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tempoFrame = 0;
  let layoutFrame = 0;

  function renderTempo() {
    cancelAnimationFrame(tempoFrame);
    tempoFrame = 0;
    if (!tempo || !tempoBar || !tempoLabel) return;
    const timing = noteTiming();
    tempo.dataset.phase = timing.phase;
    const label = `${timing.practice ? 'Practice ' : ''}♩ = ${timing.bpm}`;
    if (tempoLabel.textContent !== label) {
      tempoLabel.textContent = label;
      tempo.setAttribute('aria-label', `${timing.practice ? 'Practice tempo' : 'Tempo'}: ${timing.bpm} beats per minute. Play the orange key when the bar fills.`);
    }
    // Reduced motion has just one discrete change at the due time, with no glow.
    tempoBar.value = reducedMotion.matches ? Number(timing.progress === 1) : timing.progress;
    if (open && !document.hidden && (timing.phase === 'filling' || timing.phase === 'landing')) {
      tempoFrame = requestAnimationFrame(renderTempo);
    }
  }

  function stopTempo() {
    pauseNoteTiming();
    renderTempo();
  }
  listen(reducedMotion, 'change', renderTempo);
  let mappedSong;
  function mapSong() {
    if (mappedSong === currentSong()) return;
    pointers.clear();
    held.clear();
    for (const [button, timer] of timers) {
      clearTimeout(timer);
      button.classList.remove('is-pressed');
    }
    timers.clear();
    mappedSong = currentSong();
    byNote.clear();
    // data-note is the immutable CSS position; only data-pitch changes register.
    for (const button of buttons) {
      const pitch = shifted(button.dataset.note);
      button.dataset.pitch = pitch;
      names.set(button, pitch.replace('#', ' sharp '));
      button.setAttribute('aria-label', names.get(button));
      byNote.set(pitch, button);
    }
    panel.dataset.octave = String(songKeyboardOctave());
    panel.dataset.song = mappedSong.id;
    if (credit) credit.textContent = `${mappedSong.title} · ${mappedSong.composer}`;
    // CSS repositions the compact phone keys without inline styles.
    for (const [key, note] of KEY_NOTES) {
      const button = byNote.get(shifted(note));
      if (button) button.dataset.key = key.toUpperCase();
    }
  }
  mapSong();
  listen(panel.querySelector('.piano-next'), 'click', () => {
    nextSong();
    if (open) revealInViewport();
  });
  let open = false;
  let next = peekNextNote();
  let highlighted;
  let following;

  function keepInView() {
    if (!open || !highlighted) return;
    const keyRect = highlighted.getBoundingClientRect();
    const view = scroll.getBoundingClientRect();
    // Scroll only the keyboard viewport: scrollIntoView can move the whole page.
    if (keyRect.left < view.left + 12 || keyRect.right > view.right - 12) {
      scroll.scrollTo({ left: scroll.scrollLeft + (keyRect.left + keyRect.right - view.left - view.right) / 2, behavior: 'instant' });
    }
  }

  function revealInViewport(instant = false) {
    // This untransformed outer panel already has its full height while sliding.
    // On opening/reflow, keep the keys between the sticky header and viewport edge.
    const rect = panel.getBoundingClientRect();
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    const offset = rect.top < headerBottom + 12 ? rect.top - headerBottom - 12
      : rect.bottom > window.innerHeight ? rect.bottom - window.innerHeight + 12 : 0;
    if (offset) window.scrollBy({ top: offset, left: 0,
      behavior: instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function revealAfterLayout() {
    cancelAnimationFrame(layoutFrame);
    if (!open) { layoutFrame = 0; return; }
    // The back-page frame equalises in RAF, and browser focus/scroll restoration
    // can follow that reflow. Read the finished geometry on the following frame.
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = 0;
        if (!open || document.hidden) return;
        keepInView();
        revealInViewport(true);
      });
    });
  }

  function highlight(note) {
    next = note;
    for (const button of new Set([highlighted, following])) {
      if (!button) continue;
      button.classList.remove('is-now', 'is-next');
      button.setAttribute('aria-label', names.get(button));
    }
    mapSong();
    highlighted = byNote.get(note);
    following = byNote.get(peekNextNote(1));
    if (following) {
      following.classList.add('is-next');
      following.setAttribute('aria-label', `${names.get(following)}, following note`);
    }
    if (highlighted) {
      highlighted.classList.add('is-now');
      highlighted.setAttribute('aria-label', `${names.get(highlighted)}, play now${following === highlighted ? ', then again' : ''}`);
    }
    keepInView();
    renderTempo();
  }

  function press(button) {
    if (!open || !button) return;
    root.dispatchEvent(new CustomEvent('showcase:activity', { bubbles: true }));
    const note = button.dataset.pitch;
    const followsSong = note === peekNextNote();
    if (playNote(note) && followsSong) advance();
    button.classList.add('is-pressed');
    clearTimeout(timers.get(button));
    timers.set(button, setTimeout(() => {
      button.classList.remove('is-pressed');
      timers.delete(button);
    }, 150));
    ripple((midi(note) - midi(shifted('C3'))) / (midi(shifted('C6')) - midi(shifted('C3'))), noteWavePosition());
  }

  function setOpen(value) {
    if (open === value) return;
    open = value;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} piano keyboard`);
    if (!open && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    panel.classList.toggle('is-open', open);
    if (!open) { pointers.clear(); held.clear(); stopTempo(); }
    else renderTempo();
    keepInView();
    if (open) revealInViewport();
  }
  listen(toggle, 'click', () => setOpen(!open));

  const hero = toggle.closest('.living-hero') || toggle.closest('[data-showcase]');
  const header = document.querySelector('body > header');
  function closeAfterHero() {
    if (!open || !hero || layoutFrame) return;
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    // Wait until the next section reaches the header, so the small scroll
    // that reveals the keyboard itself cannot immediately close it again.
    // Allow the one-pixel difference between the header and its anchor offset.
    if (hero.getBoundingClientRect().bottom <= headerBottom + 2) setOpen(false);
  }
  listen(window, 'scroll', closeAfterHero, { passive: true });
  listen(window, 'resize', () => {
    if (!open) return;
    revealAfterLayout();
  });
  listen(document, 'framework:layoutchange', event => {
    if (event.target.contains(panel)) revealAfterLayout();
  });

  const keyFrom = element => {
    const key = element?.closest?.('[data-note]');
    return key && keys.contains(key) ? key : null;
  };
  listen(keys, 'pointerdown', event => {
    if (!open || (event.button !== undefined && event.button !== 0)) return;
    const key = keyFrom(event.target);
    if (!key) return;
    event.preventDefault();
    key.focus({ preventScroll: true });
    keys.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, key);
    press(key);
  });
  listen(keys, 'pointermove', event => {
    if (!open || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    const key = keyFrom(document.elementFromPoint(event.clientX, event.clientY));
    if (key && key !== pointers.get(event.pointerId)) press(key);
    pointers.set(event.pointerId, key);
  });
  const release = event => { pointers.delete(event.pointerId); };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(keys, type, release);
  // Native Enter/Space and assistive-technology activation produce detail=0.
  // Pointer activation already sounded at pointerdown, so never play it twice.
  listen(keys, 'click', event => {
    if (event.detail === 0) press(keyFrom(event.target));
  });

  listen(document, 'keydown', event => {
    if (!open || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
      event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    const key = event.key.toLowerCase();
    const note = KEY_NOTES.get(key);
    if (!note) return;
    const button = byNote.get(shifted(note));
    if (!button || !button.getClientRects().length) return;
    event.preventDefault();
    if (event.repeat || held.has(key)) return;
    held.add(key);
    press(button);
  });
  listen(document, 'keyup', event => { held.delete(event.key.toLowerCase()); });
  listen(window, 'blur', () => { held.clear(); pointers.clear(); stopTempo(); });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { held.clear(); pointers.clear(); stopTempo(); }
  });
  const resize = new ResizeObserver(() => { keepInView(); revealAfterLayout(); });
  resize.observe(scroll);
  resize.observe(root);
  const unsubscribe = onSongAdvance(highlight);
  highlight(next);
  const destroy = () => {
    open = false;
    controller.abort();
    cancelAnimationFrame(tempoFrame);
    cancelAnimationFrame(layoutFrame);
    pauseNoteTiming();
    resize.disconnect();
    unsubscribe();
    for (const timer of timers.values()) clearTimeout(timer);
    pointers.clear();
    held.clear();
  };
  destroy.isPlaying = () => pointers.size > 0 || held.size > 0;
  return destroy;
}
