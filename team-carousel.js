(function () {
  'use strict';
  // Round 89 (Joshua, 19 Oct 2026: "our team, which displays everyone, on a carousel"):
  // a sideways track of tutor cards. Swipe or scroll on phones; the arrows move one card.
  const carousel = document.querySelector('[data-team-carousel]');
  if (!carousel) return;
  const track = carousel.querySelector('.team-track');
  const previous = carousel.querySelector('[data-team-prev]');
  const next = carousel.querySelector('[data-team-next]');
  if (!track || !previous || !next) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function step() {
    const card = track.querySelector('.team-card');
    const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
    return card ? card.getBoundingClientRect().width + gap : track.clientWidth;
  }
  function update() {
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function move(direction) {
    track.scrollBy({ left: direction * step(), behavior: reduced.matches ? 'auto' : 'smooth' });
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
