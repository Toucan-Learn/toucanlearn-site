// Turns, rather than frame numbers, keep motion independent of the render count.
const wrap = value => ((value % 1) + 1) % 1;
export const frameAt = (turns, count) => Math.round(wrap(turns) * count) % count;

export function spinMotion({ draw, clock = globalThis, reduced = false }) {
  const revolution = 16000;
  const idle = 6000;
  const decay = 240; // ms; exponential friction is independent of display refresh rate.
  let turns = 0;
  let velocity = 0;
  let dragging = false;
  let active = false;
  let frame = null;
  let wake = null;
  let last = 0;
  let moved = 0;
  let resumeAt = 0;
  let pausedAt = clock.Date.now();
  let destroyed = false;
  const now = () => clock.Date.now();
  const stop = () => {
    if (frame !== null) clock.cancelAnimationFrame(frame);
    if (wake !== null) clock.clearTimeout(wake);
    frame = wake = null;
  };
  function schedule() {
    stop();
    if (!active || destroyed || dragging || reduced) return;
    last = now();
    if (velocity || now() >= resumeAt) frame = clock.requestAnimationFrame(tick);
    else wake = clock.setTimeout(schedule, resumeAt - now());
  }
  function tick() {
    frame = null;
    if (!active || destroyed || dragging || reduced) return;
    const time = now();
    const elapsed = time - last;
    last = time;
    if (velocity) {
      const friction = Math.exp(-elapsed / decay);
      turns += velocity * decay * (1 - friction);
      velocity *= friction;
      if (Math.abs(velocity) < 0.000002) velocity = 0;
    } else if (time >= resumeAt) {
      turns += Math.min(elapsed, time - resumeAt) / revolution;
    }
    draw(turns);
    if (!velocity && time < resumeAt) schedule();
    else frame = clock.requestAnimationFrame(tick);
  }
  function interact() {
    velocity = 0;
    if (!active) pausedAt = now();
    resumeAt = now() + idle;
    schedule();
  }
  return {
    get state() { return { turns, velocity, dragging, active }; },
    setActive(value) {
      if (destroyed || value === active) return;
      active = value;
      if (active) { resumeAt += now() - pausedAt; schedule(); }
      else { pausedAt = now(); dragging = false; velocity = 0; stop(); }
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
      resumeAt = time + idle;
      draw(turns);
    },
    end(cancelled = false) {
      if (!dragging) return;
      dragging = false;
      // Holding still before release must not revive an old flick.
      if (cancelled || now() - moved > 100) velocity = 0;
      resumeAt = now() + idle;
      schedule();
    },
    step(deltaTurns) { if (destroyed) return; interact(); turns += deltaTurns; draw(turns); },
    destroy() { destroyed = true; active = dragging = false; velocity = 0; stop(); },
  };
}

export function progressiveFrames(count) {
  const indices = Array.from({ length: count }, (_, i) => i);
  return [...indices.filter(i => i % 4 === 0), ...indices.filter(i => i % 4 !== 0)];
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
  const image = document.createElement('img');
  image.src = `${base}poster.webp`;
  image.alt = '';
  image.draggable = false;
  image.width = 1200;
  image.height = 900;
  button.append(image);
  screen.replaceChildren(button);
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
  function draw() {
    if ((reduced && !interacted) || !manifest || !loaded.size) return;
    const target = frameAt(turns, manifest.frameCount);
    // A sparse first pass remains usable while the intermediate frames arrive.
    const distance = i => Math.min((i - target + manifest.frameCount) % manifest.frameCount, (target - i + manifest.frameCount) % manifest.frameCount);
    const nearest = loaded.has(target) ? target : [...loaded.keys()].sort((a, b) => distance(a) - distance(b))[0];
    const src = loaded.get(nearest).src;
    if (image.getAttribute('src') !== src) image.src = src;
    button.dataset.frame = String(nearest);
  }
  function cancelLoads() {
    manifestRequest?.abort();
    manifestRequest = null;
    for (const frame of pending.values()) {
      frame.onload = frame.onerror = null;
      frame.removeAttribute('src');
    }
    pending.clear();
  }
  function pump() {
    if (!allowed() || !manifest) return;
    // Finish the every-fourth-frame pass before requesting the fill pass.
    const coarse = order.filter(i => i % 4 === 0);
    const pass = coarse.some(i => !loaded.has(i) && !failed.has(i)) ? coarse : order;
    for (const i of pass) {
      if (pending.size >= 3) break;
      if (loaded.has(i) || pending.has(i) || failed.has(i)) continue;
      const frame = new Image();
      pending.set(i, frame);
      frame.onload = () => {
        if (disposed || pending.get(i) !== frame) return;
        pending.delete(i);
        loaded.set(i, frame);
        draw();
        pump();
      };
      frame.onerror = () => {
        if (disposed || pending.get(i) !== frame) return;
        pending.delete(i);
        failed.add(i);
        pump(); // Keep the poster/nearest good frame on partial render failure.
      };
      frame.src = `${base}${String(i).padStart(3, '0')}.webp`;
    }
  }
  async function prepare() {
    if (!allowed()) return;
    if (manifest) { pump(); return; }
    if (manifestRequest) return;
    const request = new AbortController();
    manifestRequest = request;
    try {
      const response = await fetch(`${base}manifest.json`, { signal: request.signal });
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
    pauseAuto() { motion.step(0); },
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
        image.src = `${base}poster.webp`;
        button.dataset.frame = '0';
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
      loaded.clear();
    },
  };
}
