// Toucan Learn app-style phone homepage — PROTOTYPE (unlinked, noindex).
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

  /* ---------- One fixed sky: gentle parallax + a mood wash that eases between sections ---------- */
  const sky = $('#sky');
  const moods = $$('[data-mood]').map((el) => ({ el, c: el.dataset.mood.split(',').map(Number) }));
  let ticking = false;
  const paintSky = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    if (!reduced) sky.style.transform = `translate3d(0, ${(-p * 0.2 * innerHeight).toFixed(1)}px, 0)`;
    // Smoothly blend the tones of the two sections either side of the viewport's middle.
    const mid = innerHeight / 2;
    const centres = moods.map((m) => { const r = m.el.getBoundingClientRect(); return r.top + r.height / 2; });
    const i = centres.findIndex((y) => y > mid);
    let col;
    if (i === 0) col = moods[0].c;
    else if (i === -1) col = moods[moods.length - 1].c;
    else {
      const t = Math.min(1, Math.max(0, (mid - centres[i - 1]) / (centres[i] - centres[i - 1])));
      const s = t * t * (3 - 2 * t);
      col = moods[i - 1].c.map((v, k) => v + (moods[i].c[k] - v) * s);
    }
    sky.style.setProperty('--mood', `rgba(${col.slice(0, 3).map(Math.round).join(',')},${col[3].toFixed(3)})`);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paintSky); } }, { passive: true });
  addEventListener('resize', paintSky);
  paintSky();

  /* ---------- App bar turns solid after the hero ---------- */
  const appbar = $('#appbar');
  const hero = $('.hero');
  new IntersectionObserver(([e]) => appbar.classList.toggle('is-solid', !e.isIntersecting), { rootMargin: '-60px 0px 0px 0px', threshold: 0 })
    .observe(hero.querySelector('.hero-body'));

  /* ---------- Story carousel: active card + dots ---------- */
  $$('[data-carousel]').forEach((wrap) => {
    const track = $('[data-track]', wrap);
    const slides = $$('[data-slide]', wrap);
    const dots = $('[data-dots]', wrap);
    dots.innerHTML = slides.map(() => '<i></i>').join('');
    const dotEls = $$('i', dots);
    let current = -1;
    const setActive = (i) => {
      if (i === current) return;
      current = i;
      slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
      dotEls.forEach((d, n) => d.classList.toggle('on', n === i));
      slides.forEach((s, n) => s.dataset.spin && (n === i ? startSpin(s) : stopSpin(s)));
      if (i > 0) buzz(6);
    };
    const update = () => {
      const w = slides[0].getBoundingClientRect().width + 12;
      setActive(Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / w))));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  });

  /* ---------- Drink spin: plays the real 3D turn while its card is in front ---------- */
  function startSpin(slide) {
    if (reduced || slide._spin) return;
    const img = $('.spin-frame', slide);
    const base = slide.dataset.spin;
    const step = 6, count = 360;
    const frames = [];
    for (let f = 0; f < count; f += step) {
      const im = new Image();
      im.src = `${base}${String(f).padStart(3, '0')}.webp`;
      frames.push(im);
    }
    let i = 0;
    slide._spin = setInterval(() => {
      const next = frames[i % frames.length];
      if (next.complete && next.naturalWidth) img.src = next.src;
      i++;
    }, 80);
  }
  function stopSpin(slide) { clearInterval(slide._spin); slide._spin = null; }

  /* ---------- Example report: swipeable card stack ---------- */
  const deck = $('[data-deck]');
  const cards = $$('[data-card]', deck);
  const deckDots = $('[data-deck-dots]');
  deckDots.innerHTML = cards.map(() => '<i></i>').join('');
  let order = cards.map((_, i) => i);
  const layout = () => {
    order.forEach((ci, pos) => {
      const c = cards[ci];
      c.dataset.pos = pos;
      c.style.zIndex = 10 - pos;
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
    setTimeout(() => {
      top.classList.remove('is-flying');
      order.push(order.shift());
      layout();
    }, reduced ? 0 : 320);
  };
  layout();
  $('[data-deck-next]').addEventListener('click', () => advance(-1));
  let sx = 0, sy = 0, dx = 0, dragging = false, locked = null;
  deck.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY; dx = 0; dragging = true; locked = null;
    cards[order[0]].style.transition = 'none';
  });
  deck.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!locked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (locked !== 'x') return;
    deck.setPointerCapture?.(e.pointerId);
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

  /* ---------- Team: avatar row -> bottom sheet ---------- */
  // One-liners are each tutor's own words from their live intro.
  const team = [
    { name: 'Joshua Gordon Jones', short: 'Joshua', role: 'Founder · Psychology graduate, qualified SEN & education specialist', img: 'assets/team/joshua-escalator-600.webp', pos: '41% 50%', zoom: 3.4, line: 'We’re here so every student can have a team behind them.' },
    { name: 'Aaron Gelsthorpe', short: 'Aaron', role: 'English, Maths, Science & Art tutor · Art & design lead', img: 'assets/team/aaron-video-call-600.webp', pos: '50% 42%', zoom: 1.15, line: 'Passionate about supporting students with their English, Maths and Art skills!' },
    { name: 'Connor Wright', short: 'Connor', role: 'Primary tutor · TA and 1-1 specialist', img: 'assets/team/connor-snake-600.webp', pos: '40% 34%', zoom: 1.7, line: 'I really enjoy making positive impacts and facilitating growth for my students.' },
    { name: 'Sara Sharra', short: 'Sara', role: 'Italian tutor · Interior Design at UWE', img: 'assets/team/sara-portrait-600.webp', pos: '50% 38%', zoom: 1.15, line: 'Non vedo l’ora di conoscerti!' },
    { name: 'Joan Miquel Serra', short: 'Joan', role: 'Spanish & SEN tutor · Psychology graduate and SEN specialist', img: 'assets/team/chemi-suit-600.webp', pos: '52% 35%', zoom: 2.2, line: 'I love helping my students discover their potential!' },
    { name: 'Hồ Thị Yến Như (Sam)', short: 'Sam', role: 'Maths, English & Vietnamese tutor · Finance student', img: 'assets/team/nhu-portrait.jpg', pos: '52% 32%', zoom: 1.6, line: 'I love breaking big problems into small steps until everything clicks.' },
    { name: 'Owen Young', short: 'Owen', role: 'French tutor · Sports Science at Uni of Loughborough', img: 'assets/team/owen-goalkeeper.jpg', pos: '47% 15%', zoom: 2.6, line: 'Si tu veux apprendre l’anglais, je peux t’aider.' },
    { name: 'Amin Gharbi', short: 'Amin', role: 'Arabic & English tutor · Entrepreneur', img: 'assets/team/amin-portrait.jpg', pos: '60% 42%', zoom: 1.6, line: 'We set clear goals together in a supportive, engaging space.' },
  ];
  const list = $('[data-team]');
  list.innerHTML = team.map((t, i) => `
    <li class="avatar"><button type="button" data-member="${i}" aria-haspopup="dialog">
      <span class="ring"><span><img src="${t.img}" alt="" style="--pos:${t.pos};--zoom:${t.zoom}" loading="lazy" /></span></span>
      <b>${t.short}</b>
    </button></li>`).join('');

  /* ---------- Sheets ---------- */
  const scrim = $('#scrim');
  let openSheet = null, lastFocus = null;
  const showSheet = (sheet) => {
    if (openSheet) hideSheet(true);
    lastFocus = document.activeElement;
    openSheet = sheet;
    scrim.hidden = false; sheet.hidden = false;
    document.body.classList.add('sheet-open');
    actionbar.classList.remove('is-on');
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('is-on'); sheet.classList.add('is-on'); }));
    buzz(8);
    setTimeout(() => sheet.focus({ preventScroll: true }), 380);
  };
  const hideSheet = (instant) => {
    const sheet = openSheet; if (!sheet) return;
    openSheet = null;
    sheet.classList.remove('is-on'); scrim.classList.remove('is-on');
    sheet.style.removeProperty('--drag');
    document.body.classList.remove('sheet-open');
    const done = () => { sheet.hidden = true; if (!openSheet) scrim.hidden = true; updateBar(); };
    instant ? done() : setTimeout(done, 380);
    lastFocus?.focus?.({ preventScroll: true });
  };
  scrim.addEventListener('click', () => hideSheet());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideSheet());
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => hideSheet()));

  // Drag down on the grabber area to dismiss.
  $$('.sheet').forEach((sheet) => {
    let y0 = null, dy = 0;
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input, button, a')) return;
      if (sheet.scrollTop > 0) return;
      y0 = e.clientY; dy = 0; sheet.classList.add('is-dragging');
    });
    sheet.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.setProperty('--drag', `${dy}px`);
    });
    const up = () => {
      if (y0 === null) return;
      y0 = null; sheet.classList.remove('is-dragging');
      if (dy > 90) hideSheet(); else sheet.style.removeProperty('--drag');
    };
    sheet.addEventListener('pointerup', up);
    sheet.addEventListener('pointercancel', up);
  });

  const teamSheet = $('#team-sheet');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-member]'); if (!b) return;
    const t = team[+b.dataset.member];
    const img = $('#ts-img');
    img.src = t.img; img.alt = t.name; img.style.setProperty('--pos', t.pos); img.style.setProperty('--zoom', t.zoom);
    $('#ts-name').textContent = t.name;
    $('#ts-role').textContent = t.role;
    $('#ts-line').textContent = `“${t.line}”`;
    showSheet(teamSheet);
  });

  const bookSheet = $('#book-sheet');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-book]')) return;
    $('#bs-form-wrap').hidden = false; $('#bs-done').hidden = true;
    showSheet(bookSheet);
  });

  /* ---------- Booking form (mock: validates, never sends) ---------- */
  const form = $('#book-form');
  const contact = form.elements.contact;
  contact.addEventListener('input', () => {
    // Switch to a phone keyboard once they start typing digits.
    const phoney = /^[+\d\s()-]{2,}$/.test(contact.value);
    contact.inputMode = phoney ? 'tel' : 'email';
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    ['name', 'contact'].forEach((n) => {
      const f = form.elements[n];
      const bad = !f.value.trim() || (n === 'contact' && !/@|\d{6,}/.test(f.value.replace(/\s/g, '')));
      f.closest('.field').classList.toggle('bad', bad);
      f.closest('.field').querySelector('.err').hidden = !bad;
      if (bad && ok) { f.focus(); ok = false; }
    });
    if (!ok) { buzz([10, 40, 10]); return; }
    $('#bs-form-wrap').hidden = true; $('#bs-done').hidden = false;
    buzz(20);
  });

  /* ---------- Sticky action bar ---------- */
  const actionbar = $('#actionbar');
  const heroCta = $('#hero-cta');
  const finalCta = $('#final-cta');
  const seen = new Map();
  const updateBar = () => {
    const on = !openSheet && seen.get(heroCta) === false && seen.get(finalCta) !== true;
    actionbar.classList.toggle('is-on', on);
    actionbar.setAttribute('aria-hidden', on ? 'false' : 'true');
    $$('a, button', actionbar).forEach((el) => (el.tabIndex = on ? 0 : -1));
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => seen.set(en.target, en.isIntersecting));
    updateBar();
  });
  io.observe(heroCta); io.observe(finalCta);

  // Hide the bar while the on-screen keyboard is up.
  window.visualViewport?.addEventListener('resize', () => {
    const kb = window.visualViewport.height < window.innerHeight * 0.75;
    if (kb) actionbar.classList.remove('is-on'); else updateBar();
  });

  // Test hooks for screenshot capture.
  window.__mock = { showTeam: (i) => list.querySelector(`[data-member="${i}"]`).click(), book: () => heroCta.click(), next: () => advance(-1) };
})();
