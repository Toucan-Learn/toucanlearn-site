// Apply only an explicit choice before styles paint; otherwise CSS follows the device.
(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('toucan-theme');
    if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
  } catch (_) { /* The device preference and toggle work without storage. */ }

  document.addEventListener('DOMContentLoaded', () => {
    const device = window.matchMedia('(prefers-color-scheme: dark)');
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    const isDark = () => root.dataset.theme === 'dark' ||
      (root.dataset.theme !== 'light' && device.matches);
    const update = () => {
      const dark = isDark();
      toggles.forEach(toggle => {
        toggle.setAttribute('aria-pressed', String(dark));
        toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      });
    };

    toggles.forEach(toggle => toggle.addEventListener('click', () => {
      const theme = isDark() ? 'light' : 'dark';
      root.dataset.theme = theme;
      try { localStorage.setItem('toucan-theme', theme); } catch (_) { /* Keep the choice for this page. */ }
      update();
    }));
    device.addEventListener('change', update);
    update();
  }, { once: true });
})();
