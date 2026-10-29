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

// Keep fragment navigation in the page. Defer arrival cleanup until all deferred/module
// viewers have read the deep link and the original browser jump has settled.
(() => {
  const path = () => location.pathname.replace(/\/index\.html$/, '/');
  const clean = () => {
    const url = new URL(location.href);
    url.pathname = path();
    url.hash = '';
    // Attribution has already been captured; preserve the site's review/test overrides.
    const overrides = ['project', 'sky', 'reviewart', 'song', 'kids', 'adults', 'step1', 'step2', 'step3'];
    [...url.searchParams.keys()].forEach(key => { if (!overrides.includes(key)) url.searchParams.delete(key); });
    if (url.href !== location.href) history.replaceState(history.state, '', url.pathname + url.search);
  };
  if (path() !== location.pathname) history.replaceState(history.state, '', path() + location.search + location.hash);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targetFor = hash => {
    try {
      const id = decodeURIComponent(hash.slice(1));
      return id === 'top' ? document.body : document.getElementById(id);
    } catch (_) { return null; }
  };
  const align = (target, behavior = 'instant') => {
    if (!target) return;
    if (target.closest('[data-content-panel]')) {
      if (window.matchMedia('(min-width: 1000px)').matches) window.scrollTo({ top: 0, behavior });
    } else if (!target.closest('[data-team-card]')) {
      if (target === document.body) window.scrollTo({ top: 0, behavior });
      else target.scrollIntoView({ block: 'start', behavior });
    }
  };
  let moved = false;
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => addEventListener(type, () => { moved = true; }, { once: true, passive: true }));
  const initialHash = location.hash;
  addEventListener('load', () => {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      const initialTarget = targetFor(initialHash);
      if (!moved) align(initialTarget);
      clean();
      setTimeout(() => { if (!moved) align(initialTarget); }, 400);
    });
  }, { once: true });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href*="#"]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    let url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || url.pathname.replace(/\/index\.html$/, '/') !== path() || url.search !== location.search || !url.hash) return;
    const target = targetFor(url.hash);
    // The panel handler reveals hidden content and moves focus before scrolling.
    if (!target || target.closest('[data-content-panel]')) return;
    event.preventDefault();
    document.dispatchEvent(new CustomEvent('site:fragment', { detail: { target } }));
    align(target, calm.matches ? 'instant' : 'smooth');
    if (target !== document.body) {
      if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, select, textarea')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    clean();
  });
  // Legacy hash/history entries still select their destination before being cleaned.
  const arrived = () => {
    const target = targetFor(location.hash);
    requestAnimationFrame(() => { align(target); clean(); });
  };
  addEventListener('hashchange', arrived);
  addEventListener('popstate', arrived);
})();
