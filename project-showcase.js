// One media cell for the opening and Projects. Copy stays in HTML for no-JS/print.
export const projects = [
  { id: 'football', name: 'Sports journalism', poster: 'assets/projects/football-newspaper.webp', alt: 'A football newspaper front page with analysis pieces', type: 'newspaper', src: 'projects/football-journalism/index.html#football' },
  { id: 'darty', name: 'DARTY', poster: 'assets/projects/darty-still-01.webp', alt: 'DARTY football gameplay', type: 'gallery', images: [1, 2, 3, 4].map(n => `assets/projects/darty-still-0${n}.webp`) },
  { id: 'drinks', name: 'Drink design', poster: 'assets/projects/drinks/skids-poster.jpg', alt: 'Skids drink design', type: 'drinks', drinks: [{ id: 'skids', name: 'Skids' }, { id: 'fizzy', name: 'Fizzy' }, { id: 'ground-pinch', name: 'Ground Pinch' }] },
  { id: 'piano', name: 'Piano', poster: 'assets/projects/toucan-piano-preview.png', alt: 'Toucan piano and pixel sky', type: 'piano' },
];

// Owner, 28 Oct 2026: "lets have piano as the 1st in the carousel on the frontpage for now".
// Set to null to go back to a random project on each homepage load.
export const homepageStart = 'piano';

// ?project=<id> is a review/test override; otherwise homepageStart, else random.
export function initialProject(requested, random = Math.random, start = homepageStart) {
  const index = projects.findIndex(project => project.id === requested);
  if (index >= 0) return index;
  const fixed = projects.findIndex(project => project.id === start);
  return fixed >= 0 ? fixed : Math.floor(random() * projects.length);
}

// Injectable clock keeps the real 20-second policy testable without a browser.
export function idleAdvance({ advance, blocked, enabled, clock = globalThis, delay = 20000 }) {
  let timer = null;
  let remaining = delay;
  let started = 0;
  const now = () => clock.Date.now();
  const clear = () => { clock.clearTimeout(timer); timer = null; };
  const resume = () => {
    if (timer !== null || !enabled()) return;
    started = now();
    timer = clock.setTimeout(() => {
      timer = null;
      remaining = delay;
      if (enabled() && !blocked()) advance();
      resume();
    }, remaining);
  };
  return {
    reset() { clear(); remaining = delay; resume(); },
    pause() { if (timer !== null) remaining = Math.max(0, remaining - (now() - started)); clear(); },
    resume,
    destroy: clear,
  };
}

const pianoMarkup = `<div class="piano-world">
            <button class="world-art" id="ripple-button" type="button" aria-label="Toucan pixel sky: click or press Enter to make ripples and play a note">
              <canvas id="sky-canvas" aria-hidden="true"></canvas>
              <canvas id="flock-canvas" aria-hidden="true"></canvas>
              <img class="hero-mascot" src="assets/toucan-logo-outline.png" alt="" width="1200" height="1200" />
            </button>
            <div class="piano-panel" id="hero-keyboard" role="group" aria-label="Piano keyboard" aria-hidden="true" inert>
              <div class="piano-panel-inner">
                <p class="piano-hint">Play with your keyboard: bottom rows for low notes, top rows for high notes.</p>
                <div class="piano-song-controls">
                  <p class="piano-credit" aria-live="polite" aria-atomic="true"></p>
                  <button class="piano-next" type="button">Next song</button>
                </div>
                <div class="piano-scroll">
                  <div class="piano-keys">
                  <button class="piano-key piano-key--white" type="button" data-note="C3" aria-label="C3"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="C#3" aria-label="C sharp 3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="D3" aria-label="D3"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="D#3" aria-label="D sharp 3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="E3" aria-label="E3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="F3" aria-label="F3"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="F#3" aria-label="F sharp 3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="G3" aria-label="G3"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="G#3" aria-label="G sharp 3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="A3" aria-label="A3"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="A#3" aria-label="A sharp 3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="B3" aria-label="B3"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="C4" aria-label="C4"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="C#4" aria-label="C sharp 4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="D4" aria-label="D4"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="D#4" aria-label="D sharp 4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="E4" aria-label="E4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="F4" aria-label="F4"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="F#4" aria-label="F sharp 4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="G4" aria-label="G4"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="G#4" aria-label="G sharp 4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="A4" aria-label="A4"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="A#4" aria-label="A sharp 4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="B4" aria-label="B4"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="C5" aria-label="C5"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="C#5" aria-label="C sharp 5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="D5" aria-label="D5"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="D#5" aria-label="D sharp 5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="E5" aria-label="E5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="F5" aria-label="F5"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="F#5" aria-label="F sharp 5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="G5" aria-label="G5"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="G#5" aria-label="G sharp 5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="A5" aria-label="A5"></button>
                  <button class="piano-key piano-key--black" type="button" data-note="A#5" aria-label="A sharp 5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="B5" aria-label="B5"></button>
                  <button class="piano-key piano-key--white" type="button" data-note="C6" aria-label="C6"></button>
                  </div>
                </div>
                <div class="piano-tempo" role="group" aria-label="Tempo">
                  <progress class="piano-tempo-bar" max="1" value="0" aria-hidden="true"></progress>
                  <span class="piano-tempo-label"></span>
                </div>
              </div>
            </div>
</div>`;

const pianoToggle = `            <button class="piano-toggle" id="piano-toggle" type="button" aria-label="Show piano keyboard" aria-expanded="false" aria-controls="hero-keyboard">
              <svg viewBox="0 0 24 18" width="22" height="18" aria-hidden="true" focusable="false"><path d="M1 1h22v16H1zM6 1v16M12 1v16M18 1v16" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 1h4v9H4zM10 1h4v9h-4zM16 1h4v9h-4z" fill="currentColor"/></svg>
              <span>Piano</span>
            </button>
`;

const interactive = 'a, button, input, textarea, select, video, audio, iframe, summary, [contenteditable], [role="slider"], [data-screenshot-gallery]';
const activityTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'touchstart', 'touchmove', 'touchend', 'focusin'];

export function initShowcase(root) {
  if (root.hasAttribute('data-showcase-ready')) return;
  const automatic = root.dataset.showcaseMode === 'auto';
  const slides = [...root.querySelectorAll('[data-project-slide]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const requested = new URLSearchParams(location.search).get('project');
  let index = automatic ? initialProject(requested) : Math.max(0, projects.findIndex(project => project.id === requested));
  let generation = 0;
  let dispose = null;
  let mounted = null;
  let printing = false;
  let gesture = null;
  const pointers = new Set();
  const held = new Set();
  const cell = document.createElement('div');
  cell.className = 'showcase-cell';
  cell.innerHTML = '<div class="showcase-stage"></div><div class="showcase-caption"><button type="button" data-project-prev aria-label="Previous project">←</button><span class="showcase-name" data-project-name></span><span class="showcase-piano-control"></span><span data-project-status aria-live="polite" aria-atomic="true"></span><button type="button" data-project-next aria-label="Next project">→</button></div>';
  const stage = cell.querySelector('.showcase-stage');
  const name = cell.querySelector('[data-project-name]');
  const status = cell.querySelector('[data-project-status]');
  const pianoControl = cell.querySelector('.showcase-piano-control');
  root.tabIndex = 0;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  if (!root.hasAttribute('aria-label')) root.setAttribute('aria-label', 'Learner projects');
  const visible = () => !printing && !document.hidden && !root.closest('[hidden], [inert]');
  const timer = idleAdvance({
    advance: () => show(index + 1),
    blocked: () => root.contains(document.activeElement) || pointers.size > 0 || held.size > 0 || Boolean(dispose?.isPlaying?.()),
    enabled: () => automatic && visible() && !motion.matches,
  });
  const activity = () => timer.reset();
  const preview = project => {
    const img = document.createElement('img');
    img.src = project.poster;
    img.alt = project.alt;
    img.className = 'showcase-preview';
    return img;
  };
  function unmount() {
    generation++;
    dispose?.();
    dispose = null;
    mounted = null;
    delete root.dataset.showcaseMounted;
    // Removing the iframe discards its document, scripts and any media.
    stage.replaceChildren();
    pianoControl.replaceChildren();
  }
  function mount(project) {
    const token = ++generation;
    mounted = project.id;
    root.dataset.showcaseMounted = project.id;
    stage.replaceChildren(preview(project));
    if (project.type === 'piano') {
      import('./hero-sky.js?v=20261028-shared-2').then(({ initHeroSky }) => {
        if (token !== generation || !visible()) return;
        stage.innerHTML = pianoMarkup;
        pianoControl.innerHTML = pianoToggle;
        dispose = initHeroSky(cell);
        stage.querySelector('.hero-mascot').decoding = 'async';
      }).catch(() => {
        if (token === generation) stage.querySelector('img')?.setAttribute('alt', 'Piano preview; reload to play');
      });
    } else if (project.type === 'newspaper') {
      const iframe = document.createElement('iframe');
      iframe.className = 'showcase-newspaper';
      iframe.title = 'Football newspaper: read the front page and articles';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      const controller = new AbortController();
      iframe.addEventListener('load', () => {
        // Events in the same-origin newspaper do not bubble to its parent.
        const doc = iframe.contentDocument;
        activityTypes.forEach(type => doc?.addEventListener(type, activity, { passive: true, signal: controller.signal }));
      }, { signal: controller.signal });
      iframe.src = project.src;
      stage.replaceChildren(iframe);
      dispose = () => { controller.abort(); iframe.remove(); };
    } else if (project.type === 'gallery') {
      const gallery = document.createElement('div');
      gallery.className = 'screenshot-gallery';
      gallery.dataset.screenshotGallery = '';
      gallery.setAttribute('role', 'group');
      gallery.setAttribute('aria-label', 'DARTY gameplay screenshots');
      gallery.innerHTML = '<img data-screenshot width="960" height="540"><div class="screenshot-gallery-controls"><span data-screenshot-status aria-live="polite"></span><button type="button" data-screenshot-next>Next image <span aria-hidden="true">→</span></button></div>';
      let image = 0;
      const draw = () => {
        const img = gallery.querySelector('img');
        img.src = project.images[image];
        img.alt = `DARTY football gameplay screenshot ${image + 1}`;
        gallery.querySelector('[data-screenshot-status]').textContent = `Gameplay screenshots · ${image + 1} of ${project.images.length}`;
      };
      gallery.querySelector('button').addEventListener('click', () => { image = (image + 1) % project.images.length; draw(); });
      gallery.dataset.enhanced = '';
      draw();
      stage.replaceChildren(gallery);
    } else if (project.type === 'drinks') {
      const drinks = document.createElement('div');
      drinks.className = 'showcase-drinks';
      const screen = document.createElement('div');
      screen.className = 'showcase-drink-screen';
      const controls = document.createElement('div');
      controls.className = 'showcase-drink-controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Drink designs');
      let video = null;
      function stopVideo() {
        if (!video) return;
        video.pause();
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach(source => source.remove());
        video.load();
        video = null;
      }
      function select(drink) {
        stopVideo();
        controls.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.drink === drink.id)));
        const poster = `assets/projects/drinks/${drink.id}-poster.jpg`;
        const image = document.createElement('img');
        image.src = poster;
        image.alt = `${drink.name} drink design`;
        screen.replaceChildren(image);
        // Posters are the first paint and the complete reduced-motion view.
        if (motion.matches) return;
        const player = document.createElement('video');
        video = player;
        player.muted = true;
        player.defaultMuted = true;
        player.loop = true;
        player.playsInline = true;
        player.preload = 'none';
        player.poster = poster;
        player.setAttribute('aria-label', `${drink.name} turntable`);
        for (const extension of ['webm', 'mp4']) {
          const source = document.createElement('source');
          source.src = `assets/projects/drinks/${drink.id}.${extension}`;
          source.type = `video/${extension}`;
          player.append(source);
        }
        player.addEventListener('playing', () => {
          if (video === player) image.hidden = true;
        });
        screen.append(player);
        player.play().catch(() => {}); // The poster remains if autoplay is unavailable.
      }
      project.drinks.forEach(drink => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = drink.name;
        button.dataset.drink = drink.id;
        button.addEventListener('click', () => select(drink));
        controls.append(button);
      });
      drinks.append(screen, controls);
      stage.replaceChildren(drinks);
      select(project.drinks[0]);
      dispose = stopVideo;
    }
  }
  function sync() {
    if (!visible()) {
      if (mounted) unmount();
      pointers.clear();
      held.clear();
      timer.pause();
      return;
    }
    if (mounted !== projects[index].id) mount(projects[index]);
    if (automatic && !motion.matches) timer.resume();
    else timer.pause();
  }
  function show(requestedIndex) {
    const nextIndex = (requestedIndex + projects.length) % projects.length;
    if (cell.contains(document.activeElement) && !document.activeElement.closest('.showcase-caption')) root.focus({ preventScroll: true });
    if (slides.some(slide => slide.dataset.project !== projects[nextIndex].id && slide.contains(document.activeElement))) root.focus({ preventScroll: true });
    unmount();
    index = nextIndex;
    root.dataset.project = projects[index].id;
    slides.forEach(slide => {
      const inactive = slide.dataset.project !== projects[index].id;
      slide.hidden = inactive;
      slide.inert = inactive;
    });
    const slot = automatic ? root : slides.find(slide => slide.dataset.project === projects[index].id).querySelector('.framework-project-media');
    slot.append(cell);
    name.textContent = projects[index].name;
    status.textContent = `${index + 1} of ${projects.length}`;
    timer.reset();
    sync();
  }
  cell.querySelector('[data-project-prev]').addEventListener('click', () => show(index - 1));
  cell.querySelector('[data-project-next]').addEventListener('click', () => show(index + 1));
  activityTypes.forEach(type => root.addEventListener(type, activity, { passive: true }));
  root.addEventListener('showcase:activity', activity);
  root.addEventListener('pointerdown', event => pointers.add(event.pointerId));
  window.addEventListener('pointerup', event => { if (pointers.delete(event.pointerId)) activity(); });
  window.addEventListener('pointercancel', event => { if (pointers.delete(event.pointerId)) activity(); });
  root.addEventListener('keydown', event => held.add(event.code));
  window.addEventListener('keyup', event => { if (held.delete(event.code)) activity(); });
  root.addEventListener('focusout', () => queueMicrotask(() => { if (visible()) activity(); }));
  window.addEventListener('blur', () => { pointers.clear(); held.clear(); });
  root.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest(interactive)) return;
    const destination = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: projects.length - 1 }[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    show(destination);
  });
  root.addEventListener('touchstart', event => {
    gesture = null;
    if (event.touches.length !== 1 || event.target.closest(interactive) || String(window.getSelection() || '')) return;
    gesture = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  root.addEventListener('touchend', event => {
    if (!gesture || event.changedTouches.length !== 1 || String(window.getSelection() || '')) { gesture = null; return; }
    const x = event.changedTouches[0].clientX - gesture.x;
    const y = event.changedTouches[0].clientY - gesture.y;
    gesture = null;
    if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.6) show(index + (x < 0 ? 1 : -1));
  }, { passive: true });
  root.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
  const revealHash = () => {
    const target = document.getElementById(location.hash.slice(1));
    const selected = slides.find(slide => slide === target || (target && slide.contains(target)));
    if (selected) show(projects.findIndex(project => project.id === selected.dataset.project));
  };
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('popstate', revealHash);
  document.addEventListener('framework:panelchange', sync);
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'inert'] });
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', () => { unmount(); timer.reset(); sync(); });
  window.addEventListener('pagehide', () => { unmount(); timer.pause(); });
  window.addEventListener('pageshow', sync);
  window.addEventListener('beforeprint', () => { printing = true; unmount(); timer.pause(); slides.forEach(slide => { slide.hidden = false; slide.inert = false; }); });
  window.addEventListener('afterprint', () => { printing = false; show(index); });
  root.dataset.enhanced = '';
  root.dataset.showcaseReady = '';
  show(index);
  revealHash();
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-showcase]').forEach(initShowcase);
