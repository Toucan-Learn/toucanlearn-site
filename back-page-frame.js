/* Keep desktop sections in one frame, with pages instead of nested scrolling. */
(() => {
  'use strict';
  const body = document.body;
  const header = document.querySelector('body > header');
  const main = document.getElementById('main');
  const footer = document.querySelector('body > footer');
  if (!header || !main || !footer) return;
  const isTeam = body.classList.contains('team-page');
  const eligible = matchMedia(isTeam
    ? '(min-width: 760px) and (min-height: 650px)'
    : '(min-width: 1100px) and (min-height: 760px)');
  const viewport = main.querySelector('.framework-panels');
  const panels = [...main.querySelectorAll('[data-content-panel]')];
  const groupSelector = '.learning-steps, .learning-formats, .learning-session, .report-parts, .framework-route-grid, .framework-benefits, .adult-topics, .adult-language-list, .adult-lesson-steps, .learning-subject-grid, .learning-languages';
  const states = new Map();
  let frame = 0, printing = false, controls, previous, next, status, active;

  if (viewport) {
    // The region is no longer a scroll target. Its links and page controls remain focusable.
    viewport.removeAttribute('tabindex');
    panels.forEach(panel => {
      const root = panel.querySelector(':scope > .approach-report') || panel;
      const explicit = [...root.querySelectorAll(':scope > [data-section-page]')];
      const units = [], groups = [];
      const collect = parent => {
        [...parent.children].forEach(node => {
          if (node.matches('.section-head, h3')) return;
          if (node.matches(groupSelector)) {
            groups.push(node);
            [...node.children].forEach((child, i) => {
              if (node.matches('.learning-steps, .adult-lesson-steps')) child.dataset.frameStep = String(i + 1).padStart(2, '0');
            });
            collect(node);
          } else units.push(node);
        });
      };
      if (explicit.length) units.push(...explicit);
      else collect(root);
      states.set(panel, { root, units, groups, explicit: !!explicit.length, pages: [], index: 0 });
    });
    controls = document.createElement('nav');
    controls.className = 'framework-page-controls';
    controls.setAttribute('aria-label', 'Section pages');
    controls.hidden = true;
    controls.innerHTML = '<button type="button" aria-label="Previous section page">← Previous</button><span aria-live="polite" aria-atomic="true"></span><button type="button" aria-label="Next section page">Next →</button>';
    [previous, status, next] = controls.children;
    viewport.append(controls);
  }

  const reveal = (state, units) => {
    const visible = new Set(units);
    state.units.forEach(unit => unit.toggleAttribute('data-frame-hidden', !visible.has(unit)));
    [...state.groups].reverse().forEach(group => {
      group.toggleAttribute('data-frame-hidden', !state.units.some(unit => visible.has(unit) && group.contains(unit)));
    });
  };
  const clear = () => {
    main.querySelectorAll('[data-frame-hidden]').forEach(node => node.removeAttribute('data-frame-hidden'));
    if (controls) controls.hidden = true;
  };
  const showPage = (state, index, focus = false) => {
    state.index = Math.max(0, Math.min(index, state.pages.length - 1));
    reveal(state, state.pages[state.index]);
    controls.hidden = state.pages.length < 2;
    status.textContent = `Page ${state.index + 1} of ${state.pages.length}`;
    // Keep the activated button focusable at either end of the sequence.
    previous.setAttribute('aria-disabled', String(state.index === 0));
    next.setAttribute('aria-disabled', String(state.index === state.pages.length - 1));
    if (focus) {
      const heading = state.pages[state.index][0]?.querySelector('h3') || active.querySelector('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  };
  function paginate(target) {
    if (!viewport) return;
    active = panels.find(panel => !panel.hidden);
    const state = states.get(active);
    if (!state) return;
    const chooseTarget = pages => target && target !== active
      ? pages.findIndex(items => items.some(unit => unit === target || unit.contains(target) || target.contains(unit))) : -1;
    if (state.explicit) {
      state.pages = state.units.map(unit => [unit]);
      const page = chooseTarget(state.pages);
      const index = page < 0 ? state.index : page;
      // Reserve the tallest carousel page so the frame and controls never jump.
      state.root.style.removeProperty('--section-page-height');
      let tallestPage = 0;
      state.pages.forEach(items => {
        reveal(state, items);
        tallestPage = Math.max(tallestPage, items[0].getBoundingClientRect().height);
      });
      state.root.style.setProperty('--section-page-height', `${Math.ceil(tallestPage)}px`);
      if (body.hasAttribute('data-page-frame')) {
        const css = getComputedStyle(viewport);
        const room = viewport.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
        viewport.style.setProperty('--frame-media-height', `${Math.max(140, room - 210)}px`);
        controls.hidden = false;
        const available = room - controls.getBoundingClientRect().height;
        const fits = state.pages.every(items => {
          reveal(state, items);
          return active.getBoundingClientRect().height <= available + 1;
        });
        if (!fits) body.removeAttribute('data-page-frame');
      }
      showPage(state, index);
      return;
    }
    if (!body.hasAttribute('data-page-frame')) return;
    reveal(state, state.units);
    controls.hidden = true;
    const css = getComputedStyle(viewport);
    const room = viewport.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    const heading = state.root.querySelector(':scope > .section-head');
    viewport.style.setProperty('--frame-media-height', `${Math.max(160, room - (heading?.getBoundingClientRect().height || 0) - 125)}px`);
    const height = () => active.getBoundingClientRect().height;
    if (height() <= room + 1) {
      state.pages = [state.units];
      showPage(state, 0);
      return;
    }
    controls.hidden = false;
    const available = room - controls.getBoundingClientRect().height;
    const pages = [];
    let page = [];
    for (const unit of state.units) {
      reveal(state, [...page, unit]);
      if (page.length && height() > available + 1) {
        pages.push(page);
        page = [unit];
        reveal(state, page);
      } else page.push(unit);
      // At large text sizes, prefer normal document flow to clipping any content.
      if (height() > available + 1) {
        body.removeAttribute('data-page-frame');
        clear();
        return;
      }
    }
    if (page.length) pages.push(page);
    state.pages = pages;
    const targetPage = target && target !== active
      ? pages.findIndex(items => items.some(unit => unit === target || unit.contains(target) || target.contains(unit))) : -1;
    showPage(state, targetPage < 0 ? state.index : targetPage);
  }
  function update(target) {
    frame = 0;
    const enhanced = main.querySelector('.framework-shell[data-enhanced], .team-deck-enhanced');
    const enabled = eligible.matches && !!enhanced && !printing;
    body.toggleAttribute('data-page-frame', enabled);
    const headerHeight = header.getBoundingClientRect().height;
    const footerHeight = footer.getBoundingClientRect().height;
    body.style.setProperty('--back-page-header-height', `${headerHeight}px`);
    body.style.setProperty('--back-page-footer-height', `${footerHeight}px`);
    body.style.setProperty('--back-page-height', `${Math.max(0, innerHeight - headerHeight - footerHeight)}px`);
    states.forEach(state => {
      state.root.style.removeProperty('--section-page-height');
    });
    clear();
    if (!printing) paginate(target);
    window.dispatchEvent(new Event('backpage:resize'));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => update());
  }
  const move = direction => {
    const state = states.get(active);
    if (!state || (!state.explicit && !body.hasAttribute('data-page-frame'))) return;
    const index = state.index + direction;
    if (index < 0 || index >= state.pages.length) return;
    active.querySelectorAll('video, audio').forEach(media => media.pause());
    showPage(state, index);
  };
  previous?.addEventListener('click', () => move(-1));
  next?.addEventListener('click', () => move(1));
  main.addEventListener('framework:panelchange', event => {
    const state = states.get(event.detail.panel);
    if (state && event.detail.target === event.detail.panel) state.index = 0;
    update(event.detail.target);
  });
  new ResizeObserver(schedule).observe(header);
  new ResizeObserver(schedule).observe(footer);
  window.addEventListener('resize', schedule);
  eligible.addEventListener('change', schedule);
  document.fonts?.ready.then(schedule);
  main.addEventListener('load', schedule, true);
  window.addEventListener('beforeprint', () => { printing = true; update(); });
  window.addEventListener('afterprint', () => { printing = false; update(); });
  let initialTarget;
  try { initialTarget = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) {}
  update(initialTarget);
  window.addEventListener('load', () => {
    update(initialTarget);
    if (body.hasAttribute('data-page-frame') && initialTarget?.closest('[data-content-panel], [data-team-card]')) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, { once: true });
})();
