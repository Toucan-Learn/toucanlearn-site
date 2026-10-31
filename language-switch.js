// Native details works without JavaScript; add Escape and outside-click dismissal.
(() => {
  const switches = [...document.querySelectorAll('details.language-switch')];
  switches.forEach(menu => {
    menu.addEventListener('toggle', () => {
      if (menu.open) switches.forEach(other => { if (other !== menu) other.open = false; });
    });
  });
  document.addEventListener('click', event => {
    switches.forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
  });
  // Handle the inner disclosure before the shared mobile-menu Escape handler.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = switches.find(item => item.open && item.contains(document.activeElement));
    if (!menu) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menu.open = false;
    menu.querySelector('summary').focus();
  }, true);
})();
