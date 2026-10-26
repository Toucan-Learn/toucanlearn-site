/* Old service links retain campaign queries and land on the matching new panel. */
(() => {
  const destination = document.body.dataset.legacyDestination;
  if (!destination) return;
  const target = new URL(destination, location.href);
  if (target.origin !== location.origin) return;
  target.search = location.search;
  // Old fragments referred to the retired page's sections. The explicit new
  // subject/section fragment takes precedence so the relevant panel is visible.
  const fallback = document.getElementById('destination-link');
  if (fallback) fallback.href = target.href;
  location.replace(target.href);
})();
