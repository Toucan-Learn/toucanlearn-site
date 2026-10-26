/* Manual team viewers and the original scrolling team track, 20261026-final-4. */
(() => {
  'use strict';
  const interactive = 'a, button, input, textarea, select, video, audio, summary, [contenteditable]:not([contenteditable="false"]), [role="slider"]';
  const pause = root => root.querySelectorAll('video, audio').forEach(media => media.pause());
  document.querySelectorAll('[data-profile-viewer]').forEach(viewer => {
    if (viewer.hasAttribute('data-enhanced')) return;
    const slides = [...viewer.querySelectorAll('[data-profile-slide]')].filter(slide => slide.closest('[data-profile-viewer]') === viewer);
    const previous = viewer.querySelector('[data-profile-prev]');
    const next = viewer.querySelector('[data-profile-next]');
    const status = viewer.querySelector('[data-profile-status]');
    if (!slides.length || !previous || !next || !status) return;
    const jumpLinks = [...document.querySelectorAll('[data-profile-link]')].filter(link =>
      slides.some(slide => slide.id && link.getAttribute('href') === `#${slide.id}`)
    );
    let index = 0;
    let gesture;
    if (!viewer.hasAttribute('tabindex')) viewer.tabIndex = 0;
    if (!viewer.hasAttribute('role')) viewer.setAttribute('role', 'region');
    if (!viewer.hasAttribute('aria-label') && !viewer.hasAttribute('aria-labelledby')) viewer.setAttribute('aria-label', 'Our team');
    viewer.setAttribute('aria-roledescription', 'carousel');
    previous.type = next.type = 'button';
    if (!previous.hasAttribute('aria-label')) previous.setAttribute('aria-label', 'Previous team member');
    if (!next.hasAttribute('aria-label')) next.setAttribute('aria-label', 'Next team member');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const show = requested => {
      index = (requested + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        if (position !== index) {
          if (slide.contains(document.activeElement)) viewer.focus({ preventScroll: true });
          pause(slide);
        }
        slide.hidden = position !== index;
      });
      status.textContent = `${index + 1} of ${slides.length}`;
      jumpLinks.forEach(link => {
        if (link.getAttribute('href') === `#${slides[index].id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      previous.disabled = next.disabled = slides.length < 2;
    };
    const revealHash = () => {
      let target;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
      const selected = slides.findIndex(slide => slide === target || (target && slide.contains(target)));
      if (selected >= 0) show(selected);
    };
    show(0);
    revealHash();
    viewer.setAttribute('data-enhanced', '');
    jumpLinks.forEach(link => link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const hash = link.getAttribute('href');
      const selected = slides.findIndex(slide => `#${slide.id}` === hash);
      if (location.hash !== hash) history.pushState(null, '', hash);
      show(selected);
      const heading = slides[selected].querySelector('h2, h3');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }));
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    viewer.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest(interactive)) return;
      const destination = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 }[event.key];
      if (destination === undefined) return;
      event.preventDefault();
      show(destination);
    });
    viewer.addEventListener('touchstart', event => {
      gesture = null;
      if (event.touches.length !== 1 || event.target.closest(interactive) || String(window.getSelection() || '')) return;
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    viewer.addEventListener('touchend', event => {
      if (!gesture || event.changedTouches.length !== 1 || String(window.getSelection() || '')) { gesture = null; return; }
      const touch = event.changedTouches[0];
      const x = touch.clientX - gesture.x;
      const y = touch.clientY - gesture.y;
      gesture = null;
      if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.6) show(index + (x < 0 ? 1 : -1));
    }, { passive: true });
    viewer.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('popstate', revealHash);
    document.addEventListener('framework:panelchange', event => {
      revealHash();
      if (!event.detail.panel.contains(viewer)) pause(viewer);
    });
    new MutationObserver(() => {
      if (viewer.closest('[hidden]')) pause(viewer);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(viewer); });
    window.addEventListener('pagehide', () => pause(viewer));
    window.addEventListener('beforeprint', () => { pause(viewer); slides.forEach(slide => { slide.hidden = false; }); });
    window.addEventListener('afterprint', () => show(index));
  });

  // Preserve the legacy team's native scrolling, scroll snapping and bounded arrows.
  document.querySelectorAll('[data-team-carousel]').forEach(carousel => {
    const track = carousel.querySelector('.team-track');
    const previous = carousel.querySelector('[data-team-prev]');
    const next = carousel.querySelector('[data-team-next]');
    if (!track || !previous || !next || carousel.hasAttribute('data-team-initialized')) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const step = () => {
      const card = track.querySelector('.team-card');
      const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth;
    };
    const update = () => {
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    const move = direction => track.scrollBy({ left: direction * step(), behavior: reduced.matches ? 'auto' : 'smooth' });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest(interactive)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    carousel.setAttribute('data-team-initialized', '');
    update();
  });
})();
