// Turns, rather than frame numbers, keep motion independent of the render count.
const wrap = value => ((value % 1) + 1) % 1;
export const frameAt = (turns, count) => Math.round(wrap(turns) * count) % count;
export function frameBlend(turns, count) {
  const position = wrap(turns) * count;
  const lower = Math.floor(position);
  return { lower, upper: (lower + 1) % count, mix: position - lower };
}
const assetVersion = '20261029-smooth-1';

export function spinMotion({ draw, clock = globalThis, reduced = false }) {
  const revolution = -16000; // Negative: the idle turn runs the other way round (owner's call).
  const decay = 600; // ms; a flick eases back to the idle spin, independent of display refresh rate.
  let turns = 0;
  let velocity = 0;
  let coasting = false;
  let dragging = false;
  let active = false;
  let frame = null;
  let last = 0;
  let moved = 0;
  let destroyed = false;
  const now = () => clock.Date.now();
  const stop = () => {
    if (frame !== null) clock.cancelAnimationFrame(frame);
    frame = null;
  };
  function schedule() {
    stop();
    if (!active || destroyed || dragging || reduced) return;
    last = now();
    frame = clock.requestAnimationFrame(tick);
  }
  function tick() {
    frame = null;
    if (!active || destroyed || dragging || reduced) return;
    const time = now();
    const elapsed = time - last;
    last = time;
    if (coasting) {
      // Ease towards the idle speed, never to a stop: a backwards flick swings round into the usual direction.
      const base = 1 / revolution;
      const friction = Math.exp(-elapsed / decay);
      turns += base * elapsed + (velocity - base) * decay * (1 - friction);
      velocity = base + (velocity - base) * friction;
      if (Math.abs(velocity - base) < 0.000002) { coasting = false; velocity = 0; }
    } else {
      turns += elapsed / revolution;
    }
    draw(turns);
    frame = clock.requestAnimationFrame(tick);
  }
  function interact() {
    velocity = 0;
    coasting = false;
    schedule();
  }
  return {
    get state() { return { turns, velocity, dragging, active }; },
    setActive(value) {
      if (destroyed || value === active) return;
      active = value;
      if (active) schedule();
      else { dragging = false; velocity = 0; coasting = false; stop(); }
    },
    setReduced(value) { reduced = value; interact(); },
    begin() {
      if (!active || destroyed) return;
      dragging = true;
      moved = now();
      interact();
    },
    drag(deltaTurns) {
      if (!active || !dragging || destroyed) return;
      const time = now();
      turns += deltaTurns;
      velocity = reduced ? 0 : Math.max(-0.003, Math.min(0.003, deltaTurns / Math.max(16, time - moved)));
      moved = time;
      draw(turns);
    },
    end(cancelled = false) {
      if (!dragging) return;
      dragging = false;
      // Holding still before release must not revive an old flick.
      if (cancelled || now() - moved > 100) velocity = 0;
      coasting = velocity !== 0;
      schedule();
    },
    step(deltaTurns) { if (destroyed) return; interact(); turns += deltaTurns; draw(turns); },
    destroy() { destroyed = true; active = dragging = coasting = false; velocity = 0; stop(); },
  };
}

export function progressiveFrames(count) {
  // Decode adjacent views first in both directions, including the 119 -> 000 seam.
  return [...new Set(Array.from({ length: count }, (_, i) => [i, (count - i) % count]).flat())];
}

export function renderDrinkInfo(card, drink) {
  card.className = 'drink-info';
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-atomic', 'true');
  const name = document.createElement('strong');
  name.textContent = drink.name;
  const line = document.createElement('p');
  line.textContent = drink.lines.join(' · ');
  card.replaceChildren(name, line);
}

// One instance owns one drink. Disposal cancels its manifest and preload queue.
export function createDrinkSpin(screen, drink, { reduced = false, activity = () => {}, clock = globalThis } = {}) {
  const base = `assets/projects/drinks/${drink.id}/`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'drink-spin';
  button.setAttribute('aria-label', `Rotate ${drink.name}, 360° view`);
  button.dataset.frame = '0';
  button.dataset.active = 'false';
  // Carry the last decoded pair across drink switches until the new poster is ready.
  const previous = screen.children[0];
  if (previous) button.append(...previous.children);
  screen.replaceChildren(button);
  const url = file => `${base}${file}?v=${assetVersion}`;
  function newImage(file) {
    const image = new Image();
    image.alt = '';
    image.draggable = false;
    image.width = 1200;
    image.height = 900;
    image.dataset.drink = drink.id;
    image.src = url(file);
    return image;
  }
  const poster = newImage('poster.webp');
  let posterReady = false;
  let painted = false;
  const events = new AbortController();
  const loaded = new Map();
  const pending = new Map();
  const failed = new Set();
  let manifestRequest = null;
  let manifest = null;
  let order = [];
  let active = false;
  let disposed = false;
  let interacted = false;
  let pointer = null;
  let x = 0;
  let turns = 0;
  let queuedSteps = 0;
  const allowed = () => active && (!reduced || interacted) && !disposed;
  const motion = spinMotion({ reduced, clock, draw(value) { turns = value; draw(); } });
  function showPoster() {
    if (!posterReady || disposed) return;
    poster.style.opacity = '1';
    button.replaceChildren(poster);
    button.dataset.frame = '0';
    button.dataset.lowerFrame = button.dataset.upperFrame = '0';
    button.dataset.blend = '0';
  }
  poster.decode().then(() => {
    if (disposed) return;
    posterReady = true;
    poster.dataset.decoded = 'true';
    if (!painted) showPoster();
  }).catch(() => { /* Keep the previous decoded drink on a failed poster. */ });
  function draw() {
    button.dataset.turns = String(turns);
    if ((reduced && !interacted) || !manifest) return;
    const { lower, upper, mix } = frameBlend(turns, manifest.frameCount);
    const first = loaded.get(lower);
    const second = loaded.get(upper);
    // Hold the exact last good composition until BOTH adjacent images have decoded.
    if (!first || (mix > 0 && !second)) { pump(); return; }
    first.style.opacity = '1';
    if (second) second.style.opacity = String(mix);
    // Mount the decoded nodes themselves: assigning a new src could flash during decode.
    if (button.children[0] !== first || button.children[1] !== second) {
      button.replaceChildren(...(second ? [first, second] : [first]));
    }
    painted = true;
    button.dataset.frame = String(frameAt(turns, manifest.frameCount));
    button.dataset.lowerFrame = String(lower);
    button.dataset.upperFrame = String(second ? upper : lower);
    button.dataset.blend = String(second ? mix : 0);
  }
  function cancelLoads() {
    manifestRequest?.abort();
    manifestRequest = null;
    for (const frame of pending.values()) frame.removeAttribute('src');
    pending.clear();
  }
  function pump() {
    if (!allowed() || !manifest) return;
    const { lower, upper } = frameBlend(turns, manifest.frameCount);
    for (const i of new Set([lower, upper, ...order])) {
      if (pending.size >= 3) break;
      if (loaded.has(i) || pending.has(i) || failed.has(i)) continue;
      const frame = newImage(`${String(i).padStart(3, '0')}.webp`);
      pending.set(i, frame);
      frame.decode().then(() => {
        if (disposed || pending.get(i) !== frame) return;
        pending.delete(i);
        frame.dataset.decoded = 'true';
        loaded.set(i, frame);
        draw();
        pump();
      }).catch(() => {
        if (disposed || pending.get(i) !== frame) return;
        pending.delete(i);
        failed.add(i);
        pump();
      });
    }
  }
  async function prepare() {
    if (!allowed()) return;
    if (manifest) { pump(); return; }
    if (manifestRequest) return;
    const request = new AbortController();
    manifestRequest = request;
    try {
      const response = await fetch(url('manifest.json'), { signal: request.signal });
      if (!response.ok) throw new Error('Unavailable frame manifest');
      const data = await response.json();
      if (!Number.isInteger(data.frameCount) || data.frameCount < 2 || data.frameCount > 1000 || ![-1, 1].includes(data.dragDirection ?? -1)) throw new Error('Invalid frame manifest');
      if (disposed || request.signal.aborted) return;
      manifest = data;
      button.dataset.frameCount = String(data.frameCount);
      order = progressiveFrames(data.frameCount);
      if (queuedSteps) { motion.step(queuedSteps * (data.dragDirection ?? -1) / data.frameCount); queuedSteps = 0; }
      pump();
    } catch { /* A missing render leaves a usable poster and drink selector. */ }
    finally { if (manifestRequest === request) manifestRequest = null; }
  }
  function interact(rotate = true) {
    interacted ||= rotate;
    activity();
    void prepare();
  }
  function finish(cancelled = false) {
    if (pointer === null) return;
    const id = pointer;
    pointer = null;
    delete button.dataset.dragging;
    motion.end(cancelled);
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    activity();
  }
  const on = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  on(button, 'pointerdown', event => {
    if (!active || pointer !== null || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    x = event.clientX;
    button.setPointerCapture(pointer);
    button.dataset.dragging = '';
    motion.begin();
    interact(false);
  });
  on(button, 'pointermove', event => {
    if (event.pointerId !== pointer) return;
    const delta = event.clientX - x;
    x = event.clientX;
    if (delta) interact();
    // The supplied clockwise sequence moves the front label to the left.
    motion.drag(delta / Math.max(1, button.getBoundingClientRect().width) * (manifest?.dragDirection ?? -1));
    activity();
  });
  on(button, 'pointerup', event => { if (event.pointerId === pointer) finish(); });
  on(button, 'pointercancel', event => { if (event.pointerId === pointer) finish(true); });
  on(button, 'lostpointercapture', event => { if (event.pointerId === pointer) finish(true); });
  on(window, 'blur', () => finish(true));
  on(button, 'focus', () => { if (active) motion.step(0); });
  on(button, 'keydown', event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    interact();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    if (manifest) motion.step(direction * (manifest.dragDirection ?? -1) / manifest.frameCount);
    else { queuedSteps += direction; motion.step(0); }
  });
  return {
    setActive(value) {
      if (disposed || value === active) return;
      if (!value) finish(true);
      active = value;
      button.dataset.active = String(active);
      motion.setActive(active);
      if (active) void prepare();
      else cancelLoads();
    },
    setReduced(value) {
      reduced = value;
      motion.setReduced(value);
      if (reduced && !interacted) {
        motion.step(-motion.state.turns);
        painted = false;
        showPoster();
      }
      if (allowed()) void prepare();
      else cancelLoads();
    },
    isDragging: () => pointer !== null,
    destroy() {
      finish(true);
      disposed = true;
      button.dataset.active = 'false';
      motion.destroy();
      events.abort();
      cancelLoads();
      if (!posterReady) poster.removeAttribute('src');
      loaded.clear();
    },
  };
}
