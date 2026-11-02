// The opening sheet paints first. Enable the complete sheets together in their
// original DOM order, so late campaign/project rules keep their exact cascade.
(() => {
  const links = [...document.querySelectorAll('link[data-deferred-style]')];
  const loaded = link => new Promise(resolve => {
    if (link.sheet) return resolve();
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
  window.toucanStylesReady = Promise.all(links.map(loaded)).then(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      links.forEach(link => { link.media = 'all'; });
      window.dispatchEvent(new Event('resize'));
      resolve();
    }));
  }));
})();
