/* One switch for the launch pop-up. Existing page content is never changed. */
(() => {
  'use strict';
  const config = { active: true, spotsTotal: 5, closes: '2026-11-30' };
  function isActive(now = new Date()) {
    if (!config.active) return false;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}` <= config.closes;
  }
  window.LaunchOffer = { config, isActive };
  const page = window.location.pathname.split('/').pop();
  if (!isActive() || ['contact.html', 'thank-you.html'].includes(page)) return;

  const storageKey = 'toucan-launch-offer-last-shown';
  const rememberFor = 14 * 24 * 60 * 60 * 1000;
  function seenRecently() {
    try {
      const shownAt = Number(window.localStorage.getItem(storageKey));
      return shownAt > 0 && Date.now() - shownAt < rememberFor;
    } catch (_) { return false; }
  }
  if (seenRecently()) return;
  let triggered = false;
  let shown = false;
  let timer;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function disarm() {
    window.clearTimeout(timer);
    window.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('toggle', tryShow, true);
    document.removeEventListener('visibilitychange', tryShow);
  }
  function tryShow() {
    if (!triggered || shown) return;
    if (!isActive() || seenRecently()) { disarm(); return; }
    if (document.hidden || document.querySelector('details.mobile-menu[open], dialog[open]')) return;
    const dialog = element('dialog', 'launch-offer-dialog');
    if (typeof dialog.showModal !== 'function') { disarm(); return; }
    dialog.setAttribute('aria-labelledby', 'launch-offer-heading');
    dialog.setAttribute('aria-describedby', 'launch-offer-summary launch-offer-terms');
    const closeButton = element('button', 'launch-offer-dialog__close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close launch offer');
    const eyebrow = element('p', 'launch-offer-dialog__eyebrow', 'Launch offer');
    const heading = element('h2', 'launch-offer-dialog__heading', `The next ${config.spotsTotal} new learners get their first 3 sessions free`);
    heading.id = 'launch-offer-heading';
    const closes = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', day: 'numeric', month: 'long'
    }).format(new Date(`${config.closes}T12:00:00Z`));
    const summary = element('p', 'launch-offer-dialog__summary', `Book by ${closes}.`);
    summary.id = 'launch-offer-summary';
    const claim = element('a', 'button launch-offer-dialog__claim', 'Claim a free spot');
    claim.setAttribute('href', 'contact.html?offer=launch');
    // Carry the existing campaign attribution through this dynamically created link too.
    const params = new URLSearchParams(window.location.search);
    const target = new URL(claim.getAttribute('href'), window.location.href);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(key => {
      if (params.get(key)) target.searchParams.set(key, params.get(key).slice(0, 120));
    });
    claim.setAttribute('href', 'contact.html' + target.search);
    const later = element('button', 'launch-offer-dialog__later', 'Maybe later');
    later.type = 'button';
    const actions = element('div', 'launch-offer-dialog__actions');
    actions.append(claim, later);
    const terms = element('p', 'launch-offer-dialog__terms', 'New learners only, one per family. Sessions used within 6 weeks; after that, the agreed band applies.');
    terms.id = 'launch-offer-terms';
    dialog.append(closeButton, eyebrow, heading, summary, actions, terms);
    const previousFocus = document.activeElement;
    const close = () => dialog.close();
    closeButton.addEventListener('click', close);
    later.addEventListener('click', close);
    claim.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [closeButton, claim, later];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    shown = true;
    disarm();
    try { window.localStorage.setItem(storageKey, String(Date.now())); } catch (_) { /* Still once on this page if storage is unavailable. */ }
    claim.focus({ preventScroll: true });
  }
  function onScroll() {
    const roots = [document.scrollingElement, document.querySelector('.team-scroll')];
    if (roots.some(root => root && root.scrollHeight > root.clientHeight && root.scrollTop / (root.scrollHeight - root.clientHeight) > 0.4)) {
      triggered = true;
      tryShow();
    }
  }
  function arm() {
    timer = window.setTimeout(() => { triggered = true; tryShow(); }, 6000);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('toggle', tryShow, true);
    document.addEventListener('visibilitychange', tryShow);
  }
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
})();
