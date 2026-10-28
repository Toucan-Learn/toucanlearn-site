(() => {
  document.querySelectorAll('details.mobile-menu').forEach(menu => {
    const summary = menu.querySelector('summary');

    menu.addEventListener('click', event => {
      if (event.target.closest('a')) menu.open = false;
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        summary.focus();
      }
    });

    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });
})();

// Arriving on a #section link (e.g. Our team from another page): the browser jumps before the
// hero and fonts finish laying out, so the section ends up lower than intended. Re-align once
// the page has settled, unless the visitor has already started scrolling.
(() => {
  if (!location.hash) return;
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
  if (!target || target.closest('[data-content-panel], [data-team-card]')) return;
  let moved = false;
  const stop = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, stop, { once: true, passive: true }));
  const align = () => { if (!moved) target.scrollIntoView({ block: 'start', behavior: 'instant' }); };
  addEventListener('load', () => {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { align(); setTimeout(align, 400); });
  }, { once: true });
})();
