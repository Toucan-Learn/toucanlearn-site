/* A quiet manual screenshot placeholder until the gameplay showcase is ready. */
(() => {
  document.querySelectorAll('[data-screenshot-gallery]').forEach(gallery => {
    const images = [...gallery.querySelectorAll('[data-screenshot]')];
    const next = gallery.querySelector('[data-screenshot-next]');
    const status = gallery.querySelector('[data-screenshot-status]');
    if (!images.length || !next || !status) return;
    let current = 0;
    const show = () => {
      images.forEach((image, index) => { image.hidden = index !== current; });
      status.textContent = `Gameplay screenshots · ${current + 1} of ${images.length}`;
    };
    next.disabled = images.length < 2;
    next.addEventListener('click', () => { current = (current + 1) % images.length; show(); });
    show();
    gallery.dataset.enhanced = '';
    window.addEventListener('beforeprint', () => images.forEach(image => { image.hidden = false; }));
    window.addEventListener('afterprint', show);
  });
})();
