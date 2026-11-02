// Modules remain undiscovered until their existing artwork is near the viewport.
export function nearVisibility(selector, load) {
  const targets = [...document.querySelectorAll(selector)];
  if (!targets.length) return;
  let pending;
  const start = () => {
    if (pending) return pending;
    observer?.disconnect();
    pending = Promise.resolve(window.toucanStylesReady).then(load);
    // The still and ordinary links remain usable if an enhancement cannot load.
    pending.catch(() => {});
    return pending;
  };
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) start();
  }, { rootMargin: '300px' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (observer) targets.forEach(target => observer.observe(target));
    else start();
  }));
}
