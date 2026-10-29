(function () {
  'use strict';

  // Owner, 29 Oct: text-only cards that turn only when asked (no autoplay, pause or drawings).
  const carousel = document.querySelector('[data-reviews-carousel]');
  if (!carousel) return;
  const ring = carousel.querySelector('.reviews-grid');
  const cards = Array.from(ring.querySelectorAll('.review-quote'));
  const count = cards.length;
  if (count < 3 || count > 8) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const laptop = window.matchMedia('(min-width: 900px)');
  const status = carousel.querySelector('[data-reviews-status]');
  let position = 0;
  let drag = null;
  let suppressClick = false;
  const modulo = value => ((value % count) + count) % count;
  const relative = index => {
    let delta = modulo(index - modulo(position));
    if (delta > count / 2) delta -= count;
    return delta;
  };

  cards.forEach((card, index) => {
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `Review ${index + 1} of ${count}`);
    card.tabIndex = 0;
  });

  function render() {
    // Layout width stays constant while the first card is angled at the side.
    const width = cards[0].offsetWidth || 400;
    const radius = Math.max(width * 1.15, (width + 32) / (2 * Math.tan(Math.PI / count)));
    carousel.classList.toggle('reviews-instant', motion.matches);
    ring.style.transform = laptop.matches ? `translateZ(${-radius}px) rotateY(${-position * 360 / count}deg)` : 'none';
    // Remove the previous equal height before measuring natural content again.
    // This allows shorter layouts after a wider resize or new font.
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
    status.textContent = `Review ${modulo(position) + 1} of ${count}`;
  }

  function turn(delta) {
    position += delta;
    render();
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
  ring.addEventListener('pointerdown', event => {
    if (laptop.matches || event.isPrimary === false || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    }
  });
  ring.addEventListener('pointercancel', () => { drag = null; });
  motion.addEventListener('change', render);
  laptop.addEventListener('change', render);
  carousel.classList.add('reviews-enhanced');
  render();
  if (document.fonts) {
    document.fonts.ready.then(render);
    document.fonts.addEventListener('loadingdone', render);
  }
  if ('ResizeObserver' in window) new window.ResizeObserver(render).observe(carousel);
  else window.addEventListener('resize', render);
})();
