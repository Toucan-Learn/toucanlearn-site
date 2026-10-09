/* Kit and all sample work are fictional. Nothing here makes a network request. */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sky = document.getElementById('kit-sky');
  const canvas = document.getElementById('kit-sky-canvas');
  const ctx = canvas.getContext('2d');
  const calmButton = document.getElementById('kit-calm');
  const colourButton = document.getElementById('kit-colour');
  const backdrop = document.createElement('canvas');
  const backdropCtx = backdrop.getContext('2d');
  const palettes = [
    { name: 'mint', colour: '#a9ecd3', cloud: [23, 56, 63] },
    { name: 'violet', colour: '#d5bafa', cloud: [43, 37, 66] },
    { name: 'gold', colour: '#ffce8e', cloud: [56, 46, 34] }
  ];
  let chosenColour = 0;
  let calm = preference.matches;
  let inView = true;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let lastTrail = -1;
  let stars = [];
  let ripples = [];

  function paintBackdrop() {
    if (!ctx || !backdropCtx) return;
    backdrop.width = canvas.width;
    backdrop.height = canvas.height;
    let seed = 1729;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const cloud = palettes[chosenColour].cloud;
    for (let y = 0; y < backdrop.height; y += 2) {
      for (let x = 0; x < backdrop.width; x += 2) {
        const band = Math.exp(-Math.pow((y / backdrop.height + x / backdrop.width * .6 - .8) * 3, 2));
        const density = Math.round((band * .7 + random() * .3) * 5) / 5;
        backdropCtx.fillStyle = `rgb(${12 + cloud[0] * density}, ${20 + cloud[1] * density}, ${32 + cloud[2] * density})`;
        backdropCtx.fillRect(x, y, 2, 2);
      }
    }
    stars = Array.from({ length: 110 }, () => ({ x: random(), y: random(), bright: random(), phase: random() * 6.28 }));
  }

  function drawSky() {
    if (!ctx || !backdropCtx) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(backdrop, 0, 0);
    for (const star of stars) {
      const x = Math.floor(star.x * canvas.width);
      const y = Math.floor(star.y * canvas.height + Math.sin(elapsed * .12 + star.phase));
      ctx.fillStyle = star.bright > .7 ? '#dceade' : '#7899af';
      ctx.fillRect(x, y, 1, 1);
      if (star.bright > .95) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
    ripples = ripples.filter(ripple => elapsed - ripple.born < 3.5);
    for (const ripple of ripples) {
      const age = elapsed - ripple.born;
      ctx.globalAlpha = Math.max(0, 1 - age / 3.5) * .7;
      ctx.strokeStyle = ripple.colour;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ripple.x * canvas.width, ripple.y * canvas.height, 1 + age * canvas.width * .22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function animate(now) {
    frame = 0;
    if (calm || preference.matches || !inView || document.hidden) return;
    if (!previous || now - previous >= 50) {
      elapsed += previous ? Math.min((now - previous) / 1000, .12) : 0;
      previous = now;
      drawSky();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    if (ctx && !calm && !preference.matches && inView && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function applyCalm() {
    if (preference.matches) calm = true;
    document.body.classList.toggle('is-calm', calm);
    calmButton.setAttribute('aria-pressed', String(calm));
    calmButton.textContent = preference.matches ? 'Calm: system setting' : calm ? 'Calm: on' : 'Calm';
    calmButton.disabled = preference.matches;
    sky.setAttribute('aria-label', calm ? 'Kit’s pixel sky, motion paused' : 'Make a colour ripple in Kit’s pixel sky');
    document.getElementById('sky-hint').textContent = calm
      ? 'The sky is still. You can change its colour, or turn Calm off when your motion setting allows.'
      : 'Move, tap, or press Enter in the sky to make ripples. Calm pauses motion.';
    syncMotion();
  }

  function addRipple(event) {
    if (calm || preference.matches || !ctx) return;
    const rect = sky.getBoundingClientRect();
    const keyboard = event.type === 'click' && event.detail === 0;
    ripples.push({ x: keyboard ? .5 : (event.clientX - rect.left) / rect.width, y: keyboard ? .5 : (event.clientY - rect.top) / rect.height, born: elapsed, colour: palettes[chosenColour].colour });
    ripples = ripples.slice(-18);
    drawSky();
  }

  sky.disabled = !ctx;
  colourButton.disabled = !ctx;
  sky.addEventListener('click', addRipple);
  sky.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' && !event.buttons) return;
    if (elapsed - lastTrail < .18) return;
    lastTrail = elapsed;
    addRipple(event);
  }, { passive: true });
  calmButton.addEventListener('click', () => { calm = !calm; applyCalm(); });
  colourButton.addEventListener('click', () => {
    chosenColour = (chosenColour + 1) % palettes.length;
    colourButton.textContent = `Sky colour: ${palettes[chosenColour].name}`;
    paintBackdrop();
    drawSky();
  });
  preference.addEventListener('change', event => { calm = event.matches; applyCalm(); });
  function resizeSky() {
    const rect = sky.getBoundingClientRect();
    canvas.width = Math.max(1, Math.min(360, Math.round(rect.width / 3)));
    canvas.height = Math.max(1, Math.round(rect.height / rect.width * canvas.width));
    paintBackdrop();
    drawSky();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resizeSky).observe(sky);
  else window.addEventListener('resize', resizeSky, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncMotion(); }).observe(sky);
  document.addEventListener('visibilitychange', syncMotion);
  resizeSky();
  applyCalm();

  // A wrong answer keeps the same question. Only correct answers add fuel.
  const gameForm = document.getElementById('rocket-form');
  const gameFields = document.getElementById('rocket-fields');
  const answer = document.getElementById('rocket-answer');
  const question = document.getElementById('maths-question');
  const gameFeedback = document.getElementById('game-feedback');
  const resetGame = document.getElementById('rocket-reset');
  const launchPad = document.getElementById('launch-pad');
  const fuelCells = Array.from(document.querySelectorAll('.fuel-cells span'));
  let fuel = 0;
  let left = 3;
  let right = 4;
  gameFields.disabled = false;
  resetGame.disabled = false;
  function showFuel() {
    document.getElementById('fuel-count').textContent = `${fuel} / 5`;
    fuelCells.forEach((cell, index) => cell.classList.toggle('is-full', index < fuel));
  }
  function nextQuestion() {
    left = 2 + Math.floor(Math.random() * 11);
    right = 2 + Math.floor(Math.random() * 11);
    question.textContent = `${left} × ${right} = ?`;
  }
  gameForm.addEventListener('submit', event => {
    event.preventDefault();
    if (fuel >= 5) return;
    if (Number(answer.value) !== left * right) {
      gameFeedback.textContent = `Not quite. Try ${right} groups of ${left}. The rocket is waiting — have another go.`;
      answer.select();
      return;
    }
    const solved = `${left} × ${right} = ${left * right}`;
    fuel += 1;
    showFuel();
    answer.value = '';
    if (fuel === 5) {
      launchPad.classList.add('is-launched');
      gameFeedback.textContent = `${solved}. Lift-off! Five correct answers took your rocket to the stars. Play again?`;
      gameFields.disabled = true;
      resetGame.focus();
    } else {
      nextQuestion();
      gameFeedback.textContent = `${solved}. Fuel added! ${fuel} of 5. Next question: ${left} times ${right}.`;
      answer.focus();
    }
  });
  resetGame.addEventListener('click', () => {
    fuel = 0;
    showFuel();
    launchPad.classList.remove('is-launched');
    gameFields.disabled = false;
    answer.value = '';
    nextQuestion();
    gameFeedback.textContent = `New mission! What is ${left} times ${right}?`;
    answer.focus();
  });

  // Grid positions travel safely between narrow and wide screens. Dragging,
  // arrow keys and the Move button all change the same saved order.
  const storageKey = 'toucan-kit-ideas-v1';
  const board = document.getElementById('ideas-board');
  const ideaForm = document.getElementById('idea-form');
  const ideaInput = document.getElementById('idea-text');
  const ideaFeedback = document.getElementById('idea-feedback');
  const storageHint = document.getElementById('storage-hint');
  const resetWall = document.getElementById('ideas-reset');
  const starters = ['Design a football kit for zero gravity.', 'How long would a match on Mars last?'];
  let serial = 0;
  const note = text => ({ id: `kit-note-${++serial}`, text });
  let notes = starters.map(note);
  let storageAvailable = true;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const values = JSON.parse(stored);
      if (Array.isArray(values) && values.length <= 12 && values.every(value => typeof value === 'string' && value.trim() && value.length <= 140)) notes = values.map(note);
    }
  } catch (_) { storageAvailable = false; }
  function showStorage() {
    storageHint.textContent = storageAvailable
      ? 'Notes save only in this browser when storage is available. Reset the wall to remove your notes.'
      : 'Browser storage is unavailable. The wall still works for this visit; notes will not stay after you leave.';
  }
  function saveNotes() {
    try { localStorage.setItem(storageKey, JSON.stringify(notes.map(item => item.text))); storageAvailable = true; }
    catch (_) { storageAvailable = false; }
    showStorage();
  }
  function focusHandle(id) { document.getElementById(id)?.querySelector('.note-handle').focus(); }
  function moveNote(id, destination) {
    const start = notes.findIndex(item => item.id === id);
    const end = Math.max(0, Math.min(notes.length - 1, destination));
    if (start < 0 || start === end) return;
    notes.splice(end, 0, notes.splice(start, 1)[0]);
    saveNotes();
    renderNotes();
    focusHandle(id);
    ideaFeedback.textContent = `Idea moved to position ${end + 1} of ${notes.length}.`;
  }
  function renderNotes() {
    board.replaceChildren();
    notes.forEach((item, index) => {
      const tile = document.createElement('div');
      tile.className = 'idea-note';
      tile.id = item.id;
      const handle = document.createElement('button');
      handle.className = 'note-handle';
      handle.type = 'button';
      handle.textContent = `⋮⋮ NOTE ${index + 1}`;
      handle.setAttribute('aria-label', `Note ${index + 1}: ${item.text}. Use arrow keys to change its position.`);
      const text = document.createElement('p');
      text.textContent = item.text;
      const actions = document.createElement('div');
      actions.className = 'note-actions';
      const move = document.createElement('button');
      move.type = 'button';
      move.textContent = 'Move';
      move.setAttribute('aria-label', `Move idea ${index + 1} to the next position`);
      move.addEventListener('click', () => moveNote(item.id, (index + 1) % notes.length));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove idea ${index + 1}`);
      remove.addEventListener('click', () => {
        notes = notes.filter(value => value.id !== item.id);
        saveNotes();
        renderNotes();
        if (notes.length) focusHandle(notes[Math.min(index, notes.length - 1)].id);
        else ideaInput.focus();
        ideaFeedback.textContent = `Idea removed. ${notes.length} notes on the wall.`;
      });
      handle.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const columns = window.getComputedStyle(board).gridTemplateColumns.split(' ').length;
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
        moveNote(item.id, index + offsets[event.key]);
      });
      let drag = null;
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        drag = { x: event.clientX, y: event.clientY, active: false };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.active && Math.hypot(dx, dy) < 7) return;
        drag.active = true;
        tile.classList.add('is-dragging');
        tile.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      handle.addEventListener('pointerup', event => {
        if (!drag) return;
        const wasDragging = drag.active;
        drag = null;
        tile.classList.remove('is-dragging');
        tile.style.transform = '';
        if (!wasDragging) return;
        let closest = index, distance = Infinity;
        Array.from(board.children).forEach((candidate, position) => {
          const rect = candidate.getBoundingClientRect();
          const gap = Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
          if (gap < distance) { closest = position; distance = gap; }
        });
        moveNote(item.id, closest);
      });
      const cancelDrag = () => { drag = null; tile.classList.remove('is-dragging'); tile.style.transform = ''; };
      handle.addEventListener('pointercancel', cancelDrag);
      handle.addEventListener('lostpointercapture', cancelDrag);
      actions.append(move, remove);
      tile.append(handle, text, actions);
      board.append(tile);
    });
  }
  ideaForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = ideaInput.value.trim();
    if (!value) { ideaFeedback.textContent = 'Write a little idea before sticking it up.'; ideaInput.focus(); return; }
    if (notes.length >= 12) { ideaFeedback.textContent = 'The wall has 12 notes. Remove one to make room for a new thought.'; return; }
    const item = note(value.slice(0, 140));
    notes.push(item);
    saveNotes();
    renderNotes();
    ideaInput.value = '';
    focusHandle(item.id);
    ideaFeedback.textContent = storageAvailable ? 'Idea added and saved in this browser.' : 'Idea added for this visit. Browser storage is unavailable.';
  });
  resetWall.addEventListener('click', () => {
    notes = starters.map(note);
    try { localStorage.removeItem(storageKey); storageAvailable = true; }
    catch (_) { storageAvailable = false; }
    showStorage();
    renderNotes();
    ideaFeedback.textContent = 'Wall reset to the two sample ideas. Your notes have been removed from this wall.';
    ideaInput.focus();
  });
  document.getElementById('idea-fields').disabled = false;
  resetWall.disabled = false;
  renderNotes();
  showStorage();
})();
