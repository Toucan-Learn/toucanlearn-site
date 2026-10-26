/* Manual project viewer, 20261026-framework-1. */
(() => {
  'use strict';
  const interactive = 'a, button, input, textarea, select, video, audio, summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [data-screenshot-gallery]';
  const pause = root => root.querySelectorAll('video, audio').forEach(media => media.pause());
  document.querySelectorAll('[data-project-viewer]').forEach(viewer => {
    if (viewer.hasAttribute('data-enhanced')) return;
    const slides = [...viewer.querySelectorAll('[data-project-slide]')].filter(slide => slide.closest('[data-project-viewer]') === viewer);
    const previous = viewer.querySelector('[data-project-prev]');
    const next = viewer.querySelector('[data-project-next]');
    const status = viewer.querySelector('[data-project-status]');
    if (!slides.length || !previous || !next || !status) return;
    let index = 0;
    let gesture;
    if (!viewer.hasAttribute('tabindex')) viewer.tabIndex = 0;
    if (!viewer.hasAttribute('role')) viewer.setAttribute('role', 'region');
    if (!viewer.hasAttribute('aria-label') && !viewer.hasAttribute('aria-labelledby')) viewer.setAttribute('aria-label', 'Learner projects');
    viewer.setAttribute('aria-roledescription', 'carousel');
    previous.type = next.type = 'button';
    if (!previous.hasAttribute('aria-label')) previous.setAttribute('aria-label', 'Previous project');
    if (!next.hasAttribute('aria-label')) next.setAttribute('aria-label', 'Next project');
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
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    viewer.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest(interactive)) return;
      const destination = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 }[event.key];
      if (destination === undefined) return;
      event.preventDefault();
      show(destination);
    });
    // Keep vertical page scrolling, selected text and native media controls untouched.
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
    // Also covers an owner hiding this viewer independently of the section controller.
    new MutationObserver(() => {
      if (viewer.closest('[hidden]')) pause(viewer);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(viewer); });
    window.addEventListener('pagehide', () => pause(viewer));
    window.addEventListener('beforeprint', () => { pause(viewer); slides.forEach(slide => { slide.hidden = false; }); });
    window.addEventListener('afterprint', () => show(index));
  });
})();
