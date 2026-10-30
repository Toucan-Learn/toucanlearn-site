/* Back pages: a left menu and one section at a time, 20261028-steady-1.
   Nothing is locked to the window height and nothing is split into hidden sub-pages, so the
   page looks the same at any zoom. Every section on a page shares the tallest section's height,
   so switching sections never makes the frame or its cells jump. A panel can still opt into
   swapping cells: its direct children marked data-section-page get Previous / Next controls,
   and each of those pages is shown at the same height too. */
(() => {
  'use strict';
  const body = document.body;
  const main = document.getElementById('main');
  const viewport = main && main.querySelector('.framework-panels');
  if (!viewport) return;
  const panels = [...viewport.querySelectorAll('[data-content-panel]')];
  const roomy = matchMedia('(min-width: 760px)');
  const carousels = new Map();
  // Numbered steps (01, 02...) read their number from data-frame-step.
  main.querySelectorAll('.learning-steps, .adult-lesson-steps').forEach(list => [...list.children].forEach((item, i) => { item.dataset.frameStep = String(i + 1).padStart(2, '0'); }));

  panels.forEach(panel => {
    const root = panel.querySelector(':scope > .approach-report') || panel;
    const pages = [...root.querySelectorAll(':scope > [data-section-page]')];
    if (pages.length < 2) return;
    const controls = document.createElement('nav');
    controls.className = 'framework-page-controls';
    controls.setAttribute('aria-label', 'Examples in this section');
    controls.innerHTML = '<button type="button">← Previous</button><span aria-live="polite" aria-atomic="true"></span><button type="button">Next →</button>';
    const [previous, status, next] = controls.children;
    pages[pages.length - 1].after(controls);
    const state = { pages, controls, previous, status, next, index: 0 };
    previous.addEventListener('click', () => show(state, state.index - 1, true));
    next.addEventListener('click', () => show(state, state.index + 1, true));
    carousels.set(panel, state);
  });

  function show(state, index, focus = false) {
    state.index = Math.max(0, Math.min(index, state.pages.length - 1));
    state.pages.forEach((page, i) => page.toggleAttribute('data-frame-hidden', i !== state.index));
    state.status.textContent = `${state.index + 1} of ${state.pages.length}`;
    state.previous.setAttribute('aria-disabled', String(state.index === 0));
    state.next.setAttribute('aria-disabled', String(state.index === state.pages.length - 1));
    state.pages[state.index].querySelectorAll('video, audio').forEach(media => media.pause());
    if (focus) {
      const heading = state.pages[state.index].querySelector('h3, h4');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  carousels.forEach(state => show(state, 0));

  // Measure every section (and every swapping page) on its own, then hold the frame at the
  // tallest. Runs synchronously, so nothing flashes on screen.
  let frame = 0;
  const layoutChanged = () => viewport.dispatchEvent(new CustomEvent('framework:layoutchange', { bubbles: true }));
  function equalise() {
    frame = 0;
    body.toggleAttribute('data-page-frame', roomy.matches);
    viewport.style.removeProperty('min-height');
    carousels.forEach(state => state.pages.forEach(page => page.style.removeProperty('min-height')));
    // Subjects keep the same frame when switching on phones too; its natural
    // minimum can grow with the copy, so the document still scrolls normally.
    if (!roomy.matches && !body.classList.contains('subjects-page')) { layoutChanged(); return; }
    const visible = panels.filter(panel => !panel.hidden);
    // Measure natural heights, not the height the page grid stretches the frame to.
    viewport.classList.add('is-measuring');
    const saved = panels.map(panel => [panel, panel.hidden, panel.inert]);
    let tallest = 0;
    panels.forEach(panel => {
      panels.forEach(other => { other.hidden = other !== panel; });
      const state = carousels.get(panel);
      if (state) {
        let page = 0;
        const keep = state.index;
        state.pages.forEach((item, i) => {
          show(state, i);
          page = Math.max(page, item.getBoundingClientRect().height);
        });
        state.pages.forEach(item => { item.style.minHeight = `${Math.ceil(page)}px`; });
        show(state, keep);
      }
      tallest = Math.max(tallest, viewport.getBoundingClientRect().height);
    });
    saved.forEach(([panel, hidden, inert]) => { panel.hidden = hidden; panel.inert = inert; });
    viewport.classList.remove('is-measuring');
    if (visible.length) viewport.style.minHeight = `${Math.ceil(tallest)}px`;
    layoutChanged();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(equalise); };

  main.addEventListener('framework:panelchange', event => {
    const state = carousels.get(event.detail.panel);
    if (state) {
      const target = event.detail.target;
      const page = target ? state.pages.findIndex(item => item === target || item.contains(target)) : -1;
      show(state, page < 0 ? 0 : page);
    }
  });
  window.addEventListener('resize', schedule);
  roomy.addEventListener('change', schedule);
  document.fonts?.ready.then(schedule);
  main.addEventListener('load', schedule, true);
  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('beforeprint', () => {
    body.removeAttribute('data-page-frame');
    viewport.style.removeProperty('min-height');
    carousels.forEach(state => state.pages.forEach(page => page.removeAttribute('data-frame-hidden')));
  });
  window.addEventListener('afterprint', () => { carousels.forEach(state => show(state, state.index)); schedule(); });
  equalise();
})();
