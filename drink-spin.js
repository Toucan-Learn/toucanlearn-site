// Turns, rather than frame numbers, keep motion independent of the render count.
const wrap = value => ((value % 1) + 1) % 1;
export const frameAt = (turns, count) => Math.round(wrap(turns) * count) % count;
export function frameBlend(turns, count) {
  const position = wrap(turns) * count;
  const lower = Math.floor(position);
  return { lower, upper: (lower + 1) % count, mix: position - lower };
}
const assetVersion = '20261031-skids-drops-1';

export function spinMotion({ draw, clock = globalThis, reduced = false, automatic = true, maxStep = () => Infinity }) {
  const revolution = 16000; // Clockwise from above (owner, 29 Oct, final): frames count up, the label travels right to left.
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
    if (!active || !automatic || destroyed || dragging || reduced) return;
    last = now();
    frame = clock.requestAnimationFrame(tick);
  }
  function tick() {
    frame = null;
    if (!active || !automatic || destroyed || dragging || reduced) return;
    const time = now();
    const elapsed = time - last;
    last = time;
    let delta;
    if (coasting) {
      // Ease towards the idle speed, never to a stop: a backwards flick swings round into the usual direction.
      const base = 1 / revolution;
      const friction = Math.exp(-elapsed / decay);
      delta = base * elapsed + (velocity - base) * decay * (1 - friction);
      velocity = base + (velocity - base) * friction;
      if (Math.abs(velocity - base) < 0.000002) { coasting = false; velocity = 0; }
    } else {
      delta = elapsed / revolution;
    }
    // The slow idle spin never skips a view on a late display tick; a flick coasts freely (owner: keep the inertia).
    const limit = coasting ? Infinity : maxStep();
    turns += Math.max(-limit, Math.min(limit, delta));
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
    setAutomatic(value) { if (value === automatic) return; automatic = value; interact(); },
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
      velocity = reduced || !automatic ? 0 : Math.max(-0.003, Math.min(0.003, deltaTurns / Math.max(16, time - moved)));
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
  const indices = Array.from({ length: count }, (_, i) => i);
  return [4, 2, 1].flatMap(step => indices.filter(i => i % step === 0 && (step === 4 || i % (step * 2) !== 0)));
}

function drinkImage(drink, file) {
  const image = new Image();
  image.alt = '';
  image.draggable = false;
  image.width = 1200;
  image.height = 900;
  image.dataset.drink = drink.id;
  // Firefox drops decoded views it is not painting; sync redecodes on paint
  // instead of showing nothing (owner, 29 Oct: drinks vanished on flicks).
  image.decoding = 'sync';
  image.fetchPriority = 'low';
  image.src = `assets/projects/drinks/${drink.id}/${file}?v=${assetVersion}`;
  return image;
}

// Both foreground loading and the optional warm-up use the same decoded nodes.
// Each drink keeps its sequence for the visit, so returning to it is instant.
// Keyed by clock: a page has one; isolated tests each bring their own.
const sequenceCaches = new WeakMap();
function sequencesFor(clock) {
  if (!sequenceCaches.has(clock)) sequenceCaches.set(clock, new Map());
  return sequenceCaches.get(clock);
}
function createFrameSequence(drink, clock) {
  const loaded = new Map(), pending = new Map(), failed = new Set();
  let manifest = null, order = [], coarse = [];
  let request = null, frame = null, task = null;
  let enabled = false, coarseOnly = false, concurrency = 6, notify = () => {};
  const idle = typeof clock.requestIdleCallback === 'function';
  // Turning starts once the first two seconds of views have decoded; the rest
  // load ahead of the idle spin (owner, 29 Oct: drinks sat frozen on load).
  const ready = () => manifest && coarse.slice(0, 12).every(i => loaded.has(i));
  const finished = () => manifest && (coarseOnly ? coarse : order).every(i => loaded.has(i) || failed.has(i));
  function cancelScheduled() {
    if (frame !== null) clock.cancelAnimationFrame(frame);
    if (task !== null) {
      if (idle) clock.cancelIdleCallback(task);
      else clock.clearTimeout(task);
    }
    frame = task = null;
  }
  function schedule() {
    if (!enabled || frame !== null || task !== null || request || pending.size >= concurrency || finished()) return;
    // Yield between even cached batches, keeping work out of project-switch tasks.
    frame = clock.requestAnimationFrame(() => {
      frame = null;
      const run = () => { task = null; void prepare(); };
      task = idle ? clock.requestIdleCallback(run, { timeout: 100 }) : clock.setTimeout(run, 0);
    });
  }
  function pump() {
    if (!enabled || !manifest) return;
    // Complete each resolution before starting the next, including pending decodes.
    const stage = [coarse, order.filter(i => i % 4 === 2), order.filter(i => i % 2 === 1)]
      .slice(0, coarseOnly ? 1 : 3).find(group => group.some(i => !loaded.has(i) && !failed.has(i)));
    for (const i of stage || []) {
      if (pending.size >= concurrency) break;
      if (loaded.has(i) || pending.has(i) || failed.has(i)) continue;
      const image = drinkImage(drink, `${String(i).padStart(3, '0')}.webp`);
      pending.set(i, image);
      image.decode().then(() => {
        if (pending.get(i) !== image) return;
        pending.delete(i);
        image.dataset.decoded = 'true';
        loaded.set(i, image);
        notify();
        schedule();
      }).catch(() => {
        if (pending.get(i) !== image) return;
        pending.delete(i);
        failed.add(i);
        schedule();
      });
    }
  }
  async function prepare() {
    if (!enabled) return;
    if (manifest) { pump(); return; }
    if (request) return;
    const controller = new AbortController();
    request = controller;
    try {
      const response = await fetch(`assets/projects/drinks/${drink.id}/manifest.json?v=${assetVersion}`, { signal: controller.signal, priority: 'low' });
      if (!response.ok) throw new Error('Unavailable frame manifest');
      const data = await response.json();
      if (!Number.isInteger(data.frameCount) || data.frameCount < 2 || data.frameCount > 1000 || ![-1, 1].includes(data.dragDirection ?? -1)) throw new Error('Invalid frame manifest');
      if (controller.signal.aborted) return;
      manifest = data;
      order = progressiveFrames(data.frameCount);
      coarse = order.filter(i => i % 4 === 0);
      notify();
      pump();
    } catch { /* A missing render leaves the poster and selector usable. */ }
    finally { if (request === controller) request = null; }
  }
  return {
    loaded,
    get manifest() { return manifest; },
    ready,
    start(options = {}) {
      enabled = true;
      coarseOnly = options.coarseOnly ?? false;
      concurrency = options.concurrency ?? 6;
      notify = options.notify ?? (() => {});
      failed.clear();
      schedule();
    },
    prepare,
    stop() {
      enabled = false;
      cancelScheduled();
      request?.abort(); request = null;
      for (const image of pending.values()) image.removeAttribute('src');
      pending.clear();
    },
  };
}

export function prefetchDrink(drink, { clock = globalThis, connection = globalThis.navigator?.connection } = {}) {
  let entry = null, frame = null, active = false;
  const constrained = () => connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType);
  return {
    setActive(value) {
      value = value && !constrained();
      if (active === value || entry?.claimed) return;
      active = value;
      if (!active) {
        if (frame !== null) clock.cancelAnimationFrame(frame);
        frame = null;
        entry?.sequence.stop();
        return;
      }
      // Two RAFs guarantee a first paint before the sequence's idle callback.
      frame = clock.requestAnimationFrame(() => {
        frame = clock.requestAnimationFrame(() => {
          frame = null;
          if (!entry) {
            entry = sequencesFor(clock).get(drink.id) || { sequence: createFrameSequence(drink, clock), claimed: false };
            sequencesFor(clock).set(drink.id, entry);
          }
          if (!entry.claimed) entry.sequence.start({ coarseOnly: true, concurrency: 3 });
        });
      });
    },
  };
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
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'drink-spin';
  button.setAttribute('aria-label', `Rotate ${drink.name}, 360° view`);
  button.dataset.frame = '0';
  button.dataset.active = 'false';
  button.dataset.ready = 'false';
  // Carry the last decoded pair across drink switches until the new poster is ready.
  // A project preview may precede the viewer. Carry the viewer's decoded pair,
  // never the preview (which has no children of its own).
  const previous = [...screen.children].find(child => child.className === 'drink-spin');
  if (previous) button.append(...previous.children);
  screen.replaceChildren(button);
  const poster = drinkImage(drink, 'poster.webp');
  let posterReady = false;
  let painted = false;
  const events = new AbortController();
  const entry = sequencesFor(clock).get(drink.id) || { sequence: createFrameSequence(drink, clock) };
  entry.claimed = true;
  sequencesFor(clock).set(drink.id, entry);
  const sequence = entry.sequence;
  // Transfer decoded views, then let viewer visibility/reduced motion own any work.
  sequence.stop();
  const loaded = sequence.loaded;
  let manifest = sequence.manifest;
  let active = false;
  let disposed = false;
  let interacted = false;
  let pointer = null;
  let x = 0;
  let turns = 0;
  let queuedSteps = 0;
  const allowed = () => active && (!reduced || interacted) && !disposed;
  const ready = sequence.ready;
  // Manual input is active immediately; automatic motion waits for the coarse quarter.
  const motion = spinMotion({ reduced, clock, automatic: false,
    maxStep: () => manifest ? (1 - 1e-9) / manifest.frameCount : 0,
    draw(value) { turns = value; draw(); } });
  function refreshFrames() {
    if (disposed) return;
    manifest = sequence.manifest;
    if (manifest) {
      button.dataset.frameCount = String(manifest.frameCount);
      if (queuedSteps) { motion.step(queuedSteps * (manifest.dragDirection ?? -1) / manifest.frameCount); queuedSteps = 0; }
    }
    button.dataset.ready = String(Boolean(ready()));
    motion.setAutomatic(Boolean(ready()));
    draw();
  }
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
    if (!manifest || (reduced && !interacted) || (!interacted && !ready())) return;
    // Bracket the angle with decoded views, across the seam as well as gaps.
    // Finer views replace these neighbours as they decode without changing turns.
    const position = wrap(turns) * manifest.frameCount;
    let lower, upper, first, second, behind = Infinity, ahead = Infinity;
    for (const [index, image] of loaded) {
      const back = (position - index + manifest.frameCount) % manifest.frameCount;
      const forward = (index - position + manifest.frameCount) % manifest.frameCount;
      if (back < behind) { behind = back; lower = index; first = image; }
      if (forward < ahead) { ahead = forward; upper = index; second = image; }
    }
    if (!first) return; // Hold the decoded poster/previous drink until a view exists.
    let mix = first === second ? 0 : behind / (behind + ahead);
    if (first === second) second = null;
    first.style.opacity = '1';
    if (second) second.style.opacity = String(mix);
    // Mount the decoded nodes themselves: assigning a new src could flash during decode.
    if (button.children[0] !== first || button.children[1] !== second) {
      button.replaceChildren(...(second ? [first, second] : [first]));
    }
    painted = true;
    button.dataset.frame = String(second && mix >= 0.5 ? upper : lower);
    button.dataset.lowerFrame = String(lower);
    button.dataset.upperFrame = String(second ? upper : lower);
    button.dataset.blend = String(second ? mix : 0);
  }
  function scheduleLoads() {
    if (!allowed()) return;
    sequence.start({ notify: refreshFrames });
    refreshFrames();
  }
  function cancelLoads() { sequence.stop(); }
  function prepare() {
    if (!allowed()) return;
    sequence.start({ notify: refreshFrames });
    refreshFrames();
    return sequence.prepare();
  }
  function interact() {
    interacted = true;
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
    interact();
  });
  on(button, 'pointermove', event => {
    if (event.pointerId !== pointer) return;
    const delta = event.clientX - x;
    x = event.clientX;
    if (delta) interact();
    // The supplied clockwise sequence moves the front label to the left.
    // 0.6: a full-width drag turns the drink about 0.6 of a revolution (owner: drag was a touch too powerful).
    motion.drag(0.6 * delta / Math.max(1, button.getBoundingClientRect().width) * (manifest?.dragDirection ?? -1));
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
      if (active) scheduleLoads();
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
      if (allowed()) scheduleLoads();
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
    },
  };
}
