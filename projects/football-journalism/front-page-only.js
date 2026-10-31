// Owner, 31 Oct: only the front-page spread opens. The other stories and the section
// tabs stay on the page, to show how much he has written, but they don't click, and
// their text isn't shipped (scripts/patch-newspaper-front-page.mjs).
(() => {
  'use strict';
  const open = new Set(['hydration', 'leeds-newcastle', 'football-evolution']);
  const story = href => { try { return decodeURIComponent((href || '').match(/^#football\/(.+)$/)?.[1] ?? ''); } catch { return '?'; } };
  const closedLink = link => { const id = story(link.getAttribute('href')); return id !== '' && !open.has(id); };
  const closed = element => element.matches('.news-sections button') || (element.matches('a[href]') && closedLink(element));
  // Before the newspaper's own router sees the click or key.
  const stop = event => {
    const target = event.target.closest?.('a[href], button');
    if (!target || !closed(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('click', stop, true);
  document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') stop(event); }, true);
  // A typed or shared address for another story shows the front page instead.
  const guard = () => { if (story(location.hash) && !open.has(story(location.hash))) history.replaceState(history.state, '', location.pathname + location.search); };
  guard();
  window.addEventListener('hashchange', guard, true);
  window.addEventListener('popstate', guard, true);
  // React redraws the cards, so mark closed ones as they appear.
  const mark = () => document.querySelectorAll('.news-sections button, a[href^="#football/"]').forEach(element => {
    if (!closed(element) || element.dataset.closed) return;
    element.dataset.closed = '';
    element.setAttribute('aria-disabled', 'true');
    element.tabIndex = -1;
  });
  new MutationObserver(mark).observe(document.documentElement, { childList: true, subtree: true });
  mark();
})();
