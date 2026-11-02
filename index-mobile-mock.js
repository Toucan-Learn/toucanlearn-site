// Mock-only enhancement. Desktop continues to use the original homepage code.
(() => {
  const phone = matchMedia('(max-width: 700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = window.visualViewport;
  const offer = document.querySelector('.mobile-mock-offer');
  const bar = document.querySelector('.mobile-mock-bar');
  const footer = document.querySelector('.site-footer');
  const header = document.querySelector('body > header');
  const onlyPhone = [...document.querySelectorAll('[data-mobile-mock-only]')];
  const rows = [
    [document.querySelector('.audience-route-grid'), 'Who we help'],
    [document.querySelector('.reviews-grid'), 'Review'],
    [document.querySelector('.mobile-mock-subject-row'), 'Subject'],
  ].filter(([row]) => row);
  let scheduled = false;
  let fullHeight = window.innerHeight;
  const inView = element => {
    if (!element || !element.getClientRects().length) return false;
    const box = element.getBoundingClientRect();
    return box.top < (viewport?.height || innerHeight) && box.bottom > 0;
  };
  const keyboardOpen = () => document.activeElement?.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable="true"]')
    || (viewport && viewport.scale === 1 && fullHeight - viewport.height > 120);
  function syncBar() {
    scheduled = false;
    const pastFirstScreen = offer.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
    const formVisible = [...document.querySelectorAll('form, #enquiry-form')].some(inView);
    const covered = document.querySelector('details.mobile-menu[open], dialog[open]');
    bar.hidden = !phone.matches || !pastFirstScreen || inView(footer) || formVisible || keyboardOpen() || !!covered;
  }
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(syncBar); } };
  const dotSets = rows.map(([row, label]) => {
    row.dataset.mockSwipeRow = label;
    const cards = [...row.children].filter(card => card.matches('article, figure, a'));
    const dots = document.createElement('div');
    dots.className = 'mobile-mock-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', `${label} slides`);
    dots.hidden = true;
    const buttons = cards.map((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Show ${label.toLowerCase()} ${index + 1} of ${cards.length}`);
      button.addEventListener('click', () => {
        const left = row.scrollLeft + card.getBoundingClientRect().left - row.getBoundingClientRect().left;
        row.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
      });
      dots.append(button);
      return button;
    });
    row.after(dots);
    function updateDots() {
      if (!phone.matches) return;
      const left = row.getBoundingClientRect().left;
      const nearest = cards.reduce((best, card, index) => Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left) ? index : best, 0);
      buttons.forEach((button, index) => {
        if (index === nearest) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }
    let frame = false;
    row.addEventListener('scroll', () => {
      if (frame || !phone.matches) return;
      frame = true;
      requestAnimationFrame(() => { frame = false; updateDots(); });
    }, { passive: true });
    return { row, dots, cards, updateDots };
  });
  // Retain the desktop review ring. On phones the same review nodes become a
  // native scroll row; stop ring gestures without cancelling native scrolling
  // or the default action of the source links.
  const review = dotSets.find(set => set.row.matches('.reviews-grid'));
  function exposeReviews() {
    if (!phone.matches || !review) return;
    for (const card of review.cards) {
      card.querySelectorAll('[aria-hidden="true"]').forEach(node => node.removeAttribute('aria-hidden'));
      if (card.hasAttribute('aria-hidden')) card.removeAttribute('aria-hidden');
      if (card.tabIndex !== 0) card.tabIndex = 0;
    }
  }
  if (review) {
    const orbit = review.row.closest('[data-reviews-carousel]');
    ['pointerdown', 'pointermove', 'pointerup', 'click'].forEach(type => orbit.addEventListener(type, event => {
      if (phone.matches && review.row.contains(event.target)) event.stopImmediatePropagation();
    }, true));
    orbit.addEventListener('keydown', event => {
      if (!phone.matches || !review.row.contains(event.target)) return;
      event.stopImmediatePropagation();
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        review.row.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * review.cards[0].getBoundingClientRect().width, behavior: reduced.matches ? 'instant' : 'smooth' });
      }
    }, true);
    new MutationObserver(exposeReviews).observe(review.row, { subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'tabindex'] });
  }
  function syncMode() {
    onlyPhone.forEach(element => { if (element !== bar) element.hidden = !phone.matches; });
    dotSets.forEach(set => { set.dots.hidden = !phone.matches; set.updateDots(); });
    exposeReviews();
    fullHeight = Math.max(fullHeight, innerHeight);
    syncBar();
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(schedule);
    [offer, footer, ...document.querySelectorAll('form, #enquiry-form')].filter(Boolean).forEach(node => observer.observe(node));
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { fullHeight = Math.max(fullHeight, innerHeight); schedule(); dotSets.forEach(set => set.updateDots()); });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  document.addEventListener('toggle', schedule, true);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  phone.addEventListener('change', syncMode);
  document.addEventListener('DOMContentLoaded', syncMode, { once: true });
  Promise.resolve(window.toucanStylesReady).then(syncMode);
  syncMode();
})();
