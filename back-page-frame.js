// Size enhanced back pages to the available window; keep natural small-screen flow.
(() => {
  const header = document.querySelector('body > header');
  const main = document.getElementById('main');
  if (!header || !main) return;
  const eligible = matchMedia('(min-width: 760px) and (min-height: 650px)');
  let frame = 0;
  let printing = false;
  function update() {
    frame = 0;
    const enhanced = main.querySelector('.framework-shell[data-enhanced], .team-deck-enhanced');
    const enabled = eligible.matches && !!enhanced && !printing;
    const headerHeight = header.getBoundingClientRect().height;
    document.body.style.setProperty('--back-page-header-height', `${headerHeight}px`);
    document.body.style.setProperty('--back-page-height', `${Math.max(0, innerHeight - headerHeight)}px`);
    document.body.toggleAttribute('data-page-frame', enabled);
    window.dispatchEvent(new Event('backpage:resize'));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  new ResizeObserver(schedule).observe(header);
  addEventListener('resize', schedule);
  eligible.addEventListener('change', schedule);
  addEventListener('beforeprint', () => { printing = true; update(); });
  addEventListener('afterprint', () => { printing = false; update(); });
  update();
  addEventListener('load', () => {
    if (!document.body.hasAttribute('data-page-frame') || !location.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
    if (target?.closest('[data-content-panel], [data-team-card]')) scrollTo({ top: 0, behavior: 'instant' });
  }, { once: true });
})();
