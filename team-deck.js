/* Team-only adaptation of the existing Reviews 3D ring, 20261026-team-deck-2. */
(() => {
  'use strict';
  const interactive = 'a, button, input, textarea, select, video, audio, summary, [contenteditable]:not([contenteditable="false"])';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 900px)');
  document.querySelectorAll('[data-team-deck]').forEach(deck => {
    const stage = deck.querySelector('.team-deck-stage');
    const ring = deck.querySelector('.team-profiles');
    const cards = [...deck.querySelectorAll('[data-team-card]')];
    const previous = deck.querySelector('[data-team-prev]');
    const next = deck.querySelector('[data-team-next]');
    const status = deck.querySelector('[data-team-status]');
    if (!stage || !ring || cards.length < 2 || !previous || !next || !status) return;
    const count = cards.length;
    const names = cards.map(card => card.querySelector('h2').textContent.trim());
    const contents = cards.map(card => {
      const content = document.createElement('div');
      content.className = 'team-card-content';
      while (card.firstChild) content.append(card.firstChild);
      card.append(content);
      return content;
    });
    let position = 0;
    let gesture = null;
    let suppressClick = false;
    let lastWidth = 0;
    let initialising = true;
    let resizeFrame = 0;
    let printing = false;
    const modulo = value => ((value % count) + count) % count;
    const relative = index => {
      let delta = modulo(index - modulo(position));
      if (delta > count / 2) delta -= count;
      return delta;
    };
    deck.setAttribute('role', 'region');
    deck.setAttribute('aria-roledescription', 'carousel');
    deck.tabIndex = 0;
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    function render() {
      if (printing) return;
      const width = cards[0].offsetWidth;
      const radius = Math.max(width * .88, (width + 24) / (2 * Math.tan(Math.PI / count)));
      deck.classList.toggle('team-deck-instant', initialising || motion.matches);
      ring.style.transform = desktop.matches ? `translateZ(${-radius}px) rotateY(${-position * 360 / count}deg)` : 'none';
      let height = 0;
      cards.forEach((card, index) => {
        const delta = relative(index);
        const angle = delta * 360 / count;
        const neighbour = Math.abs(delta) === 1;
        const current = delta === 0;
        const visible = current || neighbour;
        const hinge = neighbour ? Math.max(-64, Math.min(64, angle)) - angle : 0;
        card.style.transform = desktop.matches
          ? `rotateY(${index * 360 / count}deg) translateZ(${radius}px) rotateY(${hinge}deg)`
          : `translateX(${delta * 108}%)`;
        card.style.opacity = visible ? '1' : '0';
        card.style.visibility = visible ? 'visible' : 'hidden';
        card.style.zIndex = String(count - Math.abs(delta));
        card.classList.toggle('is-current', current);
        card.toggleAttribute('data-neighbour', neighbour);
        card.inert = !visible;
        card.tabIndex = visible ? 0 : -1;
        card.setAttribute('role', current ? 'group' : 'button');
        card.setAttribute('aria-label', current ? `${names[index]}, ${index + 1} of ${count}` : `Show ${names[index]}`);
        if (current) {
          card.setAttribute('aria-current', 'true');
          card.setAttribute('aria-roledescription', 'slide');
        } else {
          card.removeAttribute('aria-current');
          card.removeAttribute('aria-roledescription');
        }
        // Side cards can be selected, but only the current biography is read or tabbed through.
        contents[index].inert = !current;
        contents[index].setAttribute('aria-hidden', String(!current));
        if (visible) card.removeAttribute('aria-hidden');
        else card.setAttribute('aria-hidden', 'true');
        // Measure the natural inner flow, never the equal-height outer card.
        // Computed height avoids perspective transforms and preserves subpixels.
        const contentHeight = parseFloat(getComputedStyle(contents[index]).height);
        const style = getComputedStyle(card);
        const verticalFrame = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
          .reduce((total, property) => total + parseFloat(style[property]), 0);
        height = Math.max(height, Math.ceil(contentHeight + verticalFrame));
      });
      ring.style.setProperty('--team-card-height', `${height}px`);
      ring.style.height = `${height}px`;
      status.textContent = `${modulo(position) + 1} of ${count}`;
    }
    function turn(delta, updateAddress = true) {
      const focusedCard = cards.find(card => card.contains(document.activeElement));
      if (focusedCard) deck.focus({preventScroll:true});
      position += delta;
      render();
      if (updateAddress) history.replaceState(null, '', `#${cards[modulo(position)].id}`);
      if (focusedCard) cards[modulo(position)].focus({preventScroll:true});
    }
    function revealHash() {
      let target;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
      const selected = cards.findIndex(card => card === target || card.contains(target));
      if (selected >= 0) turn(relative(selected), false);
    }
    previous.addEventListener('click', () => turn(-1));
    next.addEventListener('click', () => turn(1));
    cards.forEach((card, index) => {
      card.addEventListener('click', event => {
        if (suppressClick) { suppressClick = false; return; }
        if (event.target.closest(interactive) || String(getSelection() || '')) return;
        if (relative(index) !== 0) turn(relative(index));
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card || relative(index) === 0 || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        turn(relative(index));
      });
    });
    deck.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest(interactive)) return;
      const delta = {ArrowLeft:-1, ArrowRight:1, Home:-modulo(position), End:count - 1 - modulo(position)}[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      turn(delta);
    });
    // Manual swipe only. Reading a full biography never starts an automatic timer.
    stage.addEventListener('touchstart', event => {
      gesture = null;
      suppressClick = false;
      if (event.touches.length !== 1 || event.target.closest(interactive) || String(getSelection() || '')) return;
      const touch = event.touches[0];
      gesture = {x:touch.clientX, y:touch.clientY};
    }, {passive:true});
    stage.addEventListener('touchend', event => {
      if (!gesture || event.changedTouches.length !== 1 || String(getSelection() || '')) { gesture = null; return; }
      const touch = event.changedTouches[0];
      const x = touch.clientX - gesture.x;
      const y = touch.clientY - gesture.y;
      gesture = null;
      if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.6) {
        suppressClick = true;
        turn(x < 0 ? 1 : -1);
      }
    }, {passive:true});
    stage.addEventListener('touchcancel', () => { gesture = null; }, {passive:true});
    addEventListener('hashchange', revealHash);
    addEventListener('popstate', revealHash);
    motion.addEventListener('change', render);
    desktop.addEventListener('change', render);
    deck.classList.add('team-deck-enhanced', 'team-deck-instant');
    revealHash();
    render();
    ring.getBoundingClientRect();
    requestAnimationFrame(() => {
      initialising = false;
      deck.classList.toggle('team-deck-instant', motion.matches);
    });
    function scheduleResize() {
      if (resizeFrame || printing) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        render();
      });
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (Math.abs(width - lastWidth) < .5) return;
        lastWidth = width;
        scheduleResize();
      }).observe(stage);
      // Inner content stays naturally sized when outer cards are equalised,
      // so height changes here do not feed back from the imposed card height.
      const contentObserver = new ResizeObserver(scheduleResize);
      contents.forEach(content => contentObserver.observe(content));
    } else addEventListener('resize', render);
    if (document.fonts) document.fonts.ready.then(render);
    addEventListener('beforeprint', () => {
      printing = true;
      cards.forEach((card, index) => {card.inert=false;card.removeAttribute('aria-hidden');contents[index].inert=false;contents[index].removeAttribute('aria-hidden');});
    });
    addEventListener('afterprint', () => { printing = false; render(); });
  });
})();
