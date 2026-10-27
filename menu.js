(() => {
  document.querySelectorAll('.nav-links, .mobile-menu > nav').forEach(nav => {
    const team = nav.querySelector(':scope > a[href="team.html"]');
    const reviews = nav.querySelector(':scope > a[href$="#reviews"]');
    if (team && reviews) nav.insertBefore(team, reviews);
  });

  document.querySelectorAll('details.mobile-menu').forEach(menu => {
    const summary = menu.querySelector('summary');

    menu.addEventListener('click', event => {
      if (event.target.closest('a')) menu.open = false;
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        summary.focus();
      }
    });

    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });
})();
