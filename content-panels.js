/* Shared section navigation, 20261026-framework-1. */
(() => {
  'use strict';
  const pause = root => root.querySelectorAll('video, audio').forEach(media => media.pause());
  const hashTarget = () => {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch (_) { return null; }
  };
  document.querySelectorAll('[data-content-panels]').forEach(shell => {
    if (shell.hasAttribute('data-enhanced')) return;
    const panels = [...shell.querySelectorAll('[data-content-panel]')].filter(panel => panel.closest('[data-content-panels]') === shell);
    const links = [...shell.querySelectorAll('[data-panel-link]')];
    if (!panels.length || !links.length || panels.some(panel => !panel.id)) return;
    const linkPanel = link => {
      try {
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return null;
        return panels.find(panel => panel.id === decodeURIComponent(url.hash.slice(1))) || null;
      } catch (_) { return null; }
    };
    if (links.some(link => !linkPanel(link))) return;
    // The first menu item is the opening section, whatever order the panels sit in.
    const defaultPanel = panels.find(panel => panel.id === 'overview') || linkPanel(links[0]) || panels[0];
    const viewport = shell.querySelector('.framework-panels');
    if (viewport) {
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', 'Selected section');
    }
    let current;
    let scrollFrame;
    const show = (panel, target, options = {}) => {
      panels.forEach(candidate => {
        const inactive = candidate !== panel;
        if (inactive) pause(candidate);
        candidate.hidden = inactive;
        candidate.inert = inactive;
      });
      links.forEach(link => {
        if (linkPanel(link) === panel) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      current = panel;
      shell.dispatchEvent(new CustomEvent('framework:panelchange', { bubbles: true, detail: { panel, target } }));
      if (options.focus) {
        const heading = panel.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      }
      if (options.scroll && target) {
        cancelAnimationFrame(scrollFrame);
        scrollFrame = requestAnimationFrame(() => {
          if (document.body.hasAttribute('data-page-frame') && viewport) {
            const top = target === panel ? 0 : target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 20;
            viewport.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
          } else target.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
      }
    };
    const sync = (scroll = true) => {
      const target = hashTarget();
      const panel = target && panels.find(candidate => candidate === target || candidate.contains(target));
      // A cleaned URL or a restored page must retain its in-page selection.
      show(panel || current || defaultPanel, panel ? target : null, { scroll: scroll && !!panel });
    };
    // Initialize completely before enabling the CSS that hides the controls/panels.
    sync(!!location.hash);
    shell.setAttribute('data-enhanced', '');
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      let url;
      try { url = new URL(anchor.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      let target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) { return; }
      const panel = target && panels.find(candidate => candidate === target || candidate.contains(target));
      if (!panel) return;
      event.preventDefault();
      show(panel, target, { focus: links.includes(anchor), scroll: true });
      if (window.matchMedia('(min-width: 1000px)').matches) window.scrollTo({ top: 0, behavior: 'instant' });
    });
    window.addEventListener('hashchange', () => sync());
    window.addEventListener('popstate', () => sync());
    window.addEventListener('pageshow', () => sync(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(shell); });
    window.addEventListener('pagehide', () => pause(shell));
    window.addEventListener('beforeprint', () => { pause(shell); panels.forEach(panel => { panel.hidden = false; panel.inert = false; }); });
    window.addEventListener('afterprint', () => show(current || defaultPanel, hashTarget()));
  });
})();
