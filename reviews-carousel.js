(function () {
  'use strict';

  // Approved decorative Toucan art only.
  const REVIEW_ART = {
    "b": "assets/art/review-b.png",
    "d": "assets/art/review-d.png",
    "f": "assets/art/review-f.png",
    "g": "assets/art/review-g.png",
    "h": "assets/art/review-h.png",
    "i": "assets/art/review-i.png",
    "j": "assets/art/review-j.png"
  };
  const carousel = document.querySelector('[data-reviews-carousel]');
  if (!carousel) return;
  const ring = carousel.querySelector('.reviews-grid');
  const cards = Array.from(ring.querySelectorAll('.review-quote'));
  const count = cards.length;
  if (count < 3 || count > 8) return;
  const keys = Object.keys(REVIEW_ART);
  const requested = (new URLSearchParams(window.location.search).get('reviewart') || '').split(',');
  const validOverride = requested.length === Math.min(count, keys.length) &&
    new Set(requested).size === requested.length && requested.every(key => keys.includes(key));
  let art = keys.slice();
  if (count !== keys.length) {
    // Fisher-Yates: distinct art before any reuse.
    for (let i = art.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [art[i], art[j]] = [art[j], art[i]];
    }
    if (validOverride) art = requested;
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const laptop = window.matchMedia('(min-width: 900px)');
  const pause = carousel.querySelector('[data-reviews-pause]');
  const status = carousel.querySelector('[data-reviews-status]');
  let position = 0;
  let timer = null;
  let hovered = false;
  let focused = false;
  let userPaused = false;
  let onScreen = false;
  let drag = null;
  let suppressClick = false;
  const modulo = value => ((value % count) + count) % count;
  const relative = index => {
    let delta = modulo(index - modulo(position));
    if (delta > count / 2) delta -= count;
    return delta;
  };

  // Retain the established distinct slot pairing and legacy ?reviewart= override.
  const chosen = cards.map(card => card.querySelector('[data-review-art]').getAttribute('data-review-art'));
  if (!validOverride && chosen.every(key => keys.includes(key)) && new Set(chosen).size === count) art = chosen;

  cards.forEach((card, index) => {
    const image = card.querySelector('[data-review-art]');
    image.src = REVIEW_ART[art[index % art.length]];
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `Review ${index + 1} of ${count}`);
    card.tabIndex = 0;
  });

  function schedule() {
    window.clearTimeout(timer);
    timer = null;
    if (!userPaused && !hovered && !focused && onScreen && !document.hidden && !motion.matches) {
      timer = window.setTimeout(() => { turn(1); }, 6000);
    }
  }

  function render() {
    // Layout width stays constant while the first card is angled at the side.
    const width = cards[0].offsetWidth || 400;
    const radius = Math.max(width * 1.15, (width + 32) / (2 * Math.tan(Math.PI / count)));
    carousel.classList.toggle('reviews-instant', motion.matches);
    ring.style.transform = laptop.matches ? `translateZ(${-radius}px) rotateY(${-position * 360 / count}deg)` : 'none';
    // Remove the previous equal height before measuring natural content again.
    // This allows shorter layouts after a wider resize, new font or image load.
    cards.forEach(card => { card.style.height = ''; });
    const height = Math.ceil(Math.max(...cards.map(card => card.offsetHeight)));
    cards.forEach(card => { card.style.height = `${height}px`; });
    cards.forEach((card, index) => {
      const delta = relative(index);
      const angle = delta * 360 / count;
      // With only three reviews, hinge the two neighbours towards the viewer;
      // their centres still occupy the regular 3D ring. Larger rings hide backs.
      const neighbour = Math.abs(delta) === 1;
      const visible = laptop.matches ? Math.abs(angle) <= 100 || neighbour : Math.abs(delta) <= 1;
      const hinge = neighbour ? Math.max(-64, Math.min(64, angle)) - angle : 0;
      card.style.transform = laptop.matches
        ? `rotateY(${index * 360 / count}deg) translateZ(${radius}px) rotateY(${hinge}deg)`
        : `translateX(${delta * 108}%)`;
      card.style.opacity = visible ? '1' : '0';
      card.style.pointerEvents = visible ? 'auto' : 'none';
      card.style.zIndex = String(count - Math.abs(delta));
      card.tabIndex = visible ? 0 : -1;
      card.classList.toggle('is-current', delta === 0);
      card.querySelector('blockquote').setAttribute('aria-hidden', String(delta !== 0));
      card.querySelector('figcaption').setAttribute('aria-hidden', String(delta !== 0));
      if (delta === 0) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
      // Keep visible side cards keyboard reachable, but their text out of AT.
      if (!visible) card.setAttribute('aria-hidden', 'true');
      else card.removeAttribute('aria-hidden');
    });
    ring.style.height = `${height}px`;
    pause.setAttribute('aria-label', userPaused ? 'Play reviews' : 'Pause reviews');
    pause.setAttribute('aria-pressed', String(userPaused));
    carousel.classList.toggle('reviews-paused', userPaused);
    status.textContent = `Review ${modulo(position) + 1} of ${count}`;
  }

  function turn(delta) {
    position += delta;
    render();
    schedule();
  }
  function select(index) { turn(relative(index)); }
  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      select(index);
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select(index);
      }
    });
  });
  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const cardHadFocus = cards.includes(document.activeElement);
    turn(event.key === 'ArrowRight' ? 1 : -1);
    if (cardHadFocus) cards[modulo(position)].focus({ preventScroll: true });
  });
  carousel.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    schedule();
  });
  carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = true; schedule(); });
  carousel.addEventListener('focusout', event => {
    focused = carousel.contains(event.relatedTarget);
    schedule();
  });
  pause.addEventListener('click', () => { userPaused = !userPaused; render(); schedule(); });
  ring.addEventListener('pointerdown', event => {
    if (laptop.matches || event.isPrimary === false || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    window.clearTimeout(timer);
  });
  ring.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.x) > 10 && Math.abs(event.clientX - drag.x) > Math.abs(event.clientY - drag.y)) {
      ring.setPointerCapture(event.pointerId);
    }
  });
  ring.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick = true;
      turn(dx < 0 ? 1 : -1);
    } else schedule();
  });
  ring.addEventListener('pointercancel', () => { drag = null; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { render(); schedule(); });
  laptop.addEventListener('change', render);
  carousel.classList.add('reviews-enhanced');
  render();
  cards.forEach(card => {
    const image = card.querySelector('[data-review-art]');
    image.addEventListener('load', render);
    image.addEventListener('error', render);
  });
  if (document.fonts) {
    document.fonts.ready.then(render);
    document.fonts.addEventListener('loadingdone', render);
  }
  if ('ResizeObserver' in window) new window.ResizeObserver(render).observe(carousel);
  else window.addEventListener('resize', render);
  if ('IntersectionObserver' in window) {
    new window.IntersectionObserver(entries => {
      onScreen = entries.some(entry => entry.isIntersecting);
      schedule();
    }, { threshold: 0 }).observe(carousel);
  } // Without visibility observation, manual controls still work; do not autoplay.
})();
