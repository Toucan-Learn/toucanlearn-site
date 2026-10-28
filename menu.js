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
  if (!target) return;
  // Back pages fit one laptop screen: a link to a tab (or something inside it) lands at the top of
  // the page, exactly like a direct visit, instead of the browser jumping part-way down (owner, 28 Oct).
  if (target.closest('[data-content-panel]')) {
    const wide = window.matchMedia('(min-width: 1000px)');
    let touched = false;
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, () => { touched = true; }, { once: true, passive: true }));
    const top = () => { if (wide.matches && !touched) window.scrollTo({ top: 0, behavior: 'instant' }); };
    top();
    addEventListener('load', () => {
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { top(); setTimeout(top, 400); });
    }, { once: true });
    return;
  }
  if (target.closest('[data-team-card]')) return;
  let moved = false;
  const stop = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, stop, { once: true, passive: true }));
  const align = () => { if (!moved) target.scrollIntoView({ block: 'start', behavior: 'instant' }); };
  // Owner, 28 Oct 2026: keep the address bar clean (no #support-routes etc.) once we've landed.
  const clean = () => history.replaceState(history.state, '', location.pathname + location.search);
  addEventListener('load', () => {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { align(); setTimeout(() => { align(); clean(); }, 400); });
  }, { once: true });
})();

// Same-page section links (Who we help, Our approach, Our team, Reviews, skip link): scroll there
// without writing the #section into the address bar. Back-page panel links keep their own hashes.
(() => {
  const here = location.pathname.replace(/index\.html$/, '');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href*="#"]');
    if (!link || link.hasAttribute('data-panel-link') || link.closest('[data-content-panels]')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname.replace(/index\.html$/, '') !== here || url.search !== location.search || !url.hash) return;
    const id = decodeURIComponent(url.hash.slice(1));
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target || target.closest('[data-content-panel]')) return;
    event.preventDefault();
    if (id === 'top') window.scrollTo({ top: 0, behavior: calm.matches ? 'instant' : 'smooth' });
    else target.scrollIntoView({ block: 'start', behavior: calm.matches ? 'instant' : 'smooth' });
    if (id !== 'top') {
      if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, select, textarea')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  });
})();

// Same-page dropdown links to another tab (e.g. Our approach → Online while on Our approach):
// switch tab and stay at the top on laptop screens.
window.addEventListener('hashchange', () => {
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
  if (target && target.closest('[data-content-panel]') && window.matchMedia('(min-width: 1000px)').matches) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
});
