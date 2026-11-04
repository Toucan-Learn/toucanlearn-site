// Phone homepage, app layout (owner-approved mock v2, 4 Nov). Runs only at phone widths;
// on larger screens the block stays hidden and nothing here is started or fetched.
(() => {
  const root = document.querySelector('[data-app-home]');
  const phone = window.matchMedia('(max-width: 767px)');
  if (!root || !phone.matches) return;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* optional */ } };

  /* ---------- One fixed sky: gentle parallax and a wash that eases between section tones ---------- */
  const sky = $('[data-ah-sky]');
  const moods = $$('[data-mood]').map(el => ({ el, c: el.dataset.mood.split(',').map(Number) }));
  let skyQueued = false;
  const paintSky = () => {
    skyQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    if (!reduced) sky.style.transform = `translate3d(0, ${(-p * 0.2 * innerHeight).toFixed(1)}px, 0)`;
    const mid = innerHeight / 2;
    const centres = moods.map(m => { const r = m.el.getBoundingClientRect(); return r.top + r.height / 2; });
    const i = centres.findIndex(y => y > mid);
    let col;
    if (i === 0) col = moods[0].c;
    else if (i === -1) col = moods[moods.length - 1].c;
    else {
      const t = Math.min(1, Math.max(0, (mid - centres[i - 1]) / (centres[i] - centres[i - 1])));
      const s = t * t * (3 - 2 * t);
      col = moods[i - 1].c.map((v, k) => v + (moods[i].c[k] - v) * s);
    }
    sky.style.setProperty('--ah-mood', `rgba(${col.slice(0, 3).map(Math.round).join(',')},${col[3].toFixed(3)})`);
  };
  const queueSky = () => { if (!skyQueued) { skyQueued = true; requestAnimationFrame(paintSky); } };
  addEventListener('scroll', queueSky, { passive: true });
  addEventListener('resize', queueSky);
  paintSky();

  /* ---------- Project story cards: active card, dots, and the drink's real 3D turn ---------- */
  const track = $('[data-ah-track]');
  const slides = $$('[data-ah-slide]');
  const dots = $('[data-ah-dots]');
  dots.innerHTML = slides.map(() => '<i></i>').join('');
  const dotEls = $$('i', dots);
  let current = -1, projectsInView = false;
  const spin = slide => {
    // Frames are requested only on a phone, once the projects card is on screen and the drink is in front.
    if (reduced || slide.spinTimer || !projectsInView) return;
    const img = $('.ah-spin-frame', slide);
    const frames = slide.spinFrames || (slide.spinFrames = Array.from({ length: 60 }, (_, n) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = `${slide.dataset.ahSpin}${String(n * 6).padStart(3, '0')}.webp`;
      return im;
    }));
    let f = 0;
    slide.spinTimer = setInterval(() => {
      const next = frames[f % frames.length];
      if (next.complete && next.naturalWidth) { img.src = next.src; f++; }
    }, 80);
  };
  const stopSpin = slide => { clearInterval(slide.spinTimer); slide.spinTimer = null; };
  const syncSpin = () => slides.forEach((s, n) => s.dataset.ahSpin && (n === current && projectsInView ? spin(s) : stopSpin(s)));
  const setActive = i => {
    if (i === current) return;
    if (current !== -1) buzz(6);
    current = i;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
    dotEls.forEach((d, n) => d.classList.toggle('on', n === i));
    syncSpin();
  };
  const updateTrack = () => {
    const w = slides[0].getBoundingClientRect().width + 12;
    setActive(Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / w))));
  };
  track.addEventListener('scroll', () => requestAnimationFrame(updateTrack), { passive: true });
  updateTrack();
  new IntersectionObserver(([entry]) => { projectsInView = entry.isIntersecting; syncSpin(); }, { threshold: 0.25 })
    .observe($('#ah-projects'));

  /* ---------- EXAMPLE weekly report: swipeable card stack ---------- */
  const deck = $('[data-ah-deck]');
  const cards = $$('[data-ah-card]', deck);
  const deckDots = $('[data-ah-deck-dots]');
  deckDots.innerHTML = cards.map(() => '<i></i>').join('');
  const order = cards.map((_, i) => i);
  const layout = () => {
    order.forEach((ci, pos) => {
      const c = cards[ci];
      c.dataset.pos = pos;
      c.style.zIndex = String(10 - pos);
      c.style.transform = '';
      c.setAttribute('aria-hidden', pos ? 'true' : 'false');
    });
    $$('i', deckDots).forEach((d, n) => d.classList.toggle('on', n === order[0]));
  };
  const advance = (dir = -1) => {
    const top = cards[order[0]];
    top.classList.add('is-flying');
    top.style.transform = `translateX(${dir * 120}%) rotate(${dir * 14}deg)`;
    buzz(10);
    setTimeout(() => { top.classList.remove('is-flying'); order.push(order.shift()); layout(); }, reduced ? 0 : 320);
  };
  layout();
  $('[data-ah-deck-next]').addEventListener('click', () => advance(-1));
  let sx = 0, sy = 0, dx = 0, dragging = false, locked = null;
  deck.addEventListener('pointerdown', e => {
    sx = e.clientX; sy = e.clientY; dx = 0; dragging = true; locked = null;
    cards[order[0]].style.transition = 'none';
  });
  deck.addEventListener('pointermove', e => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!locked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (locked !== 'x') return;
    try { deck.setPointerCapture(e.pointerId); } catch (_) { /* already released */ }
    cards[order[0]].style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    const top = cards[order[0]];
    top.style.transition = '';
    if (locked === 'x' && Math.abs(dx) > 70) advance(Math.sign(dx));
    else top.style.transform = '';
  };
  deck.addEventListener('pointerup', endDrag);
  deck.addEventListener('pointercancel', endDrag);

  /* ---------- Bottom sheets ---------- */
  const bar = $('[data-ah-bar]');
  const scrim = $('[data-ah-scrim]');
  let openSheet = null, lastFocus = null;
  const showSheet = sheet => {
    if (openSheet) hideSheet(true);
    lastFocus = document.activeElement;
    openSheet = sheet;
    scrim.hidden = false; sheet.hidden = false;
    document.body.classList.add('homepage-sheet-open');
    updateBar();
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('is-on'); sheet.classList.add('is-on'); }));
    buzz(8);
    setTimeout(() => sheet.focus({ preventScroll: true }), reduced ? 0 : 380);
  };
  const hideSheet = instant => {
    const sheet = openSheet; if (!sheet) return;
    openSheet = null;
    sheet.classList.remove('is-on'); scrim.classList.remove('is-on');
    sheet.style.removeProperty('--ah-drag');
    document.body.classList.remove('homepage-sheet-open');
    const done = () => { sheet.hidden = true; if (!openSheet) scrim.hidden = true; updateBar(); };
    if (instant || reduced) done(); else setTimeout(done, 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  scrim.addEventListener('click', () => hideSheet());
  document.addEventListener('keydown', e => {
    if (!openSheet) return;
    if (e.key === 'Escape') { hideSheet(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the open sheet.
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])', openSheet).filter(el => el.offsetParent);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === openSheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $$('[data-ah-close]').forEach(b => b.addEventListener('click', () => hideSheet()));
  // Drag down from the top of a sheet to dismiss it.
  $$('.ah-sheet').forEach(sheet => {
    let y0 = null, dy = 0;
    sheet.addEventListener('pointerdown', e => {
      if (e.target.closest('input, button, a, label') || sheet.scrollTop > 0) return;
      y0 = e.clientY; dy = 0; sheet.classList.add('is-dragging');
    });
    sheet.addEventListener('pointermove', e => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.setProperty('--ah-drag', `${dy}px`);
    });
    const up = () => {
      if (y0 === null) return;
      y0 = null; sheet.classList.remove('is-dragging');
      if (dy > 90) hideSheet(); else sheet.style.removeProperty('--ah-drag');
    };
    sheet.addEventListener('pointerup', up);
    sheet.addEventListener('pointercancel', up);
  });

  /* ---------- Team: avatar -> bottom sheet ---------- */
  const teamSheet = $('[data-ah-team-sheet]');
  const tsPhoto = $('.ah-ts-photo', teamSheet);
  const tsImg = $('[data-ah-ts-img]', teamSheet);
  $('[data-ah-team]').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    const member = button.closest('li');
    const text = key => $(`[data-ah-${key}]`, member);
    tsPhoto.className = `ah-ring ah-ts-photo ${[...member.classList].find(c => c.startsWith('ah-av--'))}`;
    tsImg.src = $('img', member).currentSrc || $('img', member).src;
    tsImg.alt = text('name').textContent;
    $('[data-ah-ts-name]', teamSheet).textContent = text('name').textContent;
    $('[data-ah-ts-role]', teamSheet).textContent = text('role').textContent;
    const line = $('[data-ah-ts-line]', teamSheet);
    line.textContent = text('line').textContent;
    if (text('line').lang) line.lang = text('line').lang; else line.removeAttribute('lang');
    showSheet(teamSheet);
  });

  /* ---------- Booking sheet: the contact page's enquiry form and handler (contact.js) ---------- */
  const bookSheet = $('[data-ah-book-sheet]');
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-book]');
    if (!link || !root.contains(link) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    showSheet(bookSheet);
  });
  const contact = $('#reply-contact');
  contact.addEventListener('input', () => {
    // A phone keyboard once they start typing digits; the email keyboard otherwise.
    contact.inputMode = /^[+\d\s()-]{2,}$/.test(contact.value) ? 'tel' : 'email';
  });

  /* ---------- Sticky bar: after the hero button leaves view; never over the menu, sheets, dialogs or typing ---------- */
  const heroCta = $('[data-ah-hero-cta]');
  const finalCta = $('[data-ah-final-cta]');
  const seen = new Map();
  let typing = false;
  function updateBar() {
    const covered = openSheet || typing || document.querySelector('details.mobile-menu[open], dialog[open]');
    const on = !covered && seen.get(heroCta) === false && seen.get(finalCta) !== true;
    bar.classList.toggle('is-on', on);
    bar.setAttribute('aria-hidden', on ? 'false' : 'true');
    $$('a', bar).forEach(el => { el.tabIndex = on ? 0 : -1; });
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => seen.set(en.target, en.isIntersecting));
    updateBar();
  });
  io.observe(heroCta); io.observe(finalCta);
  new MutationObserver(updateBar).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true, childList: true });
  document.addEventListener('focusin', e => { typing = e.target.matches('input, textarea, select'); updateBar(); });
  document.addEventListener('focusout', () => { typing = false; setTimeout(updateBar, 0); });

  /* ---------- Menu links to long-form sections land on their phone cards ---------- */
  const phoneTargets = { '#team': '#ah-team', '#reviews': '#ah-reviews', '#support-routes': '#ah-routes', '#how-it-works': '#ah-report', '#contact': '#ah-routes' };
  const land = hash => {
    const target = phoneTargets[hash] && $(phoneTargets[hash]);
    if (!target) return false;
    target.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    return true;
  };
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || !phoneTargets[link.getAttribute('href')]) return;
    e.preventDefault();
    const menu = link.closest('details.mobile-menu');
    if (menu) menu.open = false;
    land(link.getAttribute('href'));
  }, true);
  const arrivedHash = location.hash;
  if (phoneTargets[arrivedHash]) addEventListener('load', () => setTimeout(() => land(arrivedHash), 450), { once: true });
})();
