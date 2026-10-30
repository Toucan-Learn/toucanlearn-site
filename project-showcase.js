import { createDrinkSpin, renderDrinkInfo, prefetchDrink } from './drink-spin.js?v=20261029-condensation-1';
import { initHeroSky } from './hero-sky.js?v=20261030-live-sky-1';
import { SKY_PRESETS } from './hero-sky-shaders.js?v=20261017-ripple-1';
import { dartyMatchURL } from './darty-match.js?v=20261029-darty-title-4';

// One media cell for the opening and Projects. Full section copy stays in HTML for no-JS/print.
export const projects = [
  { id: 'football', name: 'Sports journalism', label: 'English', line: 'Persuasive writing through football, ending in his own newspaper.', poster: 'assets/projects/football-home{size}.webp?v=20261030-forecast-1', sectionPoster: 'assets/projects/football-section{size}.webp?v=20261030-forecast-1', alt: 'A football newspaper front page with analysis pieces', type: 'newspaper', src: 'projects/football-journalism/' },
  { id: 'darty', name: 'DARTY', label: 'English · Game design', line: 'Clear, precise written instructions that shaped a playable football game.', poster: 'assets/projects/darty-still-01.webp?v=20261029-darty-title-5', titleStill: 'assets/projects/darty-still-07.webp?v=20261029-darty-title-5', alt: 'DARTY night football match with stylised players on a green pitch', type: 'match' },
  { id: 'drinks', name: 'Drink design', label: 'English · Design', line: 'Writing for an audience: three drinks, from pencil sketches to 3D renders.', poster: 'assets/projects/drinks/skids/poster.webp?v=20261029-condensation-1', alt: 'Skids drink design', type: 'drinks', drinks: [
    { id: 'skids', name: 'Skids', lines: ["When you're in a rush, have some Skids."] },
    { id: 'fizzy', name: 'Fizzy', lines: ['Light, bright red. Fizzy Extreme.'] },
    { id: 'ground-pinch', name: 'Ground Pinch', lines: ['It’s sweet, fast, cheap, and will help you destroy your enemies.'] },
  ] },
  { id: 'piano', name: 'Piano', label: 'Music', line: 'A way into music through play, with songs to learn and sounds to try.', poster: 'assets/projects/toucan-piano-home{size}-{sky}.webp?v=20261030-forecast-1', sectionPoster: 'assets/projects/toucan-piano-section{size}-{sky}.webp?v=20261030-forecast-1', alt: 'Toucan piano and pixel sky', type: 'piano' },
];

// Only the children's manual carousel includes the text-led introduction.
export const sectionProjects = [{ id: 'intro', name: 'Intro', type: 'intro' }, ...projects];

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

// Injectable clock keeps the real 8-second policy testable without a browser.
export function idleAdvance({ advance, blocked, enabled, clock = globalThis, delay = 8000 }) {
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

const interactive = 'a, button, input, textarea, select, video, audio, iframe, summary, [contenteditable], [role="slider"]';
const activityTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'touchstart', 'touchmove', 'touchend', 'focusin'];

export function initShowcase(root) {
  if (root.hasAttribute('data-showcase-ready')) return;
  const automatic = root.dataset.showcaseMode === 'auto';
  const caption = automatic ? root.parentElement.querySelector('[data-project-caption]') : null;
  const entries = automatic ? projects : sectionProjects;
  const slides = [...root.querySelectorAll('[data-project-slide]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compactDevice = matchMedia('(max-width: 767px), (pointer: coarse) and (hover: none)');
  // Phone cells are near-square, so the football and piano posters have phone captures.
  const phoneCell = matchMedia('(max-width: 767px)');
  const requested = new URLSearchParams(location.search).get('project');
  let index = automatic ? initialProject(requested) : Math.max(0, entries.findIndex(project => project.id === requested));
  // The homepage counts from wherever it opened, so its first project reads "1 of 4".
  const countFrom = automatic ? index : 0;
  let generation = 0;
  let dispose = null;
  let mounted = null;
  let printing = false;
  let inView = typeof IntersectionObserver === 'undefined';
  let nearView = inView;
  let gesture = null;
  let workFrame = 0;
  let revealFrame = 0;
  let activate = null;
  // Warm the small, project-specific stills before navigation. Never borrow an
  // outgoing project's decoded media while an incoming view becomes ready.
  const previewDecodes = new WeakMap();
  // The piano sky is picked once per page load, before its poster warms, so
  // the poster always shows the colours the live sky draws.
  const requestedSky = new URLSearchParams(location.search).get('sky');
  const pianoSky = (SKY_PRESETS.find(sky => sky.id === requestedSky) || SKY_PRESETS[Math.floor(Math.random() * SKY_PRESETS.length)]).id;
  const warmPreview = (project, img) => {
    // Football and piano posters are captures of each carousel's live view
    // (scripts/capture-showcase-posters.mjs), so the cross-fade is invisible.
    const poster = ((!automatic && project.sectionPoster) || project.poster).replace('{sky}', pianoSky)
      .replace('{size}', phoneCell.matches ? '-phone' : '');
    img.src = project.titleStill || poster;
    const decoded = img.decode();
    previewDecodes.set(img, decoded);
    void decoded.catch(() => {});
  };
  const previews = new Map(entries.filter(project => project.poster).map(project => {
    const img = new Image();
    if (project.titleStill) { img.decoding = 'async'; img.width = 1600; img.height = 900; }
    // Small posters decode with their paint, so a re-shown one never blinks blank.
    else img.decoding = 'sync';
    img.alt = project.alt;
    img.className = 'showcase-preview';
    warmPreview(project, img);
    return [project.id, img];
  }));
  const pointers = new Set();
  const held = new Set();
  const cell = document.createElement('div');
  cell.className = 'showcase-cell';
  cell.innerHTML = '<div class="showcase-stage"></div><div class="showcase-caption"><button type="button" data-project-prev aria-label="Previous project">←</button><span class="showcase-name" data-project-name></span><span class="showcase-piano-control piano-world"></span><span data-project-status aria-live="polite" aria-atomic="true"></span><button type="button" data-project-next aria-label="Next project">→</button></div>';
  const stage = cell.querySelector('.showcase-stage');
  const navigation = cell.querySelector('.showcase-caption');
  const name = navigation.querySelector('[data-project-name]');
  const status = navigation.querySelector('[data-project-status]');
  const pianoControl = cell.querySelector('.showcase-piano-control');
  // The newspaper loads once and then stays, parked under the stage. Showing a
  // loaded page never swaps from a screenshot, so its text cannot shift (owner,
  // 29 Oct: the text "wobbles or jumps slightly as it settles"). Moving an
  // iframe reloads it, so it lives where it never moves: the homepage cell,
  // or the football slide that the children's cell visits.
  const newspaperLayer = document.createElement('div');
  newspaperLayer.className = 'showcase-newspaper-layer';
  newspaperLayer.inert = true;
  const footballSlide = slides.find(slide => slide.dataset.project === 'football');
  (!automatic && footballSlide?.querySelector('.framework-project-media') || cell).append(newspaperLayer);
  const newspaper = { iframe: null, ready: false, onReady: null };
  function loadNewspaper() {
    if (newspaper.iframe) return;
    const iframe = document.createElement('iframe');
    iframe.className = 'showcase-newspaper';
    iframe.title = 'Football newspaper: read the front page and articles';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    iframe.addEventListener('load', () => {
      // Events in the same-origin newspaper do not bubble to its parent.
      const doc = iframe.contentDocument;
      activityTypes.forEach(type => doc?.addEventListener(type, activity, { passive: true }));
      // React can commit after the document's load event. Wait for its
      // content as well as the blocking stylesheet.
      const ready = () => {
        if (newspaper.ready || !doc?.querySelector('#root > *')) return;
        contentObserver.disconnect();
        newspaper.ready = true;
        newspaper.onReady?.();
      };
      const contentObserver = new MutationObserver(ready);
      contentObserver.observe(doc.body, { childList: true, subtree: true });
      ready();
    });
    iframe.src = projects.find(project => project.type === 'newspaper').src;
    newspaperLayer.append(iframe);
    newspaper.iframe = iframe;
  }
  function hideNewspaper() {
    newspaper.onReady = null;
    newspaperLayer.inert = true;
    delete newspaperLayer.dataset.showcaseRevealed;
  }
  if (!automatic) {
    // One permanent header control for all five slides; only its text changes.
    navigation.className = 'showcase-navigation';
    navigation.setAttribute('role', 'group');
    navigation.setAttribute('aria-label', 'Choose a learner project');
    root.querySelector('.section-head').append(navigation);
    // The piano keeps its own toggle over the sky, outside the slide navigation.
    cell.append(pianoControl);
  }
  root.tabIndex = 0;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  if (!root.hasAttribute('aria-label')) root.setAttribute('aria-label', 'Learner projects');
  const visible = () => !printing && !document.hidden && !root.closest('[hidden], [inert]');
  const drinkPrefetch = prefetchDrink(projects.find(project => project.id === 'drinks').drinks[0]);
  let newspaperWarm = 0;
  const syncPrefetch = () => {
    drinkPrefetch.setActive(nearView && visible() && !motion.matches);
    // Laptops load the newspaper in the background shortly after the showcase
    // nears view, so even the first switch shows the live page. Phones wait.
    const warm = nearView && visible() && !compactDevice.matches && !newspaper.iframe;
    if (warm && !newspaperWarm) newspaperWarm = setTimeout(() => { newspaperWarm = 0; if (nearView && visible()) loadNewspaper(); }, 2000);
    else if (!warm && newspaperWarm) { clearTimeout(newspaperWarm); newspaperWarm = 0; }
  };
  const timer = idleAdvance({
    advance: () => show(index + 1),
    blocked: () => root.contains(document.activeElement) || pointers.size > 0 || held.size > 0 || Boolean(dispose?.isPlaying?.()) || Boolean(dispose?.isDragging?.()),
    enabled: () => automatic && inView && visible() && !motion.matches,
  });
  const activity = () => timer.reset();
  const preview = project => previews.get(project.id);
  function reveal(live, token) {
    // Keep the decoded incoming poster underneath throughout the fade. Opacity
    // leaves the live view laid out, so its first paint uses the real cell size.
    if (token !== generation || !live.isConnected) return;
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      if (token !== generation || !visible() || !live.isConnected) return;
      live.inert = false;
      live.dataset.showcaseRevealed = '';
    });
  }
  function finishWork() {
    const start = activate;
    activate = null;
    start?.();
  }
  function afterPaint() {
    if (workFrame) return;
    // The first RAF is before paint. The second lets the selected project's
    // markup/still paint before shader compilation or live-media loading.
    workFrame = requestAnimationFrame(() => {
      workFrame = requestAnimationFrame(() => { workFrame = 0; finishWork(); });
    });
  }
  function unmount() {
    generation++;
    activate = null;
    cancelAnimationFrame(workFrame);
    workFrame = 0;
    cancelAnimationFrame(revealFrame);
    revealFrame = 0;
    // Detach FIRST, including composited iframe/canvas layers and the open
    // keyboard. Then cancel its listeners/reflow callbacks immediately, so
    // detached keyboard geometry cannot scroll the newly selected project.
    stage.replaceChildren();
    pianoControl.replaceChildren();
    dispose?.();
    dispose = null;
    mounted = null;
    delete root.dataset.showcaseMounted;
  }
  function mount(project) {
    const token = ++generation;
    mounted = project.id;
    root.dataset.showcaseMounted = project.id;
    if (project.type === 'intro') return;
    stage.replaceChildren(preview(project));
    if (project.type === 'piano') {
      // Mount the exact shared piano synchronously, but keep its own poster
      // painted until the renderer has drawn at the final canvas dimensions.
      stage.insertAdjacentHTML('beforeend', pianoMarkup);
      const live = stage.querySelector('.piano-world');
      live.classList.add('showcase-live');
      pianoControl.innerHTML = pianoToggle;
      activate = () => {
        if (token !== generation || !visible()) return;
        const mascot = live.querySelector('.hero-mascot').decode().catch(() => {});
        dispose = initHeroSky(cell, { preset: pianoSky, onFirstFrame: () => {
          void mascot.then(() => { if (token === generation) reveal(live, token); });
        } });
      };
      afterPaint();
    } else if (project.type === 'newspaper') {
      const show = () => {
        if (token !== generation || !visible()) return;
        newspaperLayer.inert = false;
        newspaperLayer.dataset.showcaseRevealed = '';
      };
      dispose = hideNewspaper;
      if (newspaper.ready) show();
      else {
        // First visit before the background load finished: its poster covers
        // the wait, then the parked page comes forward after a paint frame.
        activate = () => {
          if (token !== generation || !visible()) return;
          newspaper.onReady = () => reveal(newspaperLayer, token);
          loadNewspaper();
        };
        afterPaint();
      }
    } else if (project.type === 'match') {
      const title = document.createElement('div');
      title.className = 'showcase-darty-title';
      title.innerHTML = '<div class="showcase-darty-heading"><strong class="showcase-darty-wordmark">DARTY</strong><p class="showcase-darty-subtitle">A student’s answer to FIFA</p><p class="showcase-darty-subtitle">CPU vs CPU · live match</p><button class="showcase-match-play" type="button" data-darty-play>Press to play</button></div>';
      const play = title.querySelector('[data-darty-play]');
      // Reuse the warmed still under the title and the loading match. There is
      // one backdrop throughout, so Play and teardown never swap photographs.
      const backdrop = preview(project);
      backdrop.alt = '';
      backdrop.setAttribute('aria-hidden', 'true');
      title.prepend(backdrop);
      void previewDecodes.get(backdrop).then(() => {
        if (token === generation) title.dataset.ready = '';
      }).catch(() => {});
      let frame = null;
      let muted = false;
      const mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'showcase-match-mute';
      mute.dataset.dartyMute = '';
      const drawMute = () => {
        mute.setAttribute('aria-pressed', String(muted));
        mute.setAttribute('aria-label', muted ? 'Unmute DARTY match' : 'Mute DARTY match');
        mute.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M11 4 5 9H2v6h3l6 5z" fill="currentColor"/><path d="${muted ? 'm16 8 6 8m0-8-6 8' : 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      };
      mute.addEventListener('click', () => {
        if (!frame) return;
        muted = !muted;
        frame.contentWindow.postMessage({ source: 'toucan-showcase', type: 'darty-mute', muted }, 'https://joshtoucanlearn.github.io');
        drawMute();
      });
      const stop = (restore = true) => {
        if (!frame) return;
        const focused = document.activeElement === frame || document.activeElement === mute;
        frame.remove();
        frame = null;
        pianoControl.replaceChildren();
        if (!restore) return;
        title.prepend(backdrop);
        stage.replaceChildren(title);
        if (focused && visible() && inView) play.focus({ preventScroll: true });
      };
      play.addEventListener('click', () => {
        if (token !== generation || frame || !inView || !visible()) return;
        const focused = document.activeElement === play;
        title.dataset.active = 'false';
        frame = document.createElement('iframe');
        frame.className = 'showcase-match showcase-live';
        frame.title = 'DARTY CPU vs CPU football match';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        frame.setAttribute('allow', 'autoplay; fullscreen');
        frame.loading = 'eager';
        const loadingFrame = frame;
        frame.addEventListener('load', () => {
          if (frame !== loadingFrame) return;
          mute.disabled = false;
          reveal(loadingFrame, token);
        }, { once: true });
        frame.src = dartyMatchURL;
        stage.replaceChildren(preview(project), frame);
        muted = false;
        mute.disabled = true;
        drawMute();
        pianoControl.replaceChildren(mute);
        // The keyup/pointerup can land inside the cross-origin document.
        held.clear();
        pointers.clear();
        if (focused) frame.focus({ preventScroll: true });
        activity();
      });
      stage.replaceChildren(title);
      // unmount() already detached the media; cleanup must not reattach it.
      dispose = () => { title.dataset.active = 'false'; stop(false); };
      dispose.setActive = active => {
        title.dataset.active = String(active && !frame && !motion.matches);
        if (!active) stop();
      };
      // Cross-origin input cannot bubble here. Keep the card for the match.
      dispose.isPlaying = () => Boolean(frame);
    } else if (project.type === 'drinks') {
      const drinks = document.createElement('div');
      drinks.className = 'showcase-drinks';
      const screen = document.createElement('div');
      screen.className = 'showcase-drink-screen';
      const info = document.createElement('div');
      const controls = document.createElement('div');
      controls.className = 'showcase-drink-controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Drink designs');
      let viewer = null;
      function select(drink) {
        viewer?.destroy();
        controls.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.drink === drink.id)));
        renderDrinkInfo(info, drink);
        viewer = createDrinkSpin(screen, drink, { reduced: motion.matches, activity });
        // The first spin image decodes asynchronously; its own selected poster
        // stays underneath rather than showing an empty screen in the meantime.
        if (drink === project.drinks[0]) screen.prepend(preview(project));
        viewer.setActive(inView && visible());
      }
      project.drinks.forEach(drink => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = drink.name;
        button.dataset.drink = drink.id;
        button.addEventListener('click', () => select(drink));
        controls.append(button);
      });
      // Controls lead the DOM: [data-drink] must find the button before frame metadata.
      drinks.append(controls, screen, info);
      stage.replaceChildren(drinks);
      select(project.drinks[0]);
      dispose = () => viewer?.destroy();
      dispose.setActive = value => viewer?.setActive(value);
      dispose.setReduced = value => viewer?.setReduced(value);
      dispose.isDragging = () => viewer?.isDragging();
    }
  }
  function sync() {
    syncPrefetch();
    if (!visible()) {
      if (dispose?.setActive) dispose.setActive(false);
      else if (mounted) unmount();
      if (!mounted && entries[index].poster) stage.replaceChildren(preview(entries[index]));
      pointers.clear();
      held.clear();
      timer.pause();
      return;
    }
    if (mounted !== entries[index].id) mount(entries[index]);
    dispose?.setActive?.(inView);
    if (automatic && inView && !motion.matches) timer.resume();
    else timer.pause();
  }
  function show(requestedIndex, userAction = false) {
    const nextIndex = (requestedIndex + entries.length) % entries.length;
    if (cell.contains(document.activeElement) && !navigation.contains(document.activeElement)) root.focus({ preventScroll: true });
    if (slides.some(slide => slide.dataset.project !== entries[nextIndex].id && slide.contains(document.activeElement))) root.focus({ preventScroll: true });
    unmount();
    index = nextIndex;
    root.dataset.project = entries[index].id;
    slides.forEach(slide => {
      const inactive = slide.dataset.project !== entries[index].id;
      slide.hidden = inactive;
      slide.inert = inactive;
    });
    const selected = slides.find(slide => slide.dataset.project === entries[index].id);
    const slot = automatic ? root : selected.querySelector('.framework-project-media') || selected;
    // Re-appending moves the node, which would reload the parked newspaper.
    if (cell.parentNode !== slot) slot.append(cell);
    name.textContent = entries[index].name;
    // Set live policy before changing text. Initial and idle changes stay quiet,
    // including the existing count; manual section navigation keeps its policy.
    if (automatic) status.setAttribute('aria-live', userAction ? 'polite' : 'off');
    if (caption) {
      caption.setAttribute('aria-live', userAction ? 'polite' : 'off');
      caption.querySelector('[data-project-label]').textContent = entries[index].label;
      caption.querySelector('[data-project-heading]').textContent = entries[index].name;
      caption.querySelector('[data-project-line]').textContent = entries[index].line;
    }
    status.textContent = `${(index - countFrom + entries.length) % entries.length + 1} of ${entries.length}`;
    timer.reset();
    sync();
  }
  navigation.querySelector('[data-project-prev]').addEventListener('click', () => show(index - 1, true));
  navigation.querySelector('[data-project-next]').addEventListener('click', () => show(index + 1, true));
  activityTypes.forEach(type => root.addEventListener(type, activity, { passive: true }));
  root.addEventListener('showcase:activity', activity);
  root.addEventListener('pointerdown', event => pointers.add(event.pointerId));
  window.addEventListener('pointerup', event => { if (pointers.delete(event.pointerId)) activity(); });
  window.addEventListener('pointercancel', event => { if (pointers.delete(event.pointerId)) activity(); });
  root.addEventListener('lostpointercapture', event => { if (pointers.delete(event.pointerId)) activity(); });
  root.addEventListener('keydown', event => held.add(event.code));
  window.addEventListener('keyup', event => { if (held.delete(event.code)) activity(); });
  root.addEventListener('focusout', () => queueMicrotask(() => { if (visible()) activity(); }));
  window.addEventListener('blur', () => { pointers.clear(); held.clear(); });
  root.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest(interactive)) return;
    const destination = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: entries.length - 1 }[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    show(destination, true);
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
    if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.6) show(index + (x < 0 ? 1 : -1), true);
  }, { passive: true });
  root.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
  const revealHash = event => {
    let target;
    try { target = event?.detail?.target || document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
    const selected = slides.find(slide => slide === target || (target && slide.contains(target)));
    if (selected) show(entries.findIndex(project => project.id === selected.dataset.project));
  };
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('popstate', revealHash);
  document.addEventListener('site:fragment', revealHash);
  document.addEventListener('framework:panelchange', event => { revealHash(event); sync(); });
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'inert'] });
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', () => {
    if (dispose?.setReduced) dispose.setReduced(motion.matches);
    else unmount();
    timer.reset();
    sync();
  });
  phoneCell.addEventListener('change', () => entries.filter(project => project.poster?.includes('{size}')).forEach(project => warmPreview(project, preview(project))));
  compactDevice.addEventListener('change', () => {
    if (entries[index].type !== 'match') return;
    if (stage.contains(document.activeElement)) root.focus({ preventScroll: true });
    unmount();
    timer.reset();
    sync();
  });
  window.addEventListener('pagehide', () => { drinkPrefetch.setActive(false); unmount(); timer.pause(); });
  window.addEventListener('pageshow', sync);
  window.addEventListener('beforeprint', () => { printing = true; syncPrefetch(); unmount(); timer.pause(); slides.forEach(slide => { slide.hidden = false; slide.inert = false; }); });
  window.addEventListener('afterprint', () => { printing = false; show(index); });
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(entries => {
      nearView = entries.some(entry => entry.isIntersecting);
      syncPrefetch();
    }, { rootMargin: '300px' }).observe(cell);
    new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === cell);
      if (!entry || inView === entry.isIntersecting) return;
      inView = entry.isIntersecting;
      sync();
    }).observe(cell);
  }
  root.dataset.enhanced = '';
  root.dataset.showcaseReady = '';
  show(index);
  revealHash();
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-showcase]').forEach(initShowcase);
