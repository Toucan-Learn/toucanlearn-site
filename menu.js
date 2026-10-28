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
  if (!target || target.id === 'team' || target.closest('[data-content-panel], [data-team-card]')) return;
  let moved = false;
  const stop = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, stop, { once: true, passive: true }));
  const align = () => { if (!moved) target.scrollIntoView({ block: 'start', behavior: 'instant' }); };
  addEventListener('load', () => {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { align(); setTimeout(align, 400); });
  }, { once: true });
})();

// Our team landing (owner, 28 Oct 2026): sit the section so its Book a free trial button is a few
// pixels off the bottom of the screen, without pushing the heading under the menu.
(() => {
  const section = document.getElementById('team');
  const end = section && section.querySelector('.framework-team-cta');
  if (!end) return;
  const head = section.querySelector('.eyebrow') || section;
  const header = document.querySelector('body > header');
  const landY = () => {
    const top = header ? header.getBoundingClientRect().bottom : 0;
    const byButton = scrollY + end.getBoundingClientRect().bottom - (innerHeight - 10);
    const byHeading = scrollY + head.getBoundingClientRect().top - top - 12;
    return Math.max(0, Math.min(byButton, byHeading));
  };
  const land = () => scrollTo({ top: landY(), behavior: 'instant' });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#team"], a[href="index.html#team"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    if (location.hash !== '#team') history.pushState(null, '', '#team');
    land();
  });
  if (location.hash === '#team') {
    let moved = false;
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, () => { moved = true; }, { once: true, passive: true }));
    const settle = () => { if (!moved) land(); };
    addEventListener('load', () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { settle(); setTimeout(settle, 400); }), { once: true });
  }
})();
