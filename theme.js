// Default to light before styles paint; only an explicit saved choice overrides it.
(() => {
  const root = document.documentElement;
  const t = text => window.toucanText?.[text] ?? text;
  root.dataset.theme = 'light';
  try {
    const saved = localStorage.getItem('toucan-theme');
    if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
  } catch (_) { /* Keep the light default; the toggle still works without storage. */ }

  document.addEventListener('DOMContentLoaded', () => {
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    const isDark = () => root.dataset.theme === 'dark';
    const update = () => {
      const dark = isDark();
      toggles.forEach(toggle => {
        toggle.setAttribute('aria-pressed', String(dark));
        toggle.setAttribute('aria-label', dark
          ? (toggle.dataset.themeLightLabel || t('Switch to light mode'))
          : (toggle.dataset.themeDarkLabel || t('Switch to dark mode')));
      });
    };

    toggles.forEach(toggle => toggle.addEventListener('click', () => {
      const theme = isDark() ? 'light' : 'dark';
      root.dataset.theme = theme;
      try { localStorage.setItem('toucan-theme', theme); } catch (_) { /* Keep the choice for this page. */ }
      update();
    }));
    update();
  }, { once: true });
})();
